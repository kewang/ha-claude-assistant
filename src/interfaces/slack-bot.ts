#!/usr/bin/env node
/**
 * Slack Bot - 智慧家庭助理
 *
 * 透過 Claude CLI 處理使用者訊息，與 scheduler-daemon 保持一致的架構。
 * 使用 MCP Server 與 Home Assistant 互動。
 */

import bolt from '@slack/bolt';
const { App, LogLevel } = bolt;
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { HAClient } from '../core/ha-client.js';
import { detectEnvironment } from '../core/env-detect.js';

config();

// 取得環境設定
const env = detectEnvironment();

// 預設 timeout 1 分鐘
const CLAUDE_TIMEOUT_MS = 1 * 60 * 1000;

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = env.claudePath;
    const startTime = Date.now();

    console.log(`[Slack] Running claude --print "${prompt.substring(0, 80)}..."`);

    // 建立環境變數
    const spawnEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
    };

    // Add-on 環境：設定 Claude 設定目錄以持久化登入狀態
    if (env.claudeConfigDir) {
      spawnEnv.CLAUDE_CONFIG_DIR = env.claudeConfigDir;
    }

    // 使用 acceptEdits 模式允許 MCP 工具寫入檔案（如排程設定）
    const child = spawn(claudePath, ['--print', '--permission-mode', 'acceptEdits', prompt], {
      env: spawnEnv,
      cwd: process.cwd(), // 確保使用正確的工作目錄
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      // 即時輸出 stderr 以便追蹤進度
      console.error(`[Slack] Claude stderr: ${data.toString().trim()}`);
    });

    const timeout = setTimeout(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.error(`[Slack] Timeout after ${elapsed}s, stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      child.kill('SIGTERM');
      reject(new Error(`Claude 執行超時（${Math.round(CLAUDE_TIMEOUT_MS / 60000)} 分鐘）`));
    }, CLAUDE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stderr) {
        console.error('[Slack] Claude stderr:', stderr);
      }

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        console.error(`[Slack] Claude exited with code ${code}`);
        console.error('[Slack] stdout:', stdout);
        console.error('[Slack] stderr:', stderr);
        reject(new Error(`Claude 執行失敗 (exit code: ${code})`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Claude 執行錯誤: ${error.message}`));
    });
  });
}

class SlackBot {
  private app: bolt.App;
  private haClient: HAClient;
  private defaultChannelId?: string;

  constructor() {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;

    if (!botToken || !appToken) {
      throw new Error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required');
    }

    this.haClient = new HAClient();

    this.app = new App({
      token: botToken,
      appToken: appToken,
      socketMode: true,
      logLevel: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
    });

    this.defaultChannelId = process.env.SLACK_DEFAULT_CHANNEL;

    this.setupEventHandlers();
    this.setupCommands();
  }

  private setupEventHandlers(): void {
    // 處理 DM 訊息
    this.app.message(async ({ message, say }) => {
      // 只處理一般訊息（非 bot、非 thread）
      if (message.subtype !== undefined) return;
      if (!('user' in message) || !message.user) return;
      if (!('text' in message) || !message.text) return;

      const userId = message.user;
      const text = message.text;

      // 忽略 bot 自己的訊息
      if ('bot_id' in message) return;

      console.log(`[Slack] Message from ${userId}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await say({
          text: response,
          thread_ts: message.ts,
        });
      } catch (error) {
        console.error('[Slack] Error processing message:', error);
        await say({
          text: `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
          thread_ts: message.ts,
        });
      }
    });

    // 處理 @mention
    this.app.event('app_mention', async ({ event, say }) => {
      const userId = event.user;
      // 移除 @mention 部分
      const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

      if (!text) {
        await say({
          text: '你好！我是智慧家庭助理，請問有什麼我可以幫忙的嗎？',
          thread_ts: event.ts,
        });
        return;
      }

      if (!userId) {
        await say({
          text: '無法識別使用者',
          thread_ts: event.ts,
        });
        return;
      }

      console.log(`[Slack] Mention from ${userId}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await say({
          text: response,
          thread_ts: event.ts,
        });
      } catch (error) {
        console.error('[Slack] Error processing mention:', error);
        await say({
          text: `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
          thread_ts: event.ts,
        });
      }
    });
  }

  private setupCommands(): void {
    // /ha 指令
    this.app.command('/ha', async ({ command, ack, respond }) => {
      await ack();

      const text = command.text.trim();

      if (!text) {
        await respond({
          text: `*智慧家庭助理指令說明*

使用方式：\`/ha <指令>\`

範例：
• \`/ha 列出所有燈具\`
• \`/ha 把客廳的燈打開\`
• \`/ha 現在溫度幾度？\`
• \`/ha status\` - 檢查 Home Assistant 連線`,
        });
        return;
      }

      // 特殊指令：status
      if (text.toLowerCase() === 'status') {
        try {
          const result = await this.haClient.checkConnection();
          const connType = this.haClient.getConnectionType() === 'internal' ? '內網' : '外網';
          await respond({
            text: `✅ Home Assistant 連線正常 (${connType})：${result.message}\nURL: ${this.haClient.getCurrentUrl()}`,
          });
        } catch (error) {
          await respond({
            text: `❌ Home Assistant 連線失敗：${error instanceof Error ? error.message : '未知錯誤'}`,
          });
        }
        return;
      }

      // 一般指令：使用 Claude CLI
      console.log(`[Slack] Command from ${command.user_id}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await respond({
          text: response,
        });
      } catch (error) {
        console.error('[Slack] Error processing command:', error);
        await respond({
          text: `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
        });
      }
    });
  }

  /**
   * 發送通知到預設頻道
   */
  async sendNotification(message: string): Promise<void> {
    if (!this.defaultChannelId) {
      console.warn('[Slack] No default channel configured for notifications');
      return;
    }

    try {
      await this.app.client.chat.postMessage({
        channel: this.defaultChannelId,
        text: message,
      });
    } catch (error) {
      console.error('[Slack] Failed to send notification:', error);
    }
  }

  async start(): Promise<void> {
    // 自動偵測 Home Assistant 連線
    try {
      const connection = await this.haClient.autoConnect();
      console.log(`✓ Home Assistant 連線成功 (${connection.type === 'internal' ? '內網' : '外網'}): ${connection.url}`);
    } catch (error) {
      console.error(`⚠️ Home Assistant 連線失敗: ${error instanceof Error ? error.message : error}`);
      console.error('  Bot 仍會啟動，但 HA 相關功能可能無法使用');
    }

    await this.app.start();
    console.log('⚡️ Slack Bot 已啟動！');
  }

  async stop(): Promise<void> {
    await this.app.stop();
  }
}

// 主程式
async function main() {
  const bot = new SlackBot();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n正在關閉...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await bot.stop();
    process.exit(0);
  });

  await bot.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
