import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [k: string]: unknown;
  };
}

export function toMcpTool(tool: Tool): McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema as McpTool['inputSchema'],
  };
}

export function toMcpTools(tools: Tool[]): McpTool[] {
  return tools.map(toMcpTool);
}
