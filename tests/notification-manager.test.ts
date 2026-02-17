import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationManager } from '../src/core/notification/manager.js';
import type { NotificationAdapter, NotificationMessage } from '../src/core/notification/types.js';

function createMockAdapter(type: 'slack' | 'telegram', configured = true): NotificationAdapter {
  return {
    type,
    isConfigured: () => configured,
    send: vi.fn().mockResolvedValue({ channel: type, success: true }),
  };
}

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager();
  });

  const testMessage: NotificationMessage = {
    text: 'Test message',
    source: 'manual',
  };

  it('should register adapters', () => {
    const adapter = createMockAdapter('slack');
    manager.registerAdapter(adapter);
    // No error means success
  });

  it('should send to all configured adapters when no channels specified', async () => {
    const slack = createMockAdapter('slack');
    const telegram = createMockAdapter('telegram');
    manager.registerAdapter(slack);
    manager.registerAdapter(telegram);

    const results = await manager.send(testMessage);
    expect(results).toHaveLength(2);
    expect(slack.send).toHaveBeenCalledWith(testMessage, undefined);
    expect(telegram.send).toHaveBeenCalledWith(testMessage, undefined);
  });

  it('should send only to specified channels', async () => {
    const slack = createMockAdapter('slack');
    const telegram = createMockAdapter('telegram');
    manager.registerAdapter(slack);
    manager.registerAdapter(telegram);

    const results = await manager.send(testMessage, { channels: ['slack'] });
    expect(results).toHaveLength(1);
    expect(slack.send).toHaveBeenCalled();
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('should pass target to adapters', async () => {
    const slack = createMockAdapter('slack');
    manager.registerAdapter(slack);

    await manager.send(testMessage, { target: 'C12345' });
    expect(slack.send).toHaveBeenCalledWith(testMessage, 'C12345');
  });

  it('should skip unconfigured adapters', async () => {
    const slack = createMockAdapter('slack', false);
    manager.registerAdapter(slack);

    const results = await manager.send(testMessage);
    expect(results).toHaveLength(0);
    expect(slack.send).not.toHaveBeenCalled();
  });

  it('should return empty results when no adapters registered', async () => {
    const results = await manager.send(testMessage);
    expect(results).toHaveLength(0);
  });
});

describe('SlackAdapter', () => {
  it('should report not configured when env vars missing', async () => {
    // Clear env vars
    const origToken = process.env.SLACK_BOT_TOKEN;
    const origChannel = process.env.SLACK_DEFAULT_CHANNEL;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_DEFAULT_CHANNEL;

    // Dynamic import to get fresh instance
    const { SlackAdapter } = await import('../src/core/notification/adapters/slack.js');
    const adapter = new SlackAdapter();

    expect(adapter.isConfigured()).toBe(false);
    expect(adapter.type).toBe('slack');

    const result = await adapter.send(testMessage);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');

    // Restore
    if (origToken) process.env.SLACK_BOT_TOKEN = origToken;
    if (origChannel) process.env.SLACK_DEFAULT_CHANNEL = origChannel;
  });

  const testMessage: NotificationMessage = {
    text: 'Test',
    source: 'manual',
  };
});
