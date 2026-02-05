#!/usr/bin/env node
/**
 * CLI 互動介面
 *
 * 透過 Claude CLI 處理使用者指令，與 Slack Bot 和 scheduler-daemon 保持一致的架構。
 */

import { createInterface } from 'readline';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import { HAClient } from '../core/ha-client.js';
import { createLogger } from '../utils/logger.js';
import { VERSION } from '../version.js';

config();

const logger = createLogger('CLI');

const WELCOME_MESSAGE = `
╔══════════════════════════════════════════════════════════╗
║       🏠 Home Assistant Claude 智慧家庭助理 🏠          ║
╠══════════════════════════════════════════════════════════╣
║  輸入自然語言指令來控制你的智慧家庭                      ║
║  輸入 /help 查看可用指令                                 ║
║  輸入 /quit 或 Ctrl+C 離開                              ║
╚══════════════════════════════════════════════════════════╝
`;

const HELP_MESSAGE = `
可用指令：
  /help     - 顯示此說明
  /status   - 檢查 Home Assistant 連線狀態
  /quit     - 離開程式

範例對話：
  "列出所有燈具"
  "客廳的燈目前是什麼狀態？"
  "把臥室的燈打開"
  "幫我關掉所有燈"
  "現在溫度幾度？"
  "把冷氣設定到 26 度"
`;

/**
 * 執行 Claude CLI
 */
async function executeClaudePrompt(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = `${process.env.HOME}/.local/bin/claude`;

    const child = spawn(claudePath, ['--print', prompt], {
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude 執行超時（2 分鐘）'));
    }, 120000);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        if (stderr) {
          logger.error('Claude stderr:', stderr);
        }
        reject(new Error(`Claude 執行失敗 (exit code: ${code})`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Claude 執行錯誤: ${error.message}`));
    });
  });
}

class CLI {
  private haClient: HAClient;
  private rl: ReturnType<typeof createInterface>;
  private isProcessing = false;

  constructor() {
    this.haClient = new HAClient();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async handleCommand(input: string): Promise<boolean> {
    const command = input.trim().toLowerCase();

    switch (command) {
      case '/help':
        logger.raw(HELP_MESSAGE);
        return true;

      case '/status':
        await this.checkStatus();
        return true;

      case '/quit':
      case '/exit':
      case '/q':
        return false;

      default:
        return true;
    }
  }

  private async checkStatus(): Promise<void> {
    logger.raw('檢查 Home Assistant 連線...');
    try {
      const connection = await this.haClient.autoConnect();
      const result = await this.haClient.checkConnection();
      logger.raw(`✓ 連線成功 (${connection.type === 'internal' ? '內網' : '外網'}): ${result.message}`);
      logger.raw(`  URL: ${connection.url}\n`);
    } catch (error) {
      logger.raw(`✗ 連線失敗: ${error instanceof Error ? error.message : error}\n`);
    }
  }

  private async processInput(input: string): Promise<void> {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return;
    }

    // 處理指令
    if (trimmedInput.startsWith('/')) {
      const shouldContinue = await this.handleCommand(trimmedInput);
      if (!shouldContinue) {
        this.shutdown();
      }
      return;
    }

    // 處理一般對話
    this.isProcessing = true;
    logger.raw('\n思考中...\n');

    try {
      const response = await executeClaudePrompt(trimmedInput);
      logger.raw(`🤖 ${response}\n`);
    } catch (error) {
      logger.raw(`\n❌ 錯誤: ${error instanceof Error ? error.message : error}\n`);
    } finally {
      this.isProcessing = false;
    }
  }

  private prompt(): void {
    this.rl.question('你: ', async (input) => {
      await this.processInput(input);
      this.prompt();
    });
  }

  private shutdown(): void {
    logger.raw('\n👋 再見！\n');
    this.rl.close();
    process.exit(0);
  }

  async start(): Promise<void> {
    logger.raw(WELCOME_MESSAGE);

    // 初始檢查連線
    await this.checkStatus();

    // 處理 Ctrl+C
    this.rl.on('close', () => {
      if (!this.isProcessing) {
        this.shutdown();
      }
    });

    process.on('SIGINT', () => {
      this.shutdown();
    });

    // 開始互動
    this.prompt();
  }
}

// 單次指令模式
async function singleCommand(command: string): Promise<void> {
  logger.raw('處理中...\n');

  try {
    const response = await executeClaudePrompt(command);
    logger.raw(response);
  } catch (error) {
    logger.raw(`錯誤: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// 主程式
async function main() {
  const args = process.argv.slice(2);

  // 單次指令模式
  if (args.length > 0 && !args[0].startsWith('-')) {
    await singleCommand(args.join(' '));
    return;
  }

  // 處理參數
  if (args.includes('-h') || args.includes('--help')) {
    logger.raw(`
Usage: ha-claude [options] [command]

Options:
  -h, --help    顯示說明
  -v, --version 顯示版本

Examples:
  ha-claude                    # 互動模式
  ha-claude "列出所有燈具"      # 單次指令
  ha-claude "把客廳的燈打開"    # 單次指令
`);
    return;
  }

  if (args.includes('-v') || args.includes('--version')) {
    logger.raw(`ha-claude-assistant v${VERSION}`);
    return;
  }

  // 互動模式
  const cli = new CLI();
  await cli.start();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
