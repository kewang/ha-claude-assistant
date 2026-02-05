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
import { detectEnvironment } from '../core/env-detect.js';
import { getTokenRefreshService } from '../core/claude-token-refresh.js';
import { createLogger } from '../utils/logger.js';
import { VERSION } from '../version.js';

config();

const logger = createLogger('Scheduler');

// 取得環境設定
const env = detectEnvironment();

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
 * Claude CLI 執行結果
 */
interface ClaudeExecutionResult {
  success: boolean;
  output: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: Error;
}

/**
 * 檢查錯誤是否為 token 過期問題
 */
function isTokenExpiredError(stdout: string, stderr: string): boolean {
  const combined = stdout + stderr;
  return (
    combined.includes('401') ||
    combined.includes('authentication_error') ||
    combined.includes('OAuth token has expired') ||
    (combined.includes('token') && combined.includes('expired'))
  );
}

/**
 * 發送訊息到 Slack
 */
async function sendToSlack(message: string): Promise<void> {
  if (!slackClient || !slackChannel) {
    logger.info('Slack not configured, skipping notification');
    logger.info('Message:', message);
    return;
  }

  try {
    await slackClient.chat.postMessage({
      channel: slackChannel,
      text: message,
      mrkdwn: true,
    });
    logger.info('Sent to Slack');
  } catch (error) {
    logger.error('Failed to send to Slack:', error);
  }
}

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<ClaudeExecutionResult> {
  return new Promise((resolve) => {
    const claudePath = env.claudePath;
    const startTime = Date.now();

    logger.info(`Running: ${claudePath} --print "${prompt.substring(0, 80)}..."`);

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
      resolve({
        success: false,
        output: '',
        stdout,
        stderr,
        exitCode: null,
        error: new Error(`Claude 執行超時（${Math.round(CLAUDE_TIMEOUT_MS / 60000)} 分鐘）`),
      });
    }, CLAUDE_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stderr) {
        logger.error('Claude stderr:', stderr);
      }

      if (code === 0) {
        resolve({
          success: true,
          output: stdout.trim(),
          stdout,
          stderr,
          exitCode: code,
        });
      } else {
        logger.error(`Claude exited with code ${code}`);
        logger.error('stdout:', stdout);
        logger.error('stderr:', stderr);
        resolve({
          success: false,
          output: '',
          stdout,
          stderr,
          exitCode: code,
          error: new Error(`Claude 執行失敗 (exit code: ${code})`),
        });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: '',
        stdout,
        stderr,
        exitCode: null,
        error: new Error(`Claude 執行錯誤: ${error.message}`),
      });
    });
  });
}

/**
 * 執行排程任務
 */
async function executeSchedule(schedule: StoredSchedule): Promise<void> {
  logger.info(`Executing: ${schedule.name} (${schedule.id})`);

  const startTime = new Date();
  const tokenService = getTokenRefreshService();

  // 1. 執行前確保 token 有效
  const tokenResult = await tokenService.ensureValidToken();
  if (!tokenResult.success && tokenResult.needsRelogin) {
    // Token 完全失效，需要重新登入，發送通知
    const message = [
      `❌ *排程任務執行失敗*`,
      `*名稱*: ${schedule.name}`,
      `*時間*: ${startTime.toLocaleString('zh-TW', { timeZone: timezone })}`,
      `*錯誤*: Token 已過期，需要重新登入`,
    ].join('\n');

    await sendToSlack(message);
    logger.error(`Failed: ${schedule.name} - Token needs relogin`);
    return;
  }

  // 2. 第一次執行
  let result = await executeClaudePrompt(schedule.prompt);

  // 3. 如果失敗且是 token 問題，嘗試刷新並重試
  if (!result.success && isTokenExpiredError(result.stdout, result.stderr)) {
    logger.info('Token expired during execution, refreshing and retrying...');

    const refreshResult = await tokenService.refreshToken();
    if (refreshResult.success) {
      logger.info('Token refreshed, retrying execution...');
      // 重試一次
      result = await executeClaudePrompt(schedule.prompt);
    } else {
      logger.error('Token refresh failed:', refreshResult.message);
    }
  }

  // 4. 根據最終結果發送通知
  if (result.success) {
    const message = [
      `📋 *排程任務執行完成*`,
      `*名稱*: ${schedule.name}`,
      `*時間*: ${startTime.toLocaleString('zh-TW', { timeZone: timezone })}`,
      '',
      result.output,
    ].join('\n');

    await sendToSlack(message);
    logger.info(`Completed: ${schedule.name}`);
  } else {
    const errorMsg = result.error?.message || 'Unknown error';

    const message = [
      `❌ *排程任務執行失敗*`,
      `*名稱*: ${schedule.name}`,
      `*時間*: ${startTime.toLocaleString('zh-TW', { timeZone: timezone })}`,
      `*錯誤*: ${errorMsg}`,
    ].join('\n');

    await sendToSlack(message);
    logger.error(`Failed: ${schedule.name}`, result.error);
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
    logger.error(`Invalid cron for ${schedule.name}: ${schedule.cronExpression}`);
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
  logger.info(`Started: ${schedule.name} (${schedule.cronExpression})`);
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
  logger.info('Reloading schedules...');

  // 停止所有現有任務
  for (const task of activeTasks.values()) {
    task.stop();
  }
  activeTasks.clear();

  // 重新載入
  await store.load();
  const schedules = store.getAll();

  logger.info(`Found ${schedules.length} schedule(s)`);

  // 啟動所有已啟用的排程
  for (const schedule of schedules) {
    if (schedule.enabled) {
      startSchedule(schedule);
    }
  }

  logger.info(`Active schedules: ${activeTasks.size}`);
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  logger.info(`Starting scheduler daemon v${VERSION}...`);
  logger.info(`Timezone: ${timezone}`);

  if (slackClient && slackChannel) {
    logger.info(`Slack channel: ${slackChannel}`);
  } else {
    logger.info('Slack not configured (SLACK_BOT_TOKEN or SLACK_DEFAULT_CHANNEL missing)');
  }

  // 初始化 Token 刷新服務
  const tokenRefreshService = getTokenRefreshService();

  // 設定 Slack 通知回呼
  if (slackClient && slackChannel) {
    tokenRefreshService.setNotificationCallback(async (message: string) => {
      await sendToSlack(message);
    });
  }

  // 啟動 Token 刷新服務
  tokenRefreshService.start();
  logger.info('Token refresh service started');

  // 初始化 store
  await store.init();

  // 載入並啟動所有排程
  await reloadSchedules();

  // 監控檔案變更
  await store.startWatching(() => {
    logger.info('Schedule file changed, reloading...');
    reloadSchedules().catch((err) => logger.error('Reload failed:', err));
  });

  logger.info('Daemon running. Press Ctrl+C to stop.');

  // 優雅關閉
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    tokenRefreshService.stop();
    store.stopWatching();
    for (const task of activeTasks.values()) {
      task.stop();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    tokenRefreshService.stop();
    store.stopWatching();
    for (const task of activeTasks.values()) {
      task.stop();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
