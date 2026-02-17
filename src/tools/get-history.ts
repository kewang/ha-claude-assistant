import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

export const getHistoryTool: Tool = {
  name: 'get_history',
  description: `查詢 Home Assistant 實體的歷史狀態資料。
回傳指定時間範圍內實體的狀態變化紀錄。
適合用於：
- 查詢感測器歷史數值（如「過去 24 小時客廳溫度變化」）
- 查詢裝置開關歷史（如「昨天冷氣開了幾次」）
- 查詢狀態變化趨勢
- 比較不同時段的數據`,
  input_schema: {
    type: 'object' as const,
    properties: {
      entity_id: {
        type: 'string',
        description: '實體 ID，支援多實體以逗號分隔，例如: sensor.temperature 或 sensor.temperature,sensor.humidity',
      },
      start_time: {
        type: 'string',
        description: '開始時間，ISO 8601 格式，例如: 2026-02-16T00:00:00+08:00。未指定則預設為過去 24 小時',
      },
      end_time: {
        type: 'string',
        description: '結束時間，ISO 8601 格式，例如: 2026-02-17T00:00:00+08:00。未指定則預設為目前時間',
      },
      minimal_response: {
        type: 'boolean',
        description: '是否使用精簡回應（僅包含 state 和 last_changed），預設為 true',
      },
      significant_changes_only: {
        type: 'boolean',
        description: '是否只回傳顯著的狀態變化，預設為 false',
      },
    },
    required: ['entity_id'],
  },
};

export interface GetHistoryInput {
  entity_id: string;
  start_time?: string;
  end_time?: string;
  minimal_response?: boolean;
  significant_changes_only?: boolean;
}

export async function executeGetHistory(
  client: HAClient,
  input: GetHistoryInput
): Promise<string> {
  try {
    const minimalResponse = input.minimal_response !== false;
    const significantChangesOnly = input.significant_changes_only === true;

    const history = await client.getHistory(
      input.entity_id,
      input.start_time,
      input.end_time,
      { minimalResponse, significantChangesOnly }
    );

    const records = history.flat().map(entry => ({
      entity_id: entry.entity_id,
      state: entry.state,
      last_changed: entry.last_changed,
      ...(entry.attributes && Object.keys(entry.attributes).length > 0
        ? { attributes: entry.attributes }
        : {}),
    }));

    return JSON.stringify({
      success: true,
      entity_id: input.entity_id,
      start_time: input.start_time || '(past 24 hours)',
      end_time: input.end_time || '(now)',
      total_records: records.length,
      records,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      entity_id: input.entity_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
