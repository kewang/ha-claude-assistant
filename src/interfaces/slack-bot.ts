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
import { getTokenRefreshService } from '../core/claude-token-refresh.js';
import { createLogger } from '../utils/logger.js';

config();

const logger = createLogger('Slack');

// 取得環境設定
const env = detectEnvironment();

// Debug: 顯示環境偵測結果
logger.info('Environment detection:');
logger.info(`  isAddon: ${env.isAddon}`);
logger.info(`  SUPERVISOR_TOKEN: ${process.env.SUPERVISOR_TOKEN ? '(已設定)' : '未設定'}`);
logger.info(`  HA_URL: ${process.env.HA_URL || '未設定'}`);
logger.info(`  HA_TOKEN: ${process.env.HA_TOKEN ? '(已設定)' : '未設定'}`);

// 預設 timeout 1 分鐘
const CLAUDE_TIMEOUT_MS = 1 * 60 * 1000;

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<string> {
  // 執行前確保 token 有效
  const tokenService = getTokenRefreshService();
  const tokenResult = await tokenService.ensureValidToken();
  if (!tokenResult.success && tokenResult.needsRelogin) {
    throw new Error('Claude token 已過期，需要重新登入。請執行：claude login');
  }

  return new Promise((resolve, reject) => {
    const claudePath = env.claudePath;
    const startTime = Date.now();

    logger.info(`Running claude --print "${prompt.substring(0, 80)}..."`);

    // 建立環境變數
    const spawnEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
    };

    // Add-on 環境：設定 Claude 設定目錄以持久化登入狀態
    if (env.claudeConfigDir) {
      spawnEnv.CLAUDE_CONFIG_DIR = env.claudeConfigDir;
    }

    // 使用 bypassPermissions 模式允許 MCP 工具自動執行（Add-on 環境下安全）
    const child = spawn(claudePath, ['--print', '--permission-mode', 'bypassPermissions', prompt], {
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
      logger.error(`Claude stderr: ${data.toString().trim()}`);
    });

    const timeout = setTimeout(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.error(`Timeout after ${elapsed}s, stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      child.kill('SIGTERM');
      reject(new Error(`Claude 執行超時（${Math.round(CLAUDE_TIMEOUT_MS / 60000)} 分鐘）`));
    }, CLAUDE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stderr) {
        logger.error('Claude stderr:', stderr);
      }

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        logger.error(`Claude exited with code ${code}`);
        logger.error('stdout:', stdout);
        logger.error('stderr:', stderr);
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

      logger.info(`Message from ${userId}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await say({
          text: response,
          thread_ts: message.ts,
        });
      } catch (error) {
        logger.error('Error processing message:', error);
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

      logger.info(`Mention from ${userId}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await say({
          text: response,
          thread_ts: event.ts,
        });
      } catch (error) {
        logger.error('Error processing mention:', error);
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
      logger.info(`Command from ${command.user_id}: ${text}`);

      try {
        const response = await executeClaudePrompt(text);

        await respond({
          text: response,
        });
      } catch (error) {
        logger.error('Error processing command:', error);
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
      logger.warn('No default channel configured for notifications');
      return;
    }

    try {
      await this.app.client.chat.postMessage({
        channel: this.defaultChannelId,
        text: message,
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  async start(): Promise<void> {
    // 自動偵測 Home Assistant 連線
    try {
      const connection = await this.haClient.autoConnect();
      logger.info(`Home Assistant 連線成功 (${connection.type === 'internal' ? '內網' : '外網'}): ${connection.url}`);
    } catch (error) {
      logger.error(`Home Assistant 連線失敗: ${error instanceof Error ? error.message : error}`);
      logger.error('Bot 仍會啟動，但 HA 相關功能可能無法使用');
    }

    await this.app.start();
    logger.info('Slack Bot 已啟動！');
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
    logger.info('正在關閉...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  await bot.start();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
