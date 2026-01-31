import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import cron from 'node-cron';
import { ScheduleStore, type StoredSchedule } from '../core/schedule-store.js';

export const manageScheduleTool: Tool = {
  name: 'manage_schedule',
  description: `管理排程任務。可以新增、列出、啟用、停用或刪除排程。

排程會由獨立的背景服務執行，執行時會使用 Claude 處理 prompt，並將結果發送到 Slack。

常用 cron 表達式範例：
- "0 7 * * *" - 每天早上 7 點
- "0 19 * * *" - 每天晚上 7 點
- "0 8 * * 1-5" - 週一到週五早上 8 點
- "*/30 * * * *" - 每 30 分鐘
- "0 */2 * * *" - 每 2 小時`,
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'enable', 'disable', 'delete'],
        description: '操作類型：create（新增）、list（列出）、enable（啟用）、disable（停用）、delete（刪除）',
      },
      id: {
        type: 'string',
        description: '排程 ID（enable、disable、delete 時需要）',
      },
      name: {
        type: 'string',
        description: '排程名稱（create 時需要），也可用於搜尋排程',
      },
      cron: {
        type: 'string',
        description: 'Cron 表達式（create 時需要），如 "0 19 * * *" 表示每天晚上 7 點',
      },
      prompt: {
        type: 'string',
        description: '執行時的提示（create 時需要），例如「報告目前家裡的溫濕度」',
      },
    },
    required: ['action'],
  },
};

export interface ManageScheduleInput {
  action: 'create' | 'list' | 'enable' | 'disable' | 'delete';
  id?: string;
  name?: string;
  cron?: string;
  prompt?: string;
}

// 全域 store 實例
let storeInstance: ScheduleStore | null = null;

async function getStore(): Promise<ScheduleStore> {
  if (!storeInstance) {
    storeInstance = new ScheduleStore();
    await storeInstance.init();
  }
  return storeInstance;
}

/**
 * 人類可讀的 cron 表達式說明
 */
function describeCron(cronExpr: string): string {
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) return cronExpr;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // 簡單的常見模式
  if (dayOfMonth === '*' && month === '*') {
    let timeStr = '';

    if (minute !== '*' && hour !== '*') {
      timeStr = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    } else if (minute.startsWith('*/')) {
      return `每 ${minute.slice(2)} 分鐘`;
    } else if (hour.startsWith('*/')) {
      return `每 ${hour.slice(2)} 小時`;
    }

    if (dayOfWeek === '*') {
      return `每天 ${timeStr}`;
    } else if (dayOfWeek === '1-5') {
      return `週一到週五 ${timeStr}`;
    } else if (dayOfWeek === '0,6') {
      return `週末 ${timeStr}`;
    } else if (dayOfWeek === '0') {
      return `每週日 ${timeStr}`;
    } else if (dayOfWeek === '1') {
      return `每週一 ${timeStr}`;
    }
  }

  return cronExpr;
}

/**
 * 格式化排程資訊
 */
function formatSchedule(schedule: StoredSchedule): Record<string, unknown> {
  return {
    id: schedule.id,
    name: schedule.name,
    cron: schedule.cronExpression,
    cronDescription: describeCron(schedule.cronExpression),
    prompt: schedule.prompt,
    enabled: schedule.enabled,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

export async function executeManageSchedule(
  input: ManageScheduleInput
): Promise<string> {
  const store = await getStore();

  try {
    switch (input.action) {
      case 'create': {
        if (!input.name) {
          return JSON.stringify({
            success: false,
            error: '請提供排程名稱 (name)',
          });
        }
        if (!input.cron) {
          return JSON.stringify({
            success: false,
            error: '請提供 cron 表達式 (cron)',
          });
        }
        if (!input.prompt) {
          return JSON.stringify({
            success: false,
            error: '請提供執行提示 (prompt)',
          });
        }

        // 驗證 cron 表達式
        if (!cron.validate(input.cron)) {
          return JSON.stringify({
            success: false,
            error: `無效的 cron 表達式: ${input.cron}`,
          });
        }

        const schedule = await store.create({
          name: input.name,
          cronExpression: input.cron,
          prompt: input.prompt,
          enabled: true,
        });

        return JSON.stringify({
          success: true,
          message: `排程「${schedule.name}」已建立`,
          schedule: formatSchedule(schedule),
        });
      }

      case 'list': {
        const schedules = store.getAll();

        if (schedules.length === 0) {
          return JSON.stringify({
            success: true,
            message: '目前沒有任何排程',
            count: 0,
            schedules: [],
          });
        }

        return JSON.stringify({
          success: true,
          count: schedules.length,
          schedules: schedules.map(formatSchedule),
        });
      }

      case 'enable': {
        const schedule = findSchedule(store, input);
        if (!schedule) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的排程，請提供 id 或 name',
          });
        }

        await store.enable(schedule.id);

        return JSON.stringify({
          success: true,
          message: `排程「${schedule.name}」已啟用`,
          schedule: formatSchedule({ ...schedule, enabled: true }),
        });
      }

      case 'disable': {
        const schedule = findSchedule(store, input);
        if (!schedule) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的排程，請提供 id 或 name',
          });
        }

        await store.disable(schedule.id);

        return JSON.stringify({
          success: true,
          message: `排程「${schedule.name}」已停用`,
          schedule: formatSchedule({ ...schedule, enabled: false }),
        });
      }

      case 'delete': {
        const schedule = findSchedule(store, input);
        if (!schedule) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的排程，請提供 id 或 name',
          });
        }

        await store.delete(schedule.id);

        return JSON.stringify({
          success: true,
          message: `排程「${schedule.name}」已刪除`,
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

/**
 * 透過 id 或 name 尋找排程
 */
function findSchedule(store: ScheduleStore, input: ManageScheduleInput): StoredSchedule | undefined {
  if (input.id) {
    return store.get(input.id);
  }
  if (input.name) {
    return store.findByName(input.name);
  }
  return undefined;
}
