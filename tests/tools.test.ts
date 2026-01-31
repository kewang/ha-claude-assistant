import { describe, it, expect } from 'vitest';
import { haTools, listEntitiesTool, getStateTool, callServiceTool } from '../src/tools/index.js';

describe('Tools', () => {
  describe('haTools array', () => {
    it('should contain all tools', () => {
      expect(haTools).toHaveLength(3);
      expect(haTools.map(t => t.name)).toEqual([
        'list_entities',
        'get_state',
        'call_service',
      ]);
    });
  });

  describe('listEntitiesTool', () => {
    it('should have correct name', () => {
      expect(listEntitiesTool.name).toBe('list_entities');
    });

    it('should have description', () => {
      expect(listEntitiesTool.description).toBeDefined();
      expect(listEntitiesTool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(listEntitiesTool.input_schema).toBeDefined();
      expect(listEntitiesTool.input_schema.type).toBe('object');
    });

    it('should have optional domain property', () => {
      const properties = listEntitiesTool.input_schema.properties as Record<string, unknown>;
      expect(properties.domain).toBeDefined();
    });
  });

  describe('getStateTool', () => {
    it('should have correct name', () => {
      expect(getStateTool.name).toBe('get_state');
    });

    it('should require entity_id', () => {
      expect(getStateTool.input_schema.required).toContain('entity_id');
    });
  });

  describe('callServiceTool', () => {
    it('should have correct name', () => {
      expect(callServiceTool.name).toBe('call_service');
    });

    it('should require domain and service', () => {
      expect(callServiceTool.input_schema.required).toContain('domain');
      expect(callServiceTool.input_schema.required).toContain('service');
    });
  });
});
