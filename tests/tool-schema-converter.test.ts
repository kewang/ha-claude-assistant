import { describe, it, expect } from 'vitest';
import { toMcpTool, toMcpTools } from '../src/utils/tool-schema-converter.js';
import { haTools } from '../src/tools/index.js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

describe('toMcpTool', () => {
  it('should convert input_schema to inputSchema', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      input_schema: {
        type: 'object' as const,
        properties: {
          foo: { type: 'string', description: 'A foo param' },
        },
        required: ['foo'],
      },
    };

    const result = toMcpTool(tool);

    expect(result.name).toBe('test_tool');
    expect(result.description).toBe('A test tool');
    expect(result.inputSchema).toEqual(tool.input_schema);
    expect((result as Record<string, unknown>).input_schema).toBeUndefined();
  });

  it('should preserve array-typed properties', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'Test',
      input_schema: {
        type: 'object' as const,
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'An array param',
          },
        },
        required: [],
      },
    };

    const result = toMcpTool(tool);
    const props = result.inputSchema.properties as Record<string, Record<string, unknown>>;

    expect(props.items.type).toBe('array');
    expect(props.items.items).toEqual({ type: 'string' });
  });
});

describe('toMcpTools', () => {
  it('should convert all haTools', () => {
    const result = toMcpTools(haTools);

    expect(result).toHaveLength(haTools.length);
    for (let i = 0; i < haTools.length; i++) {
      expect(result[i].name).toBe(haTools[i].name);
      expect(result[i].inputSchema).toEqual(haTools[i].input_schema);
    }
  });

  it('manage_event_subscription entity_filter should be array type', () => {
    const result = toMcpTools(haTools);
    const eventSubTool = result.find(t => t.name === 'manage_event_subscription');

    expect(eventSubTool).toBeDefined();
    const props = eventSubTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.entity_filter.type).toBe('array');
    expect(props.entity_filter.items).toEqual({ type: 'string' });
  });

  it('get_history should have minimal_response and significant_changes_only', () => {
    const result = toMcpTools(haTools);
    const historyTool = result.find(t => t.name === 'get_history');

    expect(historyTool).toBeDefined();
    const props = historyTool!.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.minimal_response).toBeDefined();
    expect(props.minimal_response.type).toBe('boolean');
    expect(props.significant_changes_only).toBeDefined();
    expect(props.significant_changes_only.type).toBe('boolean');
  });
});
