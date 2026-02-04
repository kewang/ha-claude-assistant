/**
 * 統一的 Logger 工具
 *
 * 為所有 log 輸出加入時間戳記，方便 debug 時追蹤事件發生順序。
 *
 * 特性：
 * - 時間格式：[YYYY-MM-DD HH:mm:ss]（Asia/Taipei 時區）
 * - 保留現有前綴慣例（[Slack]、[Scheduler] 等）
 * - MCP Server 專用模式（所有輸出走 stderr）
 * - raw() 方法給 user-facing 輸出用（無時間戳）
 */

export interface LoggerOptions {
  /** 使用 stderr 輸出（MCP Server 需要） */
  useStderr?: boolean;
}

/**
 * 格式化時間戳記
 * 格式：YYYY-MM-DD HH:mm:ss（Asia/Taipei 時區）
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(' ', ' ');
}

/**
 * Logger 類別
 */
export class Logger {
  private prefix: string;
  private useStderr: boolean;

  constructor(prefix: string, options?: LoggerOptions) {
    this.prefix = prefix;
    this.useStderr = options?.useStderr ?? false;
  }

  /**
   * 格式化訊息（含時間戳和前綴）
   */
  private format(message: string): string {
    return `[${formatTimestamp()}] [${this.prefix}] ${message}`;
  }

  /**
   * 一般資訊
   */
  info(message: string, ...args: unknown[]): void {
    const formatted = this.format(message);
    if (this.useStderr) {
      console.error(formatted, ...args);
    } else {
      console.log(formatted, ...args);
    }
  }

  /**
   * 警告訊息
   */
  warn(message: string, ...args: unknown[]): void {
    const formatted = this.format(message);
    if (this.useStderr) {
      console.error(formatted, ...args);
    } else {
      console.warn(formatted, ...args);
    }
  }

  /**
   * 錯誤訊息
   */
  error(message: string, ...args: unknown[]): void {
    console.error(this.format(message), ...args);
  }

  /**
   * Debug 訊息（僅在 DEBUG 環境變數啟用時輸出）
   */
  debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG) {
      const formatted = this.format(`[DEBUG] ${message}`);
      if (this.useStderr) {
        console.error(formatted, ...args);
      } else {
        console.log(formatted, ...args);
      }
    }
  }

  /**
   * 原始輸出（無時間戳，給 user-facing 輸出用）
   */
  raw(message: string): void {
    if (this.useStderr) {
      console.error(message);
    } else {
      console.log(message);
    }
  }
}

/**
 * 建立 Logger 實例
 */
export function createLogger(prefix: string, options?: LoggerOptions): Logger {
  return new Logger(prefix, options);
}

export default Logger;
