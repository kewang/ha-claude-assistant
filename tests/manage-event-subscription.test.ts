import { describe, it, expect } from 'vitest';
import { manageEventSubscriptionTool } from '../src/tools/manage-event-subscription.js';
import { haTools } from '../src/tools/index.js';

describe('manageEventSubscriptionTool', () => {
  it('should have correct name', () => {
    expect(manageEventSubscriptionTool.name).toBe('manage_event_subscription');
  });

  it('should have description mentioning event types', () => {
    expect(manageEventSubscriptionTool.description).toContain('automation_triggered');
    expect(manageEventSubscriptionTool.description).toContain('state_changed');
  });

  it('should require action parameter', () => {
    expect(manageEventSubscriptionTool.input_schema.required).toContain('action');
  });

  it('should have all CRUD actions', () => {
    const actionProp = (manageEventSubscriptionTool.input_schema.properties as Record<string, { enum?: string[] }>).action;
    expect(actionProp.enum).toEqual(['create', 'list', 'enable', 'disable', 'delete']);
  });

  it('should be registered in haTools', () => {
    expect(haTools.map(t => t.name)).toContain('manage_event_subscription');
  });

  it('haTools should contain 6 tools', () => {
    expect(haTools).toHaveLength(6);
  });
});
