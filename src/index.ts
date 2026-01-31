#!/usr/bin/env node
/**
 * HA Claude Assistant - 主程式進入點
 *
 * 這個檔案提供統一的啟動方式，可以選擇不同的執行模式。
 */

import { config } from 'dotenv';

config();

const mode = process.argv[2] || 'cli';

async function main() {
  switch (mode) {
    case 'cli':
      await import('./interfaces/cli.js');
      break;

    case 'mcp':
      await import('./interfaces/mcp-server.js');
      break;

    case 'slack':
      await import('./interfaces/slack-bot.js');
      break;

    case 'help':
    case '-h':
    case '--help':
      console.log(`
HA Claude Assistant - Claude AI 驅動的智慧家庭助理

Usage: npm start [mode]

Modes:
  cli     互動式命令列介面（預設）
  mcp     MCP Server 模式（供 Claude Code 使用）
  slack   Slack Bot 模式

Other commands:
  npm run cli     啟動 CLI
  npm run mcp     啟動 MCP Server
  npm run slack   啟動 Slack Bot
  npm test        執行測試
`);
      break;

    default:
      console.error(`Unknown mode: ${mode}`);
      console.log('Use "npm start help" for usage information');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export core modules for programmatic usage
export { HAClient } from './core/ha-client.js';
export { ClaudeAgent } from './core/claude-agent.js';
export { Scheduler, CronPresets } from './core/scheduler.js';
export { haTools, executeTool } from './tools/index.js';
