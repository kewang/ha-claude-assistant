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
import { ConversationStore, buildPromptWithHistory } from '../core/conversation-store.js';
import { MemoryStore, buildPromptWithMemory } from '../core/memory-store.js';
import { detectEnvironment } from '../core/env-detect.js';
import { getTokenRefreshService } from '../core/claude-token-refresh.js';
import { createLogger } from '../utils/logger.js';
import { VERSION } from '../version.js';

config();

const logger = createLogger('Slack');

// 重連設定
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 60000;

// 取得環境設定
const env = detectEnvironment();

// Debug: 顯示環境偵測結果
logger.info('Environment detection:');
logger.info(`  isAddon: ${env.isAddon}`);
logger.info(`  SUPERVISOR_TOKEN: ${process.env.SUPERVISOR_TOKEN ? '(已設定)' : '未設定'}`);
logger.info(`  HA_URL: ${process.env.HA_URL || '未設定'}`);
logger.info(`  HA_TOKEN: ${process.env.HA_TOKEN ? '(已設定)' : '未設定'}`);

// 預設 timeout 3 分鐘（複雜查詢需要多次 MCP 工具呼叫）
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || '', 10) || 3 * 60 * 1000;

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<string> {
  // 執行前確保 token 有效
  const tokenService = getTokenRefreshService('SlackBot');
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
  private conversationStore: ConversationStore;
  private memoryStore: MemoryStore;
  private defaultChannelId?: string;
  private botUserId?: string;
  private reconnectAttempts = 0;
  private reconnecting = false;

  constructor() {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;

    if (!botToken || !appToken) {
      throw new Error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required');
    }

    this.haClient = new HAClient();
    this.conversationStore = new ConversationStore();
    this.memoryStore = new MemoryStore();

    this.app = new App({
      token: botToken,
      appToken: appToken,
      socketMode: true,
      logLevel: process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
    });

    this.defaultChannelId = process.env.SLACK_DEFAULT_CHANNEL;

    this.setupSocketModeHandlers();
    this.setupEventHandlers();
    this.setupCommands();
  }

  /**
   * 設定 SocketModeClient 事件處理，處理斷線和重連
   */
  private setupSocketModeHandlers(): void {
    const socketModeClient = (this.app as unknown as { receiver: { client: unknown } }).receiver?.client;

    if (!socketModeClient) {
      logger.warn('無法取得 SocketModeClient，跳過重連處理設定');
      return;
    }

    const client = socketModeClient as {
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };

    // 監聽連線成功事件
    client.on('connected', () => {
      logger.info('Socket Mode 連線成功');
      this.reconnectAttempts = 0;
      this.reconnecting = false;
    });

    // 監聽斷線事件
    client.on('disconnected', () => {
      logger.warn('Socket Mode 連線已斷開');
      this.handleDisconnect();
    });

    // 監聽錯誤事件
    client.on('error', (error: unknown) => {
      logger.error('Socket Mode 錯誤:', error);
    });

    // 監聽無法連線事件
    client.on('unable_to_socket_mode_start', (error: unknown) => {
      logger.error('無法啟動 Socket Mode:', error);
      this.handleDisconnect();
    });
  }

  /**
   * 處理斷線並嘗試重連
   */
  private async handleDisconnect(): Promise<void> {
    if (this.reconnecting) {
      logger.debug('已在重連中，跳過');
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(`已達最大重連次數 (${MAX_RECONNECT_ATTEMPTS})，放棄重連`);
      await this.sendNotification(`⚠️ Slack Bot 重連失敗：已嘗試 ${MAX_RECONNECT_ATTEMPTS} 次，請檢查網路連線或重新啟動服務`);
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempts++;

    // 計算指數退避延遲
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    logger.info(`將在 ${delay / 1000} 秒後嘗試重連 (第 ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次)`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.app.start();
      logger.info('重連成功');
      this.reconnecting = false;
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error('重連失敗:', error);
      this.reconnecting = false;
      // 繼續嘗試重連
      this.handleDisconnect();
    }
  }

  private setupEventHandlers(): void {
    // 處理 DM 訊息和 channel thread 自動回覆
    this.app.message(async ({ message, say }) => {
      if (message.subtype !== undefined) return;
      if (!('user' in message) || !message.user) return;
      if (!('text' in message) || !message.text) return;
      if ('bot_id' in message) return;

      const userId = message.user;
      const text = message.text;
      const threadTs = ('thread_ts' in message ? message.thread_ts : undefined) || message.ts;
      const isThreadReply = 'thread_ts' in message && message.thread_ts !== undefined;
      const isDM = 'channel_type' in message && message.channel_type === 'im';

      // Channel 訊息處理邏輯
      if (!isDM) {
        // 含 @mention 的訊息交給 app_mention handler 處理，避免重複
        if (this.botUserId && text.includes(`<@${this.botUserId}>`)) return;

        // 非 thread 回覆的一般 channel 訊息，忽略（需 @mention 才觸發）
        if (!isThreadReply) return;

        // Thread 回覆：檢查 bot 是否參與過此 thread
        const conversationKey = `slack:${threadTs}`;
        const history = await this.conversationStore.getHistory(conversationKey);
        if (history.length === 0) return;
      }

      logger.info(`Message from ${userId} (${isDM ? 'DM' : 'thread'}): ${text}`);

      // 先回覆「處理中」提示
      const thinkingMsg = await say({
        text: '🔄 處理中，請稍候...',
        thread_ts: threadTs,
      });

      try {
        const conversationKey = `slack:${threadTs}`;
        const history = await this.conversationStore.getHistory(conversationKey);
        const memories = this.memoryStore.getAll();
        const withMemory = buildPromptWithMemory(memories, text);
        const augmentedPrompt = buildPromptWithHistory(history, withMemory);
        const response = await executeClaudePrompt(augmentedPrompt);

        await this.conversationStore.addExchange(conversationKey, text, response);

        // 更新「處理中」訊息為正式回覆
        if (thinkingMsg && thinkingMsg.ts) {
          await this.app.client.chat.update({
            channel: message.channel,
            ts: thinkingMsg.ts,
            text: response,
          });
        } else {
          await say({
            text: response,
            thread_ts: threadTs,
          });
        }
      } catch (error) {
        logger.error('Error processing message:', error);
        const errorText = `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`;

        if (thinkingMsg && thinkingMsg.ts) {
          await this.app.client.chat.update({
            channel: message.channel,
            ts: thinkingMsg.ts,
            text: errorText,
          });
        } else {
          await say({
            text: errorText,
            thread_ts: threadTs,
          });
        }
      }
    });

    // 處理 @mention
    this.app.event('app_mention', async ({ event, say }) => {
      const userId = event.user;
      // 移除 @mention 部分
      const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      const threadTs = event.thread_ts || event.ts;

      if (!text) {
        await say({
          text: '你好！我是智慧家庭助理，請問有什麼我可以幫忙的嗎？',
          thread_ts: threadTs,
        });
        return;
      }

      if (!userId) {
        await say({
          text: '無法識別使用者',
          thread_ts: threadTs,
        });
        return;
      }

      logger.info(`Mention from ${userId}: ${text}`);

      // 先回覆「處理中」提示
      const thinkingMsg = await say({
        text: '🔄 處理中，請稍候...',
        thread_ts: threadTs,
      });

      try {
        const conversationKey = `slack:${threadTs}`;
        const history = await this.conversationStore.getHistory(conversationKey);
        const memories = this.memoryStore.getAll();
        const withMemory = buildPromptWithMemory(memories, text);
        const augmentedPrompt = buildPromptWithHistory(history, withMemory);
        const response = await executeClaudePrompt(augmentedPrompt);

        await this.conversationStore.addExchange(conversationKey, text, response);

        if (thinkingMsg && thinkingMsg.ts) {
          await this.app.client.chat.update({
            channel: event.channel,
            ts: thinkingMsg.ts,
            text: response,
          });
        } else {
          await say({
            text: response,
            thread_ts: threadTs,
          });
        }
      } catch (error) {
        logger.error('Error processing mention:', error);
        const errorText = `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`;

        if (thinkingMsg && thinkingMsg.ts) {
          await this.app.client.chat.update({
            channel: event.channel,
            ts: thinkingMsg.ts,
            text: errorText,
          });
        } else {
          await say({
            text: errorText,
            thread_ts: threadTs,
          });
        }
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

      // 先回覆「處理中」提示
      await respond({
        text: '🔄 處理中，請稍候...',
      });

      try {
        const response = await executeClaudePrompt(text);

        await respond({
          text: response,
          replace_original: true,
        });
      } catch (error) {
        logger.error('Error processing command:', error);
        await respond({
          text: `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
          replace_original: true,
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
    // 初始化對話記憶與長期記憶
    await this.conversationStore.init();
    await this.conversationStore.cleanup();
    await this.memoryStore.init();

    // 取得 bot user ID（用於判斷 @mention 避免重複處理）
    try {
      const authResult = await this.app.client.auth.test();
      this.botUserId = authResult.user_id as string;
      logger.info(`Bot user ID: ${this.botUserId}`);
    } catch (error) {
      logger.error('無法取得 bot user ID:', error);
    }

    // 自動偵測 Home Assistant 連線
    try {
      const connection = await this.haClient.autoConnect();
      logger.info(`Home Assistant 連線成功 (${connection.type === 'internal' ? '內網' : '外網'}): ${connection.url}`);
    } catch (error) {
      logger.error(`Home Assistant 連線失敗: ${error instanceof Error ? error.message : error}`);
      logger.error('Bot 仍會啟動，但 HA 相關功能可能無法使用');
    }

    await this.app.start();
    logger.info(`Slack Bot v${VERSION} 已啟動！`);
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

  // Process-level 錯誤處理：捕捉 @slack/socket-mode 狀態機錯誤
  process.on('uncaughtException', async (error) => {
    const errorMessage = error.message || '';

    // 檢測是否為 @slack/socket-mode 狀態機錯誤
    if (errorMessage.includes("Unhandled event") && errorMessage.includes("in state")) {
      logger.warn(`捕捉到 Socket Mode 狀態機錯誤: ${errorMessage}`);
      logger.info('嘗試恢復連線...');
      // 狀態機錯誤通常是暫時性的，讓 SocketModeClient 的內建重連機制處理
      // 如果持續發生，handleDisconnect 會被觸發
      return;
    }

    // 其他致命錯誤
    logger.error('Uncaught exception:', error);
    await bot.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);

    // 檢測是否為 @slack/socket-mode 狀態機錯誤
    if (errorMessage.includes("Unhandled event") && errorMessage.includes("in state")) {
      logger.warn(`捕捉到 Socket Mode 狀態機錯誤 (rejection): ${errorMessage}`);
      logger.info('嘗試恢復連線...');
      return;
    }

    // 其他未處理的 rejection
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  await bot.start();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
