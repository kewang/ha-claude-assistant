#!/usr/bin/env node
/**
 * 排程服務 Daemon
 *
 * 獨立背景服務，監控 schedules.json 並在指定時間執行排程任務。
 * 執行時會呼叫 `claude --print "prompt"`，並將結果發送到 Slack。
 *
 * 使用方式：
 *   npm run scheduler
 *   或用 PM2: pm2 start dist/interfaces/scheduler-daemon.js --name ha-scheduler
 */

import { config } from 'dotenv';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { spawn } from 'child_process';
import { WebClient } from '@slack/web-api';
import { ScheduleStore, type StoredSchedule } from '../core/schedule-store.js';

config();

// Slack 設定
const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = process.env.SLACK_DEFAULT_CHANNEL;

let slackClient: WebClient | null = null;
if (slackToken) {
  slackClient = new WebClient(slackToken);
}

// 排程管理
const store = new ScheduleStore();
const activeTasks: Map<string, ScheduledTask> = new Map();
const timezone = process.env.TZ || 'Asia/Taipei';

// 預設 timeout 1 分鐘
const CLAUDE_TIMEOUT_MS = 1 * 60 * 1000;

/**
 * 發送訊息到 Slack
 */
async function sendToSlack(message: string): Promise<void> {
  if (!slackClient || !slackChannel) {
    console.log('[Scheduler] Slack not configured, skipping notification');
    console.log('[Scheduler] Message:', message);
    return;
  }

  try {
    await slackClient.chat.postMessage({
      channel: slackChannel,
      text: message,
      mrkdwn: true,
    });
    console.log('[Scheduler] Sent to Slack');
  } catch (error) {
    console.error('[Scheduler] Failed to send to Slack:', error);
  }
}

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = `${process.env.HOME}/.local/bin/claude`;
    const startTime = Date.now();

    console.log(`[Scheduler] Running: ${claudePath} --print "${prompt.substring(0, 80)}..."`);

    // 使用 acceptEdits 模式允許 MCP 工具寫入檔案（如排程設定）
    const child = spawn(claudePath, ['--print', '--permission-mode', 'acceptEdits', prompt], {
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
      },
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
      console.error(`[Scheduler] Claude stderr: ${data.toString().trim()}`);
    });

    const timeout = setTimeout(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.error(`[Scheduler] Timeout after ${elapsed}s, stdout length: ${stdout.length}, stderr length: ${stderr.length}`);
      child.kill('SIGTERM');
      reject(new Error(`Claude 執行超時（${Math.round(CLAUDE_TIMEOUT_MS / 60000)} 分鐘）`));
    }, CLAUDE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stderr) {
        console.error('[Scheduler] Claude stderr:', stderr);
      }

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        console.error(`[Scheduler] Claude exited with code ${code}`);
        console.error('[Scheduler] stdout:', stdout);
        console.error('[Scheduler] stderr:', stderr);
        reject(new Error(`Claude 執行失敗 (exit code: ${code})`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Claude 執行錯誤: ${error.message}`));
    });
  });
}

/**
 * 執行排程任務
 */
async function executeSchedule(schedule: StoredSchedule): Promise<void> {
  console.log(`[Scheduler] Executing: ${schedule.name} (${schedule.id})`);

  const startTime = new Date();

  try {
    const result = await executeClaudePrompt(schedule.prompt);

    const message = [
      `📋 *排程任務執行完成*`,
      `*名稱*: ${schedule.name}`,
      `*時間*: ${startTime.toLocaleString('zh-TW', { timeZone: timezone })}`,
      '',
      result,
    ].join('\n');

    await sendToSlack(message);

    console.log(`[Scheduler] Completed: ${schedule.name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    const message = [
      `❌ *排程任務執行失敗*`,
      `*名稱*: ${schedule.name}`,
      `*時間*: ${startTime.toLocaleString('zh-TW', { timeZone: timezone })}`,
      `*錯誤*: ${errorMsg}`,
    ].join('\n');

    await sendToSlack(message);

    console.error(`[Scheduler] Failed: ${schedule.name}`, error);
  }
}

/**
 * 啟動單一排程
 */
function startSchedule(schedule: StoredSchedule): void {
  // 停止現有任務（如果有）
  stopSchedule(schedule.id);

  if (!schedule.enabled) {
    return;
  }

  if (!cron.validate(schedule.cronExpression)) {
    console.error(`[Scheduler] Invalid cron for ${schedule.name}: ${schedule.cronExpression}`);
    return;
  }

  const task = cron.schedule(
    schedule.cronExpression,
    () => {
      executeSchedule(schedule).catch(console.error);
    },
    { timezone }
  );

  activeTasks.set(schedule.id, task);
  console.log(`[Scheduler] Started: ${schedule.name} (${schedule.cronExpression})`);
}

/**
 * 停止單一排程
 */
function stopSchedule(id: string): void {
  const task = activeTasks.get(id);
  if (task) {
    task.stop();
    activeTasks.delete(id);
  }
}

/**
 * 重新載入所有排程
 */
async function reloadSchedules(): Promise<void> {
  console.log('[Scheduler] Reloading schedules...');

  // 停止所有現有任務
  for (const task of activeTasks.values()) {
    task.stop();
  }
  activeTasks.clear();

  // 重新載入
  await store.load();
  const schedules = store.getAll();

  console.log(`[Scheduler] Found ${schedules.length} schedule(s)`);

  // 啟動所有已啟用的排程
  for (const schedule of schedules) {
    if (schedule.enabled) {
      startSchedule(schedule);
    }
  }

  console.log(`[Scheduler] Active schedules: ${activeTasks.size}`);
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log('[Scheduler] Starting scheduler daemon...');
  console.log(`[Scheduler] Timezone: ${timezone}`);

  if (slackClient && slackChannel) {
    console.log(`[Scheduler] Slack channel: ${slackChannel}`);
  } else {
    console.log('[Scheduler] Slack not configured (SLACK_BOT_TOKEN or SLACK_DEFAULT_CHANNEL missing)');
  }

  // 初始化 store
  await store.init();

  // 載入並啟動所有排程
  await reloadSchedules();

  // 監控檔案變更
  await store.startWatching(() => {
    console.log('[Scheduler] Schedule file changed, reloading...');
    reloadSchedules().catch(console.error);
  });

  console.log('[Scheduler] Daemon running. Press Ctrl+C to stop.');

  // 優雅關閉
  process.on('SIGINT', () => {
    console.log('\n[Scheduler] Shutting down...');
    store.stopWatching();
    for (const task of activeTasks.values()) {
      task.stop();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[Scheduler] Received SIGTERM, shutting down...');
    store.stopWatching();
    for (const task of activeTasks.values()) {
      task.stop();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[Scheduler] Fatal error:', error);
  process.exit(1);
});
