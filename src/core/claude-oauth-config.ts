/**
 * Claude OAuth 設定動態提取模組
 *
 * 優先順序：
 * 1. 從 Claude CLI 二進制文件提取 - 自動與 CLI 版本同步
 * 2. 硬編碼 Fallback - 提取失敗時的保險
 */

import { execSync } from 'child_process';
import { existsSync, readlinkSync, realpathSync } from 'fs';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('OAuthConfig');

// OAuth 設定介面
export interface OAuthConfig {
  tokenUrl: string;
  clientId: string;
  source: 'binary' | 'fallback';
}

// Fallback 設定（已更新為正確的 URL）
const FALLBACK_CONFIG: Omit<OAuthConfig, 'source'> = {
  tokenUrl: 'https://platform.claude.com/v1/oauth/token',
  clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
};

// 快取提取結果
let cachedConfig: OAuthConfig | null = null;

/**
 * 解析 Claude CLI 的實際路徑（處理 symlink）
 */
function resolveClaudePath(): string | null {
  const env = detectEnvironment();
  const claudePath = env.claudePath;

  if (!existsSync(claudePath)) {
    logger.debug(`Claude CLI not found at: ${claudePath}`);
    return null;
  }

  try {
    // 處理 symlink，取得實際檔案路徑
    const realPath = realpathSync(claudePath);
    logger.debug(`Claude CLI resolved path: ${realPath}`);
    return realPath;
  } catch {
    // 如果 realpathSync 失敗，直接使用原始路徑
    return claudePath;
  }
}

/**
 * 從 Claude CLI binary 提取 OAuth 設定
 */
function extractFromBinary(binaryPath: string): Partial<OAuthConfig> | null {
  try {
    // 使用 strings 命令從 binary 中搜尋文字
    // 搜尋包含 oauth/token 的 URL 和 UUID 格式的 CLIENT_ID
    const stringsOutput = execSync(`strings "${binaryPath}" 2>/dev/null`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    const result: Partial<OAuthConfig> = {};

    // 搜尋 TOKEN_URL - 匹配各種可能的格式
    // 格式可能是: TOKEN_URL:"https://..." 或 "https://...oauth/token"
    const tokenUrlPatterns = [
      /TOKEN_URL[":]+\s*(https:\/\/[^"'\s]+\/oauth\/token)/i,
      /(https:\/\/[^"'\s]+\/v1\/oauth\/token)/i,
      /(https:\/\/platform\.claude\.com[^"'\s]*\/oauth\/token)/i,
      /(https:\/\/console\.anthropic\.com[^"'\s]*\/oauth\/token)/i,
    ];

    for (const pattern of tokenUrlPatterns) {
      const match = stringsOutput.match(pattern);
      if (match) {
        result.tokenUrl = match[1];
        logger.debug(`Found TOKEN_URL: ${result.tokenUrl}`);
        break;
      }
    }

    // 搜尋 CLIENT_ID - UUID 格式
    // 格式可能是: CLIENT_ID:"uuid" 或直接在 oauth 相關區域的 UUID
    const clientIdPatterns = [
      /CLIENT_ID[":]+\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      /client_id[":]+\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    ];

    for (const pattern of clientIdPatterns) {
      const match = stringsOutput.match(pattern);
      if (match) {
        result.clientId = match[1];
        logger.debug(`Found CLIENT_ID: ${result.clientId}`);
        break;
      }
    }

    // 如果沒有透過 pattern 找到，嘗試在 oauth token URL 附近搜尋 UUID
    if (!result.clientId && result.tokenUrl) {
      // 搜尋所有 UUID 格式的字串
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const uuids = stringsOutput.match(uuidPattern);

      if (uuids && uuids.length > 0) {
        // 使用已知的 CLIENT_ID 作為驗證
        const knownClientId = FALLBACK_CONFIG.clientId;
        if (uuids.includes(knownClientId)) {
          result.clientId = knownClientId;
          logger.debug(`Found known CLIENT_ID in binary: ${result.clientId}`);
        }
      }
    }

    if (result.tokenUrl || result.clientId) {
      return result;
    }

    return null;
  } catch (error) {
    logger.debug(`Failed to extract from binary: ${error}`);
    return null;
  }
}

/**
 * 取得 OAuth 設定
 *
 * 優先從 Claude CLI binary 提取，失敗時使用 fallback
 */
export function getOAuthConfig(): OAuthConfig {
  // 使用快取
  if (cachedConfig) {
    return cachedConfig;
  }

  // 嘗試從 binary 提取
  const binaryPath = resolveClaudePath();

  if (binaryPath) {
    const extracted = extractFromBinary(binaryPath);

    if (extracted) {
      // 合併提取結果與 fallback（部分提取成功時）
      cachedConfig = {
        tokenUrl: extracted.tokenUrl || FALLBACK_CONFIG.tokenUrl,
        clientId: extracted.clientId || FALLBACK_CONFIG.clientId,
        source: 'binary',
      };

      logger.info(`OAuth config loaded from binary:`);
      logger.info(`  TOKEN_URL: ${cachedConfig.tokenUrl}`);
      logger.info(`  CLIENT_ID: ${cachedConfig.clientId}`);

      return cachedConfig;
    }
  }

  // 使用 fallback
  cachedConfig = {
    ...FALLBACK_CONFIG,
    source: 'fallback',
  };

  logger.info(`OAuth config using fallback:`);
  logger.info(`  TOKEN_URL: ${cachedConfig.tokenUrl}`);
  logger.info(`  CLIENT_ID: ${cachedConfig.clientId}`);

  return cachedConfig;
}

/**
 * 清除快取（主要用於測試）
 */
export function clearOAuthConfigCache(): void {
  cachedConfig = null;
}

/**
 * 取得 fallback 設定（用於比較或除錯）
 */
export function getFallbackConfig(): Omit<OAuthConfig, 'source'> {
  return { ...FALLBACK_CONFIG };
}
