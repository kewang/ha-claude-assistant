#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { HAClient } from '../core/ha-client.js';
import { haTools, executeTool } from '../tools/index.js';
import { toMcpTools } from '../utils/tool-schema-converter.js';
import { createLogger } from '../utils/logger.js';
import { VERSION } from '../version.js';

config();

// MCP Server 需要使用 stderr，因為 stdout 保留給 MCP 協議
const logger = createLogger('MCP', { useStderr: true });

const server = new Server(
  {
    name: 'ha-claude-assistant',
    version: VERSION,
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
  logger.error('Failed to initialize HA client:', error);
  process.exit(1);
}

// 自動偵測連線（在背景執行，不阻塞 MCP 啟動）
haClient.autoConnect()
  .then((connection) => {
    logger.info(`HA connected (${connection.type}): ${connection.url}`);
  })
  .catch((error) => {
    logger.error('HA auto-connect failed:', error instanceof Error ? error.message : error);
  });

// 列出可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toMcpTools(haTools),
  };
});

// 處理工具呼叫
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(haClient, name, args);

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
  logger.info(`HA Claude Assistant MCP Server v${VERSION} running on stdio`);
}

main().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});
