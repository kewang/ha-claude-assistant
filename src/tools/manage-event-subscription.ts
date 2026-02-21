import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { EventSubscriptionStore, type StoredEventSubscription } from '../core/event-subscription-store.js';

export const manageEventSubscriptionTool: Tool = {
  name: 'manage_event_subscription',
  description: `管理事件訂閱。可以新增、列出、啟用、停用或刪除事件訂閱。

事件訂閱會由 Event Listener 背景服務監聽 Home Assistant WebSocket API，當事件觸發時，透過 Claude 生成友善通知訊息發送到 Slack。

常見事件類型：
- "automation_triggered" — 自動化觸發時通知
- "state_changed" — 實體狀態變更時通知（建議搭配 entity_filter 使用）
- "call_service" — 服務呼叫時通知
- "script_started" — 腳本執行時通知

注意：state_changed 事件頻率較高，建議設定 entity_filter 過濾特定實體，避免大量通知。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'enable', 'disable', 'delete'],
        description: '操作類型：create（新增）、list（列出）、enable（啟用）、disable（停用）、delete（刪除）',
      },
      name: {
        type: 'string',
        description: '訂閱名稱（create 時必填），也可用於搜尋訂閱',
      },
      event_type: {
        type: 'string',
        description: 'HA 事件類型（create 時必填），如 "automation_triggered"、"state_changed"',
      },
      entity_filter: {
        type: 'array',
        items: { type: 'string' },
        description: '可選的 entity_id 過濾條件陣列，每個元素為一個 pattern，支援 * 萬用字元。以 ! 開頭表示排除。如 ["binary_sensor.front_*"]（包含）、["!automation.ac_*"]（排除）。automation_triggered 事件的 entity_id 格式為 automation.xxx。',
      },
      description: {
        type: 'string',
        description: '給 Claude 的提示，描述如何生成通知訊息，如「用簡短的方式通知門被打開了」',
      },
      id: {
        type: 'string',
        description: '訂閱 ID（enable、disable、delete 時使用）',
      },
    },
    required: ['action'],
  },
};

export interface ManageEventSubscriptionInput {
  action: 'create' | 'list' | 'enable' | 'disable' | 'delete';
  name?: string;
  event_type?: string;
  entity_filter?: string[];
  description?: string;
  id?: string;
}

let storeInstance: EventSubscriptionStore | null = null;

async function getStore(): Promise<EventSubscriptionStore> {
  if (!storeInstance) {
    storeInstance = new EventSubscriptionStore();
    await storeInstance.init();
  }
  return storeInstance;
}

function formatSubscription(sub: StoredEventSubscription): Record<string, unknown> {
  return {
    id: sub.id,
    name: sub.name,
    eventType: sub.eventType,
    entityFilter: sub.entityFilter,
    description: sub.description,
    enabled: sub.enabled,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

function findSubscription(store: EventSubscriptionStore, input: ManageEventSubscriptionInput): StoredEventSubscription | undefined {
  if (input.id) {
    return store.get(input.id);
  }
  if (input.name) {
    return store.findByName(input.name);
  }
  return undefined;
}

export async function executeManageEventSubscription(
  input: ManageEventSubscriptionInput
): Promise<string> {
  const store = await getStore();

  try {
    switch (input.action) {
      case 'create': {
        if (!input.name) {
          return JSON.stringify({
            success: false,
            error: '請提供訂閱名稱 (name)',
          });
        }
        if (!input.event_type) {
          return JSON.stringify({
            success: false,
            error: '請提供事件類型 (event_type)，如 "automation_triggered" 或 "state_changed"',
          });
        }

        const subscription = await store.create({
          name: input.name,
          eventType: input.event_type,
          entityFilter: input.entity_filter || null,
          description: input.description || '請生成友善的繁體中文通知訊息',
          enabled: true,
        });

        return JSON.stringify({
          success: true,
          message: `事件訂閱「${subscription.name}」已建立`,
          subscription: formatSubscription(subscription),
        });
      }

      case 'list': {
        const subscriptions = store.getAll();

        if (subscriptions.length === 0) {
          return JSON.stringify({
            success: true,
            message: '目前沒有任何事件訂閱',
            count: 0,
            subscriptions: [],
          });
        }

        return JSON.stringify({
          success: true,
          count: subscriptions.length,
          subscriptions: subscriptions.map(formatSubscription),
        });
      }

      case 'enable': {
        const sub = findSubscription(store, input);
        if (!sub) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的訂閱，請提供 id 或 name',
          });
        }

        await store.enable(sub.id);
        return JSON.stringify({
          success: true,
          message: `事件訂閱「${sub.name}」已啟用`,
          subscription: formatSubscription({ ...sub, enabled: true }),
        });
      }

      case 'disable': {
        const sub = findSubscription(store, input);
        if (!sub) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的訂閱，請提供 id 或 name',
          });
        }

        await store.disable(sub.id);
        return JSON.stringify({
          success: true,
          message: `事件訂閱「${sub.name}」已停用`,
          subscription: formatSubscription({ ...sub, enabled: false }),
        });
      }

      case 'delete': {
        const sub = findSubscription(store, input);
        if (!sub) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的訂閱，請提供 id 或 name',
          });
        }

        await store.delete(sub.id);
        return JSON.stringify({
          success: true,
          message: `事件訂閱「${sub.name}」已刪除`,
        });
      }

      default:
        return JSON.stringify({
          success: false,
          error: `未知的操作: ${input.action}`,
        });
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
