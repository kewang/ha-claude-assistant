/**
 * Claude Token 自動刷新服務
 *
 * 使用 refresh token 定期刷新 access token，避免用戶需要手動重新登入。
 *
 * Token 生命週期：
 * - Access token: 約 8-12 小時過期
 * - Refresh token: 約 7-30 天過期
 *
 * 刷新策略：
 * - 每 5 分鐘檢查一次
 * - 在 access token 過期前 30 分鐘自動刷新
 * - Refresh token 過期時發送 Slack 通知
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';
import { getOAuthConfig, type OAuthConfig } from './claude-oauth-config.js';

const logger = createLogger('TokenRefresh');

// 刷新策略設定
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘
const REFRESH_BEFORE_EXPIRY_MS = 30 * 60 * 1000; // 過期前 30 分鐘刷新

// Credentials 檔案結構
interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp in milliseconds
    // OAuth 刷新時需要保留的額外欄位
    rateLimitTier?: string;
    scopes?: string[];
    subscriptionType?: string;
    [key: string]: unknown; // 允許其他未知欄位
  };
}

// Token 刷新回應
interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // 秒
  token_type: string;
  [key: string]: unknown; // 保留 API 回傳的所有額外欄位
}

// 刷新結果
export interface RefreshResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  needsRelogin?: boolean;
}

// 通知回呼函數類型
export type NotificationCallback = (message: string) => Promise<void>;

/**
 * Claude Token 刷新服務
 */
export class ClaudeTokenRefreshService {
  private credentialsPath: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private notificationCallback: NotificationCallback | null = null;
  private isRunning = false;
  private lastRefreshAttempt: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  constructor() {
    const env = detectEnvironment();
    const configDir = env.claudeConfigDir || `${process.env.HOME}/.claude`;
    this.credentialsPath = path.join(configDir, '.credentials.json');
  }

  /**
   * 設定通知回呼（用於發送 Slack 通知）
   */
  setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * 發送通知
   */
  private async notify(message: string): Promise<void> {
    logger.info(message);
    if (this.notificationCallback) {
      try {
        await this.notificationCallback(message);
      } catch (error) {
        logger.error('Failed to send notification:', error);
      }
    }
  }

  /**
   * 讀取 credentials 檔案
   */
  private async readCredentials(): Promise<ClaudeCredentials | null> {
    if (!existsSync(this.credentialsPath)) {
      logger.info('Credentials file not found:', this.credentialsPath);
      return null;
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8');
      return JSON.parse(content) as ClaudeCredentials;
    } catch (error) {
      logger.error('Failed to read credentials:', error);
      return null;
    }
  }

  /**
   * 寫入 credentials 檔案
   */
  private async writeCredentials(credentials: ClaudeCredentials): Promise<void> {
    try {
      await writeFile(this.credentialsPath, JSON.stringify(credentials, null, 2), 'utf-8');
      logger.info('Credentials updated successfully');
    } catch (error) {
      logger.error('Failed to write credentials:', error);
      throw error;
    }
  }

  /**
   * 檢查 access token 是否即將過期
   */
  private isTokenExpiringSoon(expiresAt: number): boolean {
    return Date.now() >= expiresAt - REFRESH_BEFORE_EXPIRY_MS;
  }

  /**
   * 檢查 access token 是否已過期
   */
  private isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  /**
   * 呼叫 OAuth API 刷新 token
   */
  private async callRefreshApi(refreshToken: string): Promise<TokenRefreshResponse> {
    const oauthConfig = getOAuthConfig();

    logger.debug(`Using OAuth config (source: ${oauthConfig.source}):`);
    logger.debug(`  TOKEN_URL: ${oauthConfig.tokenUrl}`);
    logger.debug(`  CLIENT_ID: ${oauthConfig.clientId}`);

    const tokenBody = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: oauthConfig.clientId,
      scope: 'user:profile user:inference user:sessions:claude_code user:mcp_servers',
    };

    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json() as TokenRefreshResponse;
  }

  /**
   * 執行 token 刷新
   */
  async refreshToken(): Promise<RefreshResult> {
    this.lastRefreshAttempt = new Date();

    // 讀取現有 credentials
    const credentials = await this.readCredentials();
    if (!credentials?.claudeAiOauth) {
      return {
        success: false,
        message: 'No OAuth credentials found. Please login with: claude login',
        needsRelogin: true,
      };
    }

    const { refreshToken, expiresAt } = credentials.claudeAiOauth;

    // 檢查是否需要刷新
    if (!this.isTokenExpiringSoon(expiresAt)) {
      const remainingMinutes = Math.round((expiresAt - Date.now()) / 60000);
      return {
        success: true,
        message: `Token still valid for ${remainingMinutes} minutes`,
        expiresAt: new Date(expiresAt),
      };
    }

    logger.info('Token expiring soon, refreshing...');

    try {
      // 呼叫 refresh API
      const response = await this.callRefreshApi(refreshToken);

      // 計算新的過期時間（Unix timestamp in milliseconds）
      const newExpiresAt = Date.now() + response.expires_in * 1000;

      // 將 snake_case 轉為 camelCase
      const toCamelCase = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

      // 收集需要的額外欄位（跳過巢狀物件）
      const skipFields = ['access_token', 'refresh_token', 'expires_in', 'token_type', 'scope', 'organization', 'account'];
      const extraFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(response)) {
        if (skipFields.includes(key)) continue;
        if (typeof value === 'object' && value !== null) continue;
        extraFields[toCamelCase(key)] = value;
      }

      // scope 字串轉 scopes 陣列
      const scopeStr = response.scope as string | undefined;
      if (scopeStr) {
        extraFields.scopes = scopeStr.split(' ');
      }

      // 更新 credentials（保留原有欄位 + 加入 response 欄位）
      credentials.claudeAiOauth = {
        ...credentials.claudeAiOauth,
        ...extraFields,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAt: newExpiresAt,
      };

      await this.writeCredentials(credentials);

      // 重置失敗計數
      this.consecutiveFailures = 0;

      const validMinutes = Math.round(response.expires_in / 60);
      return {
        success: true,
        message: `Token refreshed successfully. Valid for ${validMinutes} minutes`,
        expiresAt: new Date(newExpiresAt),
      };
    } catch (error) {
      this.consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 檢查是否是 refresh token 過期
      const isRefreshTokenExpired =
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('refresh_token') ||
        errorMessage.includes('expired');

      if (isRefreshTokenExpired) {
        await this.notify(
          '⚠️ *Claude Token 已過期*\n' +
            'Refresh token 已失效，需要重新登入。\n' +
            '請進入容器執行：\n' +
            '```\n' +
            'docker exec -it $(docker ps -qf name=claude_ha_assistant) bash\n' +
            'su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login\n' +
            '```'
        );

        return {
          success: false,
          message: 'Refresh token expired. Manual re-login required.',
          needsRelogin: true,
        };
      }

      // 其他錯誤
      logger.error('Refresh failed:', errorMessage);

      // 連續失敗多次時發送通知
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        await this.notify(
          '⚠️ *Claude Token 刷新失敗*\n' +
            `連續 ${this.consecutiveFailures} 次刷新失敗。\n` +
            `錯誤：${errorMessage}`
        );
      }

      return {
        success: false,
        message: `Refresh failed: ${errorMessage}`,
      };
    }
  }

  /**
   * 檢查並在需要時刷新 token（用於執行 Claude CLI 前）
   */
  async ensureValidToken(): Promise<RefreshResult> {
    const credentials = await this.readCredentials();

    if (!credentials?.claudeAiOauth) {
      return {
        success: false,
        message: 'No credentials found',
        needsRelogin: true,
      };
    }

    const { expiresAt } = credentials.claudeAiOauth;

    // 如果已過期或即將過期，立即刷新
    if (this.isTokenExpired(expiresAt) || this.isTokenExpiringSoon(expiresAt)) {
      return await this.refreshToken();
    }

    return {
      success: true,
      message: 'Token is valid',
      expiresAt: new Date(expiresAt),
    };
  }

  /**
   * 取得目前 token 狀態
   */
  async getTokenStatus(): Promise<{
    hasCredentials: boolean;
    expiresAt?: Date;
    isExpired?: boolean;
    isExpiringSoon?: boolean;
    remainingMinutes?: number;
  }> {
    const credentials = await this.readCredentials();

    if (!credentials?.claudeAiOauth) {
      return { hasCredentials: false };
    }

    const { expiresAt } = credentials.claudeAiOauth;
    const remainingMs = expiresAt - Date.now();

    return {
      hasCredentials: true,
      expiresAt: new Date(expiresAt),
      isExpired: this.isTokenExpired(expiresAt),
      isExpiringSoon: this.isTokenExpiringSoon(expiresAt),
      remainingMinutes: Math.max(0, Math.round(remainingMs / 60000)),
    };
  }

  /**
   * 啟動定期檢查
   */
  start(): void {
    if (this.isRunning) {
      logger.info('Service already running');
      return;
    }

    logger.info('Starting token refresh service');
    logger.info(`Check interval: ${CHECK_INTERVAL_MS / 60000} minutes`);
    logger.info(`Refresh threshold: ${REFRESH_BEFORE_EXPIRY_MS / 60000} minutes before expiry`);

    this.isRunning = true;

    // 立即執行一次檢查
    this.performCheck().catch(console.error);

    // 設定定期檢查
    this.checkInterval = setInterval(() => {
      this.performCheck().catch(console.error);
    }, CHECK_INTERVAL_MS);
  }

  /**
   * 執行檢查
   */
  private async performCheck(): Promise<void> {
    logger.debug('Checking token status...');

    const status = await this.getTokenStatus();

    if (!status.hasCredentials) {
      logger.debug('No credentials found, skipping check');
      return;
    }

    logger.debug(
      `Token status: expires in ${status.remainingMinutes} minutes, ` +
        `expired=${status.isExpired}, expiringSoon=${status.isExpiringSoon}`
    );

    if (status.isExpired || status.isExpiringSoon) {
      const result = await this.refreshToken();
      logger.info(`Refresh result: ${result.message}`);
    }
  }

  /**
   * 停止定期檢查
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('Service stopped');
  }

  /**
   * 檢查服務是否正在運行
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// 導出單例
let instance: ClaudeTokenRefreshService | null = null;

export function getTokenRefreshService(): ClaudeTokenRefreshService {
  if (!instance) {
    instance = new ClaudeTokenRefreshService();
  }
  return instance;
}

export default ClaudeTokenRefreshService;
