import { describe, it, expect } from 'vitest';
import { haTools, listEntitiesTool, getStateTool, callServiceTool, manageScheduleTool, getHistoryTool, manageEventSubscriptionTool } from '../src/tools/index.js';

describe('Tools', () => {
  describe('haTools array', () => {
    it('should contain all tools', () => {
      expect(haTools).toHaveLength(6);
      expect(haTools.map(t => t.name)).toEqual([
        'list_entities',
        'get_state',
        'call_service',
        'manage_schedule',
        'get_history',
        'manage_event_subscription',
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

  describe('manageScheduleTool', () => {
    it('should have correct name', () => {
      expect(manageScheduleTool.name).toBe('manage_schedule');
    });

    it('should require action', () => {
      expect(manageScheduleTool.input_schema.required).toContain('action');
    });

    it('should have action enum', () => {
      const properties = manageScheduleTool.input_schema.properties as Record<string, { enum?: string[] }>;
      expect(properties.action.enum).toEqual(['create', 'list', 'enable', 'disable', 'delete']);
    });
  });

  describe('getHistoryTool', () => {
    it('should have correct name', () => {
      expect(getHistoryTool.name).toBe('get_history');
    });

    it('should require entity_id', () => {
      expect(getHistoryTool.input_schema.required).toContain('entity_id');
    });

    it('should have optional time parameters', () => {
      const properties = getHistoryTool.input_schema.properties as Record<string, unknown>;
      expect(properties.start_time).toBeDefined();
      expect(properties.end_time).toBeDefined();
    });
  });
});
