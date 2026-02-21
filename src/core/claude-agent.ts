import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { config } from 'dotenv';
import { HAClient } from './ha-client.js';
import { haTools, executeTool } from '../tools/index.js';

config();

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AgentResponse {
  text: string;
  toolCalls?: Array<{
    name: string;
    input: unknown;
    result: string;
  }>;
}

const DEFAULT_SYSTEM_PROMPT = `你是一個智慧家庭助理，可以幫助使用者控制 Home Assistant 中的設備。

你的能力：
1. 列出家中的所有設備（燈具、開關、感測器等）
2. 查詢設備狀態（溫度、濕度、亮度等）
3. 控制設備（開燈、關燈、調整溫度等）
4. 啟動場景和自動化

使用指引：
- 先用 list_entities 了解有哪些設備
- 用 get_state 查詢詳細狀態
- 用 call_service 控制設備

請用繁體中文回答，語氣親切自然。回答簡潔但完整。`;

export class ClaudeAgent {
  private client: Anthropic;
  private haClient: HAClient;
  private model: string;
  private maxTokens: number;
  private systemPrompt: string;
  private conversationHistory: MessageParam[] = [];

  constructor(haClient: HAClient, config?: AgentConfig) {
    this.client = new Anthropic();
    this.haClient = haClient;
    this.model = config?.model || process.env.CLAUDE_MODEL || 'sonnet';
    this.maxTokens = config?.maxTokens || 4096;
    this.systemPrompt = config?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * 處理使用者訊息並回應
   */
  async chat(userMessage: string): Promise<AgentResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const toolCalls: AgentResponse['toolCalls'] = [];
    let finalText = '';

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        tools: haTools,
        messages: this.conversationHistory,
      });

      // 處理回應內容
      const assistantContent: ContentBlock[] = response.content;
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantContent,
      });

      // 收集文字回應
      for (const block of response.content) {
        if (block.type === 'text') {
          finalText += block.text;
        }
      }

      // 如果沒有 tool_use，結束迴圈
      if (response.stop_reason === 'end_turn') {
        break;
      }

      // 處理 tool calls
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        break;
      }

      // 執行所有 tool calls
      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          this.haClient,
          toolUse.name,
          toolUse.input
        );

        toolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          result,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // 將 tool results 加入對話歷史
      this.conversationHistory.push({
        role: 'user',
        content: toolResults,
      });
    }

    return {
      text: finalText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * 單次查詢（不保留對話歷史）
   */
  async query(message: string): Promise<AgentResponse> {
    const savedHistory = [...this.conversationHistory];
    this.conversationHistory = [];

    try {
      return await this.chat(message);
    } finally {
      this.conversationHistory = savedHistory;
    }
  }

  /**
   * 清除對話歷史
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 取得對話歷史長度
   */
  getHistoryLength(): number {
    return this.conversationHistory.length;
  }

  /**
   * 設定自訂系統提示
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * 取得目前系統提示
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }
}

export default ClaudeAgent;
