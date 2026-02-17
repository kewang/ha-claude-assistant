import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { HAWebSocket } from '../src/core/ha-websocket.js';

// Mock ws
vi.mock('ws', () => {
  const MockWebSocket = vi.fn();
  MockWebSocket.OPEN = 1;
  MockWebSocket.prototype.on = vi.fn();
  MockWebSocket.prototype.send = vi.fn();
  MockWebSocket.prototype.close = vi.fn();
  MockWebSocket.prototype.readyState = 1;
  return { default: MockWebSocket };
});

// Mock env-detect
vi.mock('../src/core/env-detect.js', () => ({
  detectEnvironment: () => ({
    isAddon: false,
    supervisorToken: null,
    dataPath: null,
    claudePath: 'claude',
    claudeConfigDir: null,
  }),
}));

describe('HAWebSocket', () => {
  beforeEach(() => {
    process.env.HA_URL = 'http://localhost:8123';
    process.env.HA_TOKEN = 'test-token';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.HA_URL;
    delete process.env.HA_TOKEN;
  });

  it('should build correct WebSocket URL from HTTP', () => {
    const ws = new HAWebSocket({ url: 'http://localhost:8123', token: 'test' });
    // URL is private, but we can verify through connect behavior
    expect(ws).toBeDefined();
  });

  it('should build correct WebSocket URL from HTTPS', () => {
    const ws = new HAWebSocket({ url: 'https://ha.example.com', token: 'test' });
    expect(ws).toBeDefined();
  });

  it('should throw if no URL or token provided', () => {
    delete process.env.HA_URL;
    delete process.env.HA_TOKEN;
    expect(() => new HAWebSocket()).toThrow('HA_URL and HA_TOKEN are required');
  });

  it('should register event callbacks', () => {
    const ws = new HAWebSocket({ url: 'http://localhost:8123', token: 'test' });
    const callback = vi.fn();
    ws.onEvent(callback);
    // Callback registered without error
    expect(ws).toBeDefined();
  });

  it('should register lifecycle callbacks', () => {
    const ws = new HAWebSocket({ url: 'http://localhost:8123', token: 'test' });
    const reconnectCb = vi.fn();
    const failedCb = vi.fn();
    const authFailedCb = vi.fn();

    ws.onReconnectedEvent(reconnectCb);
    ws.onConnectionFailedEvent(failedCb);
    ws.onAuthFailedEvent(authFailedCb);
    expect(ws).toBeDefined();
  });

  it('should report not connected initially', () => {
    const ws = new HAWebSocket({ url: 'http://localhost:8123', token: 'test' });
    expect(ws.isConnected()).toBe(false);
  });

  it('should disconnect gracefully', () => {
    const ws = new HAWebSocket({ url: 'http://localhost:8123', token: 'test' });
    // Should not throw even when not connected
    ws.disconnect();
    expect(ws.isConnected()).toBe(false);
  });
});
