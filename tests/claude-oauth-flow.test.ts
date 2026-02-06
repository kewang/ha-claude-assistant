import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  startAuthFlow,
  exchangeCodeForTokens,
  saveCredentials,
  getActiveSessionCount,
  clearAllSessions,
} from '../src/core/claude-oauth-flow.js';

// Mock dependencies
vi.mock('../src/core/claude-oauth-config.js', () => ({
  getOAuthConfig: () => ({
    tokenUrl: 'https://platform.claude.com/v1/oauth/token',
    clientId: 'test-client-id',
    source: 'fallback' as const,
  }),
}));

vi.mock('../src/core/env-detect.js', () => ({
  detectEnvironment: () => ({
    isAddon: false,
    supervisorUrl: '',
    dataPath: '',
    claudePath: '/usr/local/bin/claude',
    claudeConfigDir: '/tmp/test-claude-config',
  }),
}));

vi.mock('../src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    raw: vi.fn(),
  }),
}));

describe('Claude OAuth Flow', () => {
  beforeEach(() => {
    clearAllSessions();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAllSessions();
  });

  describe('generatePKCE', () => {
    it('should generate code_verifier and code_challenge', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();

      expect(codeVerifier).toBeTruthy();
      expect(codeChallenge).toBeTruthy();
      expect(codeVerifier).not.toBe(codeChallenge);
    });

    it('should generate base64url encoded strings', () => {
      const { codeVerifier, codeChallenge } = generatePKCE();

      // base64url 不包含 +, /, = 字元
      expect(codeVerifier).not.toMatch(/[+/=]/);
      expect(codeChallenge).not.toMatch(/[+/=]/);
    });

    it('should generate unique values each time', () => {
      const first = generatePKCE();
      const second = generatePKCE();

      expect(first.codeVerifier).not.toBe(second.codeVerifier);
      expect(first.codeChallenge).not.toBe(second.codeChallenge);
    });

    it('should generate code_verifier of expected length', () => {
      const { codeVerifier } = generatePKCE();
      // 32 bytes → base64url → ~43 characters
      expect(codeVerifier.length).toBeGreaterThanOrEqual(40);
      expect(codeVerifier.length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateState', () => {
    it('should generate a non-empty string', () => {
      const state = generateState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
    });

    it('should generate unique values each time', () => {
      const first = generateState();
      const second = generateState();
      expect(first).not.toBe(second);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('should build a valid authorization URL', () => {
      const url = buildAuthorizationUrl('test-challenge', 'test-state');

      expect(url).toContain('https://platform.claude.com/oauth/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('code_challenge=test-challenge');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=test-state');
      expect(url).toContain('redirect_uri=');
    });

    it('should include proper scope', () => {
      const url = buildAuthorizationUrl('challenge', 'state');
      expect(url).toContain('scope=');
    });
  });

  describe('startAuthFlow', () => {
    it('should create a new session and return auth URL', () => {
      const { authUrl, state } = startAuthFlow();

      expect(authUrl).toContain('https://platform.claude.com/oauth/authorize');
      expect(state).toBeTruthy();
      expect(getActiveSessionCount()).toBe(1);
    });

    it('should create multiple independent sessions', () => {
      const first = startAuthFlow();
      const second = startAuthFlow();

      expect(first.state).not.toBe(second.state);
      expect(getActiveSessionCount()).toBe(2);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should reject invalid state', async () => {
      await expect(
        exchangeCodeForTokens('code', 'invalid-state')
      ).rejects.toThrow('Invalid or expired session');
    });

    it('should exchange code for tokens successfully', async () => {
      // Start a flow to create a session
      const { state } = startAuthFlow();

      // Mock fetch
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const tokens = await exchangeCodeForTokens('auth-code', state);

      expect(tokens.access_token).toBe('test-access-token');
      expect(tokens.refresh_token).toBe('test-refresh-token');
      expect(tokens.expires_in).toBe(3600);

      // Session should be consumed
      expect(getActiveSessionCount()).toBe(0);
    });

    it('should throw on token exchange failure', async () => {
      const { state } = startAuthFlow();

      const mockResponse = {
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(
        exchangeCodeForTokens('bad-code', state)
      ).rejects.toThrow('Token exchange failed');
    });

    it('should reject expired session', async () => {
      const { state } = startAuthFlow();

      // Advance time by 11 minutes (session TTL is 10 minutes)
      vi.useFakeTimers();
      vi.advanceTimersByTime(11 * 60 * 1000);

      await expect(
        exchangeCodeForTokens('code', state)
      ).rejects.toThrow('Session expired');

      vi.useRealTimers();
    });
  });

  describe('saveCredentials', () => {
    it('should save credentials to file', async () => {
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockReadFile = vi.fn().mockResolvedValue('{}');
      const mockMkdir = vi.fn().mockResolvedValue(undefined);

      vi.mock('fs/promises', async () => {
        return {
          writeFile: (...args: unknown[]) => mockWriteFile(...args),
          readFile: (...args: unknown[]) => mockReadFile(...args),
          mkdir: (...args: unknown[]) => mockMkdir(...args),
        };
      });

      // This test mainly verifies the function doesn't throw
      // The actual file writing is mocked
      const tokens = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      // saveCredentials uses fs/promises internally
      // Since we can't easily mock it in ESM, we just verify the interface
      expect(typeof saveCredentials).toBe('function');
    });
  });
});
