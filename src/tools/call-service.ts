import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

export const callServiceTool: Tool = {
  name: 'call_service',
  description: `呼叫 Home Assistant 服務來控制設備。
常用服務範例：
- light.turn_on / light.turn_off / light.toggle - 控制燈光
- switch.turn_on / switch.turn_off / switch.toggle - 控制開關
- climate.set_temperature - 設定溫度
- scene.turn_on - 啟動場景
- script.turn_on - 執行腳本
- automation.trigger - 觸發自動化
- media_player.media_play_pause - 播放/暫停媒體
- cover.open_cover / cover.close_cover - 控制窗簾
- fan.turn_on / fan.turn_off - 控制風扇
- lock.lock / lock.unlock - 控制門鎖`,
  input_schema: {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string',
        description: '服務的 domain，例如: light, switch, climate, scene, script, automation, media_player, cover, fan, lock',
      },
      service: {
        type: 'string',
        description: '服務名稱，例如: turn_on, turn_off, toggle, set_temperature',
      },
      entity_id: {
        type: 'string',
        description: '目標實體 ID，例如: light.living_room',
      },
      data: {
        type: 'object',
        description: `額外參數，根據服務不同而異。常用範例：
- light.turn_on: { brightness: 255, color_temp: 300, rgb_color: [255, 0, 0] }
- climate.set_temperature: { temperature: 25 }
- media_player.volume_set: { volume_level: 0.5 }
- cover.set_cover_position: { position: 50 }`,
      },
    },
    required: ['domain', 'service'],
  },
};

export interface CallServiceInput {
  domain: string;
  service: string;
  entity_id?: string;
  data?: Record<string, unknown>;
}

export async function executeCallService(
  client: HAClient,
  input: CallServiceInput
): Promise<string> {
  try {
    const serviceData: Record<string, unknown> = { ...input.data };
    if (input.entity_id) {
      serviceData.entity_id = input.entity_id;
    }

    const result = await client.callService(input.domain, input.service, serviceData);

    const changedStates = result.map(s => ({
      entity_id: s.entity_id,
      new_state: s.state,
      friendly_name: s.attributes.friendly_name || s.entity_id,
    }));

    return JSON.stringify({
      success: true,
      message: `成功呼叫 ${input.domain}.${input.service}`,
      changed_states: changedStates,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      domain: input.domain,
      service: input.service,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
