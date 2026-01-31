#!/usr/bin/env node
import bolt from '@slack/bolt';
const { App, LogLevel } = bolt;
import { config } from 'dotenv';
import { HAClient } from '../core/ha-client.js';
import { ClaudeAgent } from '../core/claude-agent.js';
import { Scheduler, CronPresets } from '../core/scheduler.js';

config();

interface ConversationContext {
  agent: ClaudeAgent;
  lastActivity: Date;
}

class SlackBot {
  private app: bolt.App;
  private haClient: HAClient;
  private scheduler: Scheduler;
  private conversations: Map<string, ConversationContext> = new Map();
  private contextTimeout = 30 * 60 * 1000; // 30 分鐘後清除對話上下文
  private defaultChannelId?: string;

  constructor() {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;

    if (!botToken || !appToken) {
      throw new Error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required');
    }

    this.haClient = new HAClient();

    // 建立一個共用的 agent 給 scheduler 使用
    const schedulerAgent = new ClaudeAgent(this.haClient);
    this.scheduler = new Scheduler(schedulerAgent);

    // 設定 scheduler 的通知處理器
    this.scheduler.addNotificationHandler(async (message, _jobId) => {
      await this.sendNotification(message);
    });

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

  private getOrCreateAgent(userId: string): ClaudeAgent {
    let context = this.conversations.get(userId);

    if (!context) {
      context = {
        agent: new ClaudeAgent(this.haClient),
        lastActivity: new Date(),
      };
      this.conversations.set(userId, context);
    } else {
      // 檢查是否過期
      if (Date.now() - context.lastActivity.getTime() > this.contextTimeout) {
        context.agent.clearHistory();
      }
      context.lastActivity = new Date();
    }

    return context.agent;
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
        const agent = this.getOrCreateAgent(userId);
        const response = await agent.chat(text);

        await say({
          text: response.text,
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
        const agent = this.getOrCreateAgent(userId);
        const response = await agent.chat(text);

        await say({
          text: response.text,
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
      const userId = command.user_id;

      if (!text) {
        await respond({
          text: `*智慧家庭助理指令說明*

使用方式：\`/ha <指令>\`

範例：
• \`/ha 列出所有燈具\`
• \`/ha 把客廳的燈打開\`
• \`/ha 現在溫度幾度？\`
• \`/ha status\` - 檢查 Home Assistant 連線
• \`/ha clear\` - 清除對話歷史`,
        });
        return;
      }

      // 特殊指令
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

      if (text.toLowerCase() === 'clear') {
        const context = this.conversations.get(userId);
        if (context) {
          context.agent.clearHistory();
        }
        await respond({
          text: '✅ 對話歷史已清除',
        });
        return;
      }

      // 一般指令
      try {
        const agent = this.getOrCreateAgent(userId);
        const response = await agent.chat(text);

        await respond({
          text: response.text,
        });
      } catch (error) {
        console.error('[Slack] Error processing command:', error);
        await respond({
          text: `抱歉，處理您的請求時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
        });
      }
    });

    // /ha-schedule 指令
    this.app.command('/ha-schedule', async ({ command, ack, respond }) => {
      await ack();

      const args = command.text.trim().split(' ');
      const subCommand = args[0]?.toLowerCase();

      switch (subCommand) {
        case 'list':
          const jobs = this.scheduler.getJobs();
          if (jobs.length === 0) {
            await respond({ text: '目前沒有排程任務' });
          } else {
            const jobList = jobs.map(j =>
              `• *${j.name}* (${j.id})\n  排程：\`${j.cronExpression}\`\n  狀態：${j.enabled ? '✅ 啟用' : '⏸️ 停用'}\n  任務：${j.prompt}`
            ).join('\n\n');
            await respond({ text: `*排程任務列表*\n\n${jobList}` });
          }
          break;

        case 'add':
          // /ha-schedule add <id> <cron> <prompt>
          // 簡化版：使用預設時間
          await respond({
            text: `*新增排程任務*

使用方式：透過程式碼或設定檔新增排程任務。

常用 cron 範例：
• \`0 7 * * *\` - 每天早上 7 點
• \`0 19 * * *\` - 每天晚上 7 點
• \`*/30 * * * *\` - 每 30 分鐘
• \`0 9 * * 1-5\` - 每個工作日早上 9 點`,
          });
          break;

        case 'enable':
          if (args[1]) {
            this.scheduler.enableJob(args[1]);
            await respond({ text: `✅ 已啟用排程：${args[1]}` });
          }
          break;

        case 'disable':
          if (args[1]) {
            this.scheduler.disableJob(args[1]);
            await respond({ text: `⏸️ 已停用排程：${args[1]}` });
          }
          break;

        case 'run':
          if (args[1]) {
            try {
              const result = await this.scheduler.executeJob(args[1]);
              await respond({ text: `執行結果：\n${result}` });
            } catch (error) {
              await respond({ text: `❌ 執行失敗：${error instanceof Error ? error.message : '未知錯誤'}` });
            }
          }
          break;

        default:
          await respond({
            text: `*排程指令說明*

• \`/ha-schedule list\` - 列出所有排程
• \`/ha-schedule enable <id>\` - 啟用排程
• \`/ha-schedule disable <id>\` - 停用排程
• \`/ha-schedule run <id>\` - 立即執行排程`,
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

  /**
   * 載入預設排程
   */
  loadDefaultSchedules(): void {
    // 範例：每天晚上 7 點報告溫濕度
    this.scheduler.addJob({
      id: 'daily-climate-report',
      name: '每日氣候報告',
      cronExpression: CronPresets.everyDay(19, 0),
      prompt: '請告訴我目前家中的溫度和濕度狀況',
      enabled: false, // 預設停用，使用者可自行啟用
    });

    // 範例：每天早上 7 點檢查門窗
    this.scheduler.addJob({
      id: 'morning-security-check',
      name: '早晨安全檢查',
      cronExpression: CronPresets.everyDay(7, 0),
      prompt: '請檢查家中所有門窗感測器的狀態，如果有異常請通知我',
      enabled: false,
    });
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

    // 載入預設排程
    this.loadDefaultSchedules();
    this.scheduler.startAll();

    await this.app.start();
    console.log('⚡️ Slack Bot 已啟動！');
  }

  async stop(): Promise<void> {
    this.scheduler.stopAll();
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
