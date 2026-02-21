import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
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

vi.mock('../src/core/claude-oauth-config.js', () => ({
  getOAuthConfig: () => ({
    tokenUrl: 'https://platform.claude.com/v1/oauth/token',
    clientId: 'test-client-id',
    source: 'fallback' as const,
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { ClaudeTokenRefreshService } from '../src/core/claude-token-refresh.js';
import { readFile, writeFile } from 'fs/promises';

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);

// Helper: create credentials that are expiring soon
function makeExpiringCredentials() {
  return JSON.stringify({
    claudeAiOauth: {
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes left (within 30-min threshold)
      scopes: ['user:inference'],
    },
  });
}

// Helper: mock a successful refresh response
function mockSuccessfulRefresh() {
  return {
    ok: true,
    json: async () => ({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 28800,
      token_type: 'bearer',
      scope: 'user:inference user:profile',
    }),
  } as Response;
}

describe('ClaudeTokenRefreshService - Concurrency Control', () => {
  let service: ClaudeTokenRefreshService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new ClaudeTokenRefreshService();
    mockWriteFile.mockResolvedValue(undefined);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('should only send one API request when refreshToken() is called concurrently', async () => {
    mockReadFile.mockResolvedValue(makeExpiringCredentials());

    // Use a deferred promise to control when the fetch resolves
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchSpy.mockReturnValue(fetchPromise as Promise<Response>);

    // Start 3 concurrent refresh calls
    const promise1 = service.refreshToken();
    const promise2 = service.refreshToken();
    const promise3 = service.refreshToken();

    // Resolve the single fetch
    resolveFetch(mockSuccessfulRefresh());

    // All 3 should resolve with the same result
    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
    expect(result1.message).toContain('Token refreshed successfully');
    expect(result2.message).toContain('Token refreshed successfully');
    expect(result3.message).toContain('Token refreshed successfully');

    // fetch should only be called once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should clear refreshPromise after completion, allowing new refresh calls', async () => {
    mockReadFile.mockResolvedValue(makeExpiringCredentials());
    fetchSpy.mockResolvedValue(mockSuccessfulRefresh());

    // First refresh
    const result1 = await service.refreshToken();
    expect(result1.success).toBe(true);

    // Second refresh (should be a new API call, not reusing old promise)
    mockReadFile.mockResolvedValue(makeExpiringCredentials());
    const result2 = await service.refreshToken();
    expect(result2.success).toBe(true);

    // fetch should be called twice (once per refresh)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should clear refreshPromise after failure, allowing retry', async () => {
    mockReadFile.mockResolvedValue(makeExpiringCredentials());

    // First call fails with a network error
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result1 = await service.refreshToken();
    expect(result1.success).toBe(false);

    // Second call should be able to start a new refresh
    mockReadFile.mockResolvedValue(makeExpiringCredentials());
    fetchSpy.mockResolvedValueOnce(mockSuccessfulRefresh());

    const result2 = await service.refreshToken();
    expect(result2.success).toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
