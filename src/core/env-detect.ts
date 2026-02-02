/**
 * 環境偵測工具
 *
 * 判斷是否在 Home Assistant Add-on 環境中執行
 */

export interface EnvironmentInfo {
  isAddon: boolean;
  supervisorToken?: string;
  supervisorUrl: string;
  dataPath: string;
  claudePath: string;
  claudeConfigDir: string;
}

/**
 * 偵測目前的執行環境
 */
export function detectEnvironment(): EnvironmentInfo {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  const isAddon = !!supervisorToken;

  if (isAddon) {
    // Add-on 環境
    return {
      isAddon: true,
      supervisorToken,
      supervisorUrl: 'http://supervisor/core',
      dataPath: process.env.SCHEDULE_DATA_PATH || '/data/schedules/schedules.json',
      claudePath: process.env.CLAUDE_PATH || 'claude',
      claudeConfigDir: process.env.CLAUDE_CONFIG_DIR || '/data/claude',
    };
  }

  // 一般環境
  return {
    isAddon: false,
    supervisorUrl: '',
    dataPath: process.env.SCHEDULE_DATA_PATH || '',
    claudePath: process.env.CLAUDE_PATH || `${process.env.HOME}/.local/bin/claude`,
    claudeConfigDir: process.env.CLAUDE_CONFIG_DIR || '',
  };
}

/**
 * 檢查是否在 Add-on 環境
 */
export function isAddonEnvironment(): boolean {
  return !!process.env.SUPERVISOR_TOKEN;
}

/**
 * 取得 Home Assistant API 設定
 * Add-on 環境使用 Supervisor API，一般環境使用 HA_URL
 */
export function getHAConfig(): { url: string; token: string } | null {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;

  if (supervisorToken) {
    // Add-on 環境：使用 Supervisor API
    return {
      url: 'http://supervisor/core',
      token: supervisorToken,
    };
  }

  // 一般環境：使用 HA_URL 和 HA_TOKEN
  const url = process.env.HA_URL;
  const token = process.env.HA_TOKEN;

  if (url && token) {
    return { url, token };
  }

  return null;
}

export default {
  detectEnvironment,
  isAddonEnvironment,
  getHAConfig,
};
