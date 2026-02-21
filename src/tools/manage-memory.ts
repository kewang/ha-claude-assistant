import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { MemoryStore, type Memory } from '../core/memory-store.js';

export const manageMemoryTool: Tool = {
  name: 'manage_memory',
  description: `管理長期記憶。可以儲存、列出、搜尋、更新或刪除記憶。

記憶會跨對話持久保存，用於記住使用者偏好、設備暱稱、生活習慣等資訊。

使用時機：
- 使用者明確要求「記住」某件事
- 從對話中發現值得長期記住的偏好或事實
- 使用者要求「忘掉」某件事

記憶內容建議簡潔明確，例如：
- "使用者偏好冷氣溫度 24°C"
- "書桌燈的 entity_id 是 light.office_desk"
- "使用者每天早上 7 點起床"`,
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['save', 'list', 'search', 'update', 'delete'],
        description: '操作類型：save（儲存）、list（列出）、search（搜尋）、update（更新）、delete（刪除）',
      },
      content: {
        type: 'string',
        description: '記憶內容（save、update 時需要）',
      },
      id: {
        type: 'string',
        description: '記憶 ID（update、delete 時需要）',
      },
      search: {
        type: 'string',
        description: '搜尋關鍵字（search 時需要）',
      },
    },
    required: ['action'],
  },
};

export interface ManageMemoryInput {
  action: 'save' | 'list' | 'search' | 'update' | 'delete';
  content?: string;
  id?: string;
  search?: string;
}

// 全域 store 實例
let storeInstance: MemoryStore | null = null;

async function getStore(): Promise<MemoryStore> {
  if (!storeInstance) {
    storeInstance = new MemoryStore();
    await storeInstance.init();
  }
  return storeInstance;
}

function formatMemory(memory: Memory): Record<string, unknown> {
  return {
    id: memory.id,
    content: memory.content,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

export async function executeManageMemory(
  input: ManageMemoryInput
): Promise<string> {
  const store = await getStore();

  try {
    switch (input.action) {
      case 'save': {
        if (!input.content) {
          return JSON.stringify({
            success: false,
            error: '請提供記憶內容 (content)',
          });
        }

        const result = await store.add(input.content);

        if ('error' in result) {
          return JSON.stringify({
            success: false,
            error: result.error,
            count: store.getAll().length,
          });
        }

        return JSON.stringify({
          success: true,
          message: '記憶已儲存',
          memory: formatMemory(result),
        });
      }

      case 'list': {
        const memories = store.getAll();

        return JSON.stringify({
          success: true,
          count: memories.length,
          memories: memories.map(formatMemory),
        });
      }

      case 'search': {
        if (!input.search) {
          return JSON.stringify({
            success: false,
            error: '請提供搜尋關鍵字 (search)',
          });
        }

        const results = store.search(input.search);

        return JSON.stringify({
          success: true,
          count: results.length,
          memories: results.map(formatMemory),
        });
      }

      case 'update': {
        if (!input.id) {
          return JSON.stringify({
            success: false,
            error: '請提供記憶 ID (id)',
          });
        }
        if (!input.content) {
          return JSON.stringify({
            success: false,
            error: '請提供更新內容 (content)',
          });
        }

        const updated = await store.update(input.id, input.content);

        if (!updated) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的記憶',
          });
        }

        return JSON.stringify({
          success: true,
          message: '記憶已更新',
          memory: formatMemory(updated),
        });
      }

      case 'delete': {
        if (!input.id) {
          return JSON.stringify({
            success: false,
            error: '請提供記憶 ID (id)',
          });
        }

        const deleted = await store.delete(input.id);

        if (!deleted) {
          return JSON.stringify({
            success: false,
            error: '找不到指定的記憶',
          });
        }

        return JSON.stringify({
          success: true,
          message: '記憶已刪除',
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
