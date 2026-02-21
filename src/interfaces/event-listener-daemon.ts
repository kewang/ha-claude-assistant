#!/usr/bin/env node
/**
 * 事件監聽服務 Daemon
 *
 * 獨立背景服務，透過 HA WebSocket API 監聽事件，
 * 比對訂閱規則後呼叫 Claude CLI 生成友善通知訊息，發送到 Slack。
 *
 * 使用方式：
 *   npm run event-listener
 */

import { config } from 'dotenv';
import { spawn } from 'child_process';
import { HAWebSocket, type HAEvent } from '../core/ha-websocket.js';
import { HAClient } from '../core/ha-client.js';
import { EventSubscriptionStore, type StoredEventSubscription } from '../core/event-subscription-store.js';
import { getNotificationManager } from '../core/notification/index.js';
import { detectEnvironment } from '../core/env-detect.js';
import { getTokenRefreshService } from '../core/claude-token-refresh.js';
import { createLogger } from '../utils/logger.js';
import { VERSION } from '../version.js';

config();

const logger = createLogger('EventListener');

const env = detectEnvironment();
const timezone = process.env.TZ || 'Asia/Taipei';
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || '', 10) || 3 * 60 * 1000;

// Concurrency control
const MAX_CONCURRENT = 3;
const MAX_QUEUE_SIZE = 20;
let activeExecutions = 0;
const eventQueue: Array<{ event: HAEvent; subscription: StoredEventSubscription }> = [];

const store = new EventSubscriptionStore();
const notificationManager = getNotificationManager();
const haClient = new HAClient();
let haWebSocket: HAWebSocket;

// Track which event types we've subscribed to on the WebSocket
const wsSubscribedTypes = new Set<string>();

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
 * 檢查是否為 token 過期問題
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
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<ClaudeExecutionResult> {
  return new Promise((resolve) => {
    const claudePath = env.claudePath;

    logger.info(`Running Claude CLI...`);

    const spawnEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
    };

    if (env.claudeConfigDir) {
      spawnEnv.CLAUDE_CONFIG_DIR = env.claudeConfigDir;
    }

    const child = spawn(claudePath, ['--print', '--permission-mode', 'bypassPermissions', prompt], {
      env: spawnEnv,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
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
      if (code === 0) {
        resolve({ success: true, output: stdout.trim(), stdout, stderr, exitCode: code });
      } else {
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
 * 萬用字元比對（支援 * 和 ?）
 */
function matchWildcard(pattern: string, text: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(text);
}

/**
 * 取得自動化設定（包含 trigger、condition、action）
 */
async function fetchAutomationConfig(entityId: string): Promise<Record<string, unknown> | null> {
  try {
    const state = await haClient.getState(entityId);
    const automationId = state.attributes.id as string | undefined;
    if (!automationId) {
      logger.warn(`No automation id found in attributes for ${entityId}`);
      return null;
    }

    const baseUrl = haClient.getCurrentUrl();
    const response = await fetch(`${baseUrl}/api/config/automation/config/${automationId}`, {
      headers: {
        'Authorization': `Bearer ${env.isAddon ? process.env.SUPERVISOR_TOKEN : process.env.HA_TOKEN}`,
      },
    });
    if (!response.ok) {
      logger.warn(`Failed to fetch automation config: HTTP ${response.status}`);
      return null;
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    logger.warn(`Failed to fetch automation config for ${entityId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 建立 Claude prompt
 */
function buildEventPrompt(event: HAEvent, subscription: StoredEventSubscription, automationConfig?: Record<string, unknown> | null): string {
  const time = new Date(event.time_fired).toLocaleString('zh-TW', { timeZone: timezone });

  const parts = [
    '你收到了一個 Home Assistant 事件通知，請根據以下資訊生成簡潔友善的繁體中文通知訊息。',
    '',
    `事件類型: ${event.event_type}`,
    `觸發時間: ${time}`,
  ];

  const data = event.data;

  // automation_triggered 事件
  if (event.event_type === 'automation_triggered' && data.entity_id) {
    parts.push(`自動化 ID: ${data.entity_id}`);
    if (data.name) parts.push(`自動化名稱: ${data.name}`);
    if (data.source) parts.push(`觸發來源: ${data.source}`);
    if (automationConfig?.actions) {
      parts.push(`自動化動作: ${JSON.stringify(automationConfig.actions, null, 2)}`);
    }
    if (automationConfig?.description) {
      parts.push(`自動化描述: ${automationConfig.description}`);
    }
  }

  // state_changed 事件
  if (event.event_type === 'state_changed') {
    if (data.entity_id) parts.push(`實體 ID: ${data.entity_id}`);
    const oldState = data.old_state as Record<string, unknown> | undefined;
    const newState = data.new_state as Record<string, unknown> | undefined;
    if (oldState?.state !== undefined && newState?.state !== undefined) {
      parts.push(`狀態變化: ${oldState.state} → ${newState.state}`);
    }
    if (newState?.attributes) {
      const attrs = newState.attributes as Record<string, unknown>;
      if (attrs.friendly_name) parts.push(`裝置名稱: ${attrs.friendly_name}`);
    }
  }

  // 其他事件類型：直接附上 data
  if (event.event_type !== 'automation_triggered' && event.event_type !== 'state_changed') {
    parts.push(`事件資料: ${JSON.stringify(data, null, 2)}`);
  }

  parts.push('');
  parts.push(`使用者要求: ${subscription.description}`);
  parts.push('');
  parts.push('請直接輸出通知訊息內容，不要加入其他說明文字。訊息要簡潔，適合在 Slack 閱讀。');

  return parts.join('\n');
}

/**
 * 處理單一事件
 */
async function processEvent(event: HAEvent, subscription: StoredEventSubscription): Promise<void> {
  logger.info(`Processing event: ${event.event_type} for subscription "${subscription.name}"`);

  const tokenService = getTokenRefreshService();

  // 確保 token 有效
  const tokenResult = await tokenService.ensureValidToken();
  if (!tokenResult.success && tokenResult.needsRelogin) {
    const message = [
      `❌ *事件通知處理失敗*`,
      `*訂閱*: ${subscription.name}`,
      `*錯誤*: Token 已過期，需要重新登入`,
    ].join('\n');

    await notificationManager.send({ text: message, markdown: message, source: 'event' });
    return;
  }

  // 取得自動化設定（如適用）
  let automationConfig: Record<string, unknown> | null = null;
  if (event.event_type === 'automation_triggered' && event.data.entity_id) {
    automationConfig = await fetchAutomationConfig(event.data.entity_id as string);
  }

  // 建立 prompt 並執行 Claude CLI
  const prompt = buildEventPrompt(event, subscription, automationConfig);
  let result = await executeClaudePrompt(prompt);

  // Token 過期重試
  if (!result.success && isTokenExpiredError(result.stdout, result.stderr)) {
    logger.info('Token expired during execution, refreshing and retrying...');
    const refreshResult = await tokenService.refreshToken();
    if (refreshResult.success) {
      result = await executeClaudePrompt(prompt);
    }
  }

  // 發送通知
  if (result.success) {
    await notificationManager.send({
      text: result.output,
      markdown: result.output,
      source: 'event',
      metadata: {
        eventType: event.event_type,
        subscriptionName: subscription.name,
      },
    });
    logger.info(`Notification sent for "${subscription.name}"`);
  } else {
    const errorMsg = result.error?.message || 'Unknown error';
    const message = [
      `❌ *事件通知處理失敗*`,
      `*訂閱*: ${subscription.name}`,
      `*事件*: ${event.event_type}`,
      `*錯誤*: ${errorMsg}`,
    ].join('\n');

    await notificationManager.send({ text: message, markdown: message, source: 'event' });
    logger.error(`Failed to process event for "${subscription.name}":`, errorMsg);
  }
}

/**
 * 並發控制：嘗試從佇列取出並執行
 */
function drainQueue(): void {
  while (activeExecutions < MAX_CONCURRENT && eventQueue.length > 0) {
    const item = eventQueue.shift()!;
    activeExecutions++;

    processEvent(item.event, item.subscription)
      .catch((error) => logger.error('Process event error:', error))
      .finally(() => {
        activeExecutions--;
        drainQueue();
      });
  }
}

/**
 * 入隊事件
 */
function enqueueEvent(event: HAEvent, subscription: StoredEventSubscription): void {
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    logger.warn(`Queue full (${MAX_QUEUE_SIZE}), dropping oldest event`);
    eventQueue.shift();
  }

  eventQueue.push({ event, subscription });
  drainQueue();
}

/**
 * 事件處理入口
 */
function handleEvent(event: HAEvent): void {
  const subscriptions = store.getAll().filter(sub => sub.enabled);

  for (const sub of subscriptions) {
    // 比對事件類型
    if (sub.eventType !== event.event_type) continue;

    // 比對 entity filter（支援包含和 ! 前綴排除）
    if (sub.entityFilter && sub.entityFilter.length > 0) {
      const entityId = (event.data.entity_id as string) ||
        (event.data.new_state as Record<string, unknown>)?.entity_id as string || '';

      const includePatterns = sub.entityFilter.filter(p => !p.startsWith('!'));
      const excludePatterns = sub.entityFilter.filter(p => p.startsWith('!')).map(p => p.slice(1));

      // 排除優先：匹配任一排除 pattern 則跳過
      if (excludePatterns.length > 0 && excludePatterns.some(pattern => matchWildcard(pattern, entityId))) {
        continue;
      }

      // 包含：有包含 pattern 時，必須匹配任一才通過
      if (includePatterns.length > 0 && !includePatterns.some(pattern => matchWildcard(pattern, entityId))) {
        continue;
      }
    }

    enqueueEvent(event, sub);
  }
}

/**
 * 取得所有啟用訂閱的不重複事件類型
 */
function getActiveEventTypes(): Set<string> {
  const types = new Set<string>();
  for (const sub of store.getAll()) {
    if (sub.enabled) {
      types.add(sub.eventType);
    }
  }
  return types;
}

/**
 * 同步 WebSocket 訂閱：新增缺少的、移除多餘的
 */
function syncWebSocketSubscriptions(): void {
  const activeTypes = getActiveEventTypes();

  // 訂閱新的事件類型
  for (const eventType of activeTypes) {
    if (!wsSubscribedTypes.has(eventType)) {
      haWebSocket.subscribeEvents(eventType);
      wsSubscribedTypes.add(eventType);
    }
  }

  // 注意：HA WebSocket API 不容易取消特定 event type 訂閱
  // 因為 unsubscribe 需要 subscription ID（不是 event type）
  // 所以我們只記錄差異，不主動取消（多收到的事件會在 handleEvent 中被過濾掉）
  for (const eventType of wsSubscribedTypes) {
    if (!activeTypes.has(eventType)) {
      logger.info(`Event type "${eventType}" no longer has active subscriptions, events will be filtered`);
    }
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  logger.info(`Starting event listener daemon v${VERSION}...`);
  logger.info(`Timezone: ${timezone}`);

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_DEFAULT_CHANNEL) {
    logger.info(`Slack channel: ${process.env.SLACK_DEFAULT_CHANNEL}`);
  } else {
    logger.info('Slack not configured');
  }

  // 初始化 Token 刷新服務
  const tokenRefreshService = getTokenRefreshService();
  tokenRefreshService.setNotificationCallback(async (message: string) => {
    await notificationManager.send({ text: message, markdown: message, source: 'event' });
  });
  tokenRefreshService.start();
  logger.info('Token refresh service started');

  // 初始化 store
  await store.init();

  // 若 store 為空，自動建立預設的 automation_triggered 訂閱
  if (store.getAll().length === 0) {
    logger.info('No subscriptions found, creating default automation_triggered subscription...');
    await store.create({
      name: '自動化觸發通知',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: '當 Home Assistant 自動化被觸發時，生成友善的通知訊息',
      enabled: true,
    });
  }

  const subscriptions = store.getAll();
  logger.info(`Found ${subscriptions.length} subscription(s), ${subscriptions.filter(s => s.enabled).length} enabled`);

  // 連接 WebSocket
  haWebSocket = new HAWebSocket();

  haWebSocket.onEvent(handleEvent);

  haWebSocket.onReconnectedEvent(() => {
    logger.info('WebSocket reconnected, re-subscribing...');
    wsSubscribedTypes.clear();
    syncWebSocketSubscriptions();
  });

  haWebSocket.onConnectionFailedEvent(async () => {
    const message = '❌ *Event Listener*: WebSocket 連線失敗，已超過最大重連次數';
    await notificationManager.send({ text: message, markdown: message, source: 'event' });
  });

  try {
    await haWebSocket.connect();
    logger.info('WebSocket connected');
  } catch (error) {
    logger.error('Failed to connect WebSocket:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // 訂閱事件
  syncWebSocketSubscriptions();

  // 監控訂閱檔案變更
  await store.startWatching(() => {
    logger.info('Subscription file changed, syncing...');
    syncWebSocketSubscriptions();
  });

  logger.info('Daemon running. Press Ctrl+C to stop.');

  // 優雅關閉
  const shutdown = () => {
    logger.info('Shutting down...');
    tokenRefreshService.stop();
    store.stopWatching();
    haWebSocket.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
