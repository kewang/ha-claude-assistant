import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HAClient } from '../src/core/ha-client.js';

describe('HAClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when URL is missing', () => {
      const originalUrl = process.env.HA_URL;
      const originalToken = process.env.HA_TOKEN;
      delete process.env.HA_URL;
      delete process.env.HA_TOKEN;

      expect(() => new HAClient()).toThrow('Home Assistant URL is required');

      process.env.HA_URL = originalUrl;
      process.env.HA_TOKEN = originalToken;
    });

    it('should throw error when token is missing', () => {
      const originalToken = process.env.HA_TOKEN;
      delete process.env.HA_TOKEN;

      expect(() => new HAClient({ url: 'http://localhost:8123' })).toThrow(
        'Home Assistant token is required'
      );

      process.env.HA_TOKEN = originalToken;
    });

    it('should create client with config', () => {
      const client = new HAClient({
        url: 'http://localhost:8123',
        token: 'test-token',
      });
      expect(client).toBeInstanceOf(HAClient);
    });
  });

  describe('API methods', () => {
    let client: HAClient;

    beforeEach(() => {
      client = new HAClient({
        url: 'http://localhost:8123',
        token: 'test-token',
      });
    });

    it('should have getStates method', () => {
      expect(typeof client.getStates).toBe('function');
    });

    it('should have getState method', () => {
      expect(typeof client.getState).toBe('function');
    });

    it('should have callService method', () => {
      expect(typeof client.callService).toBe('function');
    });

    it('should have searchEntities method', () => {
      expect(typeof client.searchEntities).toBe('function');
    });
  });
});
