#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { HAClient } from '../core/ha-client.js';
import { executeListEntities, type ListEntitiesInput } from '../tools/list-entities.js';
import { executeGetState, type GetStateInput } from '../tools/get-states.js';
import { executeCallService, type CallServiceInput } from '../tools/call-service.js';
import { executeManageSchedule, type ManageScheduleInput } from '../tools/manage-schedule.js';

config();

const server = new Server(
  {
    name: 'ha-claude-assistant',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let haClient: HAClient;

try {
  haClient = new HAClient();
} catch (error) {
  console.error('Failed to initialize HA client:', error);
  process.exit(1);
}

// 自動偵測連線（在背景執行，不阻塞 MCP 啟動）
haClient.autoConnect()
  .then((connection) => {
    console.error(`HA connected (${connection.type}): ${connection.url}`);
  })
  .catch((error) => {
    console.error('HA auto-connect failed:', error instanceof Error ? error.message : error);
  });

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_entities',
        description: `列出 Home Assistant 中的實體。可依照類型過濾（如 light, switch, sensor, climate, media_player 等）。
回傳每個實體的 entity_id、友善名稱和目前狀態。`,
        inputSchema: {
          type: 'object',
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
      },
      {
        name: 'get_state',
        description: `取得 Home Assistant 實體的詳細狀態資訊。
回傳實體的目前狀態、所有屬性、最後更新時間等。
適合用於：
- 查詢感測器數值（溫度、濕度、電量等）
- 查詢燈具亮度、色溫
- 查詢開關狀態
- 查詢設備詳細資訊`,
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: '實體 ID，例如: light.living_room, sensor.temperature, switch.bedroom',
            },
          },
          required: ['entity_id'],
        },
      },
      {
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
        inputSchema: {
          type: 'object',
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
      },
      {
        name: 'manage_schedule',
        description: `管理排程任務。可以新增、列出、啟用、停用或刪除排程。

排程會由獨立的背景服務執行，執行時會使用 Claude 處理 prompt，並將結果發送到 Slack。

常用 cron 表達式範例：
- "0 7 * * *" - 每天早上 7 點
- "0 19 * * *" - 每天晚上 7 點
- "0 8 * * 1-5" - 週一到週五早上 8 點
- "*/30 * * * *" - 每 30 分鐘
- "0 */2 * * *" - 每 2 小時`,
        inputSchema: {
          type: 'object',
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
      },
    ],
  };
});

// 處理工具呼叫
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_entities':
        result = await executeListEntities(haClient, args as unknown as ListEntitiesInput);
        break;
      case 'get_state':
        result = await executeGetState(haClient, args as unknown as GetStateInput);
        break;
      case 'call_service':
        result = await executeCallService(haClient, args as unknown as CallServiceInput);
        break;
      case 'manage_schedule':
        result = await executeManageSchedule(args as unknown as ManageScheduleInput);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// 啟動 MCP Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HA Claude Assistant MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
