import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

export const listEntitiesTool: Tool = {
  name: 'list_entities',
  description: `列出 Home Assistant 中的實體。可依照類型過濾（如 light, switch, sensor, climate, media_player 等）。
回傳每個實體的 entity_id、友善名稱和目前狀態。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string',
        description: '實體類型/domain，例如: light, switch, sensor, binary_sensor, climate, media_player, automation, scene, script, cover, fan, lock, vacuum, camera',
      },
      search: {
        type: 'string',
        description: '搜尋關鍵字，會比對 entity_id 和友善名稱',
      },
    },
    required: [],
  },
};

export interface ListEntitiesInput {
  domain?: string;
  search?: string;
}

export async function executeListEntities(
  client: HAClient,
  input: ListEntitiesInput
): Promise<string> {
  try {
    let states;

    if (input.domain) {
      states = await client.getStatesByDomain(input.domain);
    } else if (input.search) {
      states = await client.searchEntities(input.search);
    } else {
      states = await client.getStates();
    }

    if (input.search && input.domain) {
      const lowerSearch = input.search.toLowerCase();
      states = states.filter(s =>
        s.entity_id.toLowerCase().includes(lowerSearch) ||
        (s.attributes.friendly_name as string || '').toLowerCase().includes(lowerSearch)
      );
    }

    const entities = states.map(s => {
      const attrs: Record<string, unknown> = {};
      if (s.attributes.device_class) {
        attrs.device_class = s.attributes.device_class;
      }
      if (s.attributes.unit_of_measurement) {
        attrs.unit = s.attributes.unit_of_measurement;
      }
      return {
        entity_id: s.entity_id,
        friendly_name: s.attributes.friendly_name || s.entity_id,
        state: s.state,
        attributes: attrs,
      };
    });

    if (entities.length === 0) {
      return JSON.stringify({
        success: true,
        message: '沒有找到符合條件的實體',
        count: 0,
        entities: [],
      });
    }

    return JSON.stringify({
      success: true,
      count: entities.length,
      entities,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
