#!/usr/bin/env node
import { createInterface } from 'readline';
import { config } from 'dotenv';
import { HAClient } from '../core/ha-client.js';
import { ClaudeAgent } from '../core/claude-agent.js';

config();

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
  /clear    - 清除對話歷史
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

class CLI {
  private agent: ClaudeAgent;
  private haClient: HAClient;
  private rl: ReturnType<typeof createInterface>;
  private isProcessing = false;

  constructor() {
    this.haClient = new HAClient();
    this.agent = new ClaudeAgent(this.haClient);
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async handleCommand(input: string): Promise<boolean> {
    const command = input.trim().toLowerCase();

    switch (command) {
      case '/help':
        console.log(HELP_MESSAGE);
        return true;

      case '/clear':
        this.agent.clearHistory();
        console.log('✓ 對話歷史已清除\n');
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
    console.log('檢查 Home Assistant 連線...');
    try {
      const connection = await this.haClient.autoConnect();
      const result = await this.haClient.checkConnection();
      console.log(`✓ 連線成功 (${connection.type === 'internal' ? '內網' : '外網'}): ${result.message}`);
      console.log(`  URL: ${connection.url}\n`);
    } catch (error) {
      console.error(`✗ 連線失敗: ${error instanceof Error ? error.message : error}\n`);
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
    console.log('\n思考中...\n');

    try {
      const response = await this.agent.chat(trimmedInput);

      // 顯示工具呼叫（可選，用於除錯）
      if (response.toolCalls && process.env.DEBUG === 'true') {
        console.log('--- Tool Calls ---');
        for (const call of response.toolCalls) {
          console.log(`[${call.name}]`, JSON.stringify(call.input, null, 2));
        }
        console.log('------------------\n');
      }

      console.log(`🤖 ${response.text}\n`);
    } catch (error) {
      console.error(`\n❌ 錯誤: ${error instanceof Error ? error.message : error}\n`);
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
    console.log('\n👋 再見！\n');
    this.rl.close();
    process.exit(0);
  }

  async start(): Promise<void> {
    console.log(WELCOME_MESSAGE);

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
  const haClient = new HAClient();
  const agent = new ClaudeAgent(haClient);

  try {
    console.log('處理中...\n');
    const response = await agent.query(command);
    console.log(response.text);
  } catch (error) {
    console.error(`錯誤: ${error instanceof Error ? error.message : error}`);
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
    console.log(`
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
    console.log('ha-claude-assistant v1.0.0');
    return;
  }

  // 互動模式
  const cli = new CLI();
  await cli.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
