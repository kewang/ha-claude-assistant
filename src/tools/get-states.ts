import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

export const getStateTool: Tool = {
  name: 'get_state',
  description: `取得 Home Assistant 實體的詳細狀態資訊。
回傳實體的目前狀態、所有屬性、最後更新時間等。
適合用於：
- 查詢感測器數值（溫度、濕度、電量等）
- 查詢燈具亮度、色溫
- 查詢開關狀態
- 查詢設備詳細資訊`,
  input_schema: {
    type: 'object' as const,
    properties: {
      entity_id: {
        type: 'string',
        description: '實體 ID，例如: light.living_room, sensor.temperature, switch.bedroom',
      },
    },
    required: ['entity_id'],
  },
};

export interface GetStateInput {
  entity_id: string;
}

export async function executeGetState(
  client: HAClient,
  input: GetStateInput
): Promise<string> {
  try {
    const state = await client.getState(input.entity_id);

    const result = {
      success: true,
      entity_id: state.entity_id,
      state: state.state,
      friendly_name: state.attributes.friendly_name || state.entity_id,
      attributes: state.attributes,
      last_changed: state.last_changed,
      last_updated: state.last_updated,
    };

    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({
      success: false,
      entity_id: input.entity_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
