/**
 * Claude OAuth PKCE Flow 模組
 *
 * 實作 OAuth 2.0 PKCE (Proof Key for Code Exchange) 流程，
 * 讓使用者透過 Web UI 完成 Claude 登入。
 *
 * 流程：
 * 1. 產生 PKCE code_verifier + code_challenge
 * 2. 建構授權 URL
 * 3. 使用者在瀏覽器完成授權，取得授權碼
 * 4. 用授權碼 + code_verifier 交換 tokens
 * 5. 寫入 credentials 檔案
 */

import { randomBytes, createHash } from 'crypto';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getOAuthConfig } from './claude-oauth-config.js';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('OAuthFlow');

// 從 Claude CLI binary 提取的 OAuth endpoints
const REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';
const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';

// PKCE session 存活時間（10 分鐘）
const SESSION_TTL_MS = 10 * 60 * 1000;

export interface PKCESession {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  createdAt: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// 存放進行中的 PKCE sessions（state → session）
const activeSessions = new Map<string, PKCESession>();

/**
 * 產生 PKCE code_verifier 和 code_challenge
 *
 * code_verifier: 32 random bytes, base64url encoded
 * code_challenge: SHA-256(code_verifier), base64url encoded
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32)
    .toString('base64url');

  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/**
 * 產生隨機 state 參數（防 CSRF）
 */
export function generateState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * 建構 OAuth 授權 URL
 */
export function buildAuthorizationUrl(codeChallenge: string, state: string): string {
  const oauthConfig = getOAuthConfig();

  const params = new URLSearchParams({
    code: 'true',
    client_id: oauthConfig.clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 開始一個新的 OAuth 登入流程
 *
 * 產生 PKCE、state，建立 session，回傳授權 URL
 */
export function startAuthFlow(): { authUrl: string; state: string } {
  // 清理過期 sessions
  cleanupExpiredSessions();

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  const session: PKCESession = {
    codeVerifier,
    codeChallenge,
    state,
    createdAt: Date.now(),
  };

  activeSessions.set(state, session);

  const authUrl = buildAuthorizationUrl(codeChallenge, state);

  logger.info('OAuth flow started');
  logger.debug(`State: ${state}`);

  return { authUrl, state };
}

/**
 * 用授權碼交換 tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<TokenResponse> {
  const session = activeSessions.get(state);

  if (!session) {
    throw new Error('Invalid or expired session. Please start the login flow again.');
  }

  // 檢查 session 是否過期
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(state);
    throw new Error('Session expired. Please start the login flow again.');
  }

  const oauthConfig = getOAuthConfig();

  logger.info('Exchanging authorization code for tokens...');

  const response = await fetch(oauthConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: oauthConfig.clientId,
      code_verifier: session.codeVerifier,
    }),
  });

  // 用完即刪除 session
  activeSessions.delete(state);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Token exchange failed: ${response.status} ${errorText}`);
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokens = await response.json() as TokenResponse;
  logger.info('Token exchange successful');

  return tokens;
}

/**
 * 將 tokens 儲存到 credentials 檔案
 */
export async function saveCredentials(tokens: TokenResponse): Promise<void> {
  const env = detectEnvironment();
  const configDir = env.claudeConfigDir || `${process.env.HOME}/.claude`;
  const credentialsPath = path.join(configDir, '.credentials.json');

  // 確保目錄存在
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  // 讀取現有 credentials（如果有的話）
  let existing: Record<string, unknown> = {};
  if (existsSync(credentialsPath)) {
    try {
      const content = await readFile(credentialsPath, 'utf-8');
      existing = JSON.parse(content);
    } catch {
      // 忽略讀取失敗，使用空物件
    }
  }

  // 計算過期時間
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // 更新 OAuth credentials
  existing.claudeAiOauth = {
    ...(existing.claudeAiOauth && typeof existing.claudeAiOauth === 'object'
      ? existing.claudeAiOauth
      : {}),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: expiresAt.toISOString(),
  };

  await writeFile(credentialsPath, JSON.stringify(existing, null, 2), 'utf-8');
  logger.info(`Credentials saved to ${credentialsPath}`);
}

/**
 * 清理過期的 PKCE sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [state, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(state);
    }
  }
}

/**
 * 取得目前的 active sessions 數量（用於測試/除錯）
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

/**
 * 清除所有 sessions（用於測試）
 */
export function clearAllSessions(): void {
  activeSessions.clear();
}
