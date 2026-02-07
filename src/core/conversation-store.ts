/**
 * 對話記憶持久化
 *
 * 儲存對話歷史，支援 Slack Bot、CLI、Scheduler 等介面。
 * 透過 prompt injection 方式將歷史注入到每次 claude --print 的 prompt 中。
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('ConversationStore');

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601
}

export interface Conversation {
  id: string;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}

interface ConversationStoreOptions {
  maxTurns?: number;
  maxChars?: number;
  maxAgeDays?: number;
  filePath?: string;
}

/**
 * 取得預設資料路徑
 */
function getDefaultDataPath(): string {
  const env = detectEnvironment();
  if (env.isAddon) {
    return '/data/conversations/conversations.json';
  }
  return join(__dirname, '../../data/conversations/conversations.json');
}

export class ConversationStore {
  private filePath: string;
  private conversations: Map<string, Conversation> = new Map();
  private maxTurns: number;
  private maxChars: number;
  private maxAgeDays: number;

  constructor(options?: ConversationStoreOptions) {
    this.filePath = options?.filePath || getDefaultDataPath();
    this.maxTurns = options?.maxTurns
      ?? (parseInt(process.env.CONVERSATION_MAX_TURNS || '', 10) || 20);
    this.maxChars = options?.maxChars
      ?? (parseInt(process.env.CONVERSATION_MAX_CHARS || '', 10) || 8000);
    this.maxAgeDays = options?.maxAgeDays
      ?? (parseInt(process.env.CONVERSATION_MAX_AGE_DAYS || '', 10) || 7);
  }

  async init(): Promise<void> {
    await this.ensureDataDir();
    await this.load();
  }

  private async ensureDataDir(): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private async load(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) {
        await this.save();
        return;
      }

      const data = await readFile(this.filePath, 'utf-8');

      if (!data.trim()) {
        logger.warn('檔案為空，跳過載入');
        return;
      }

      const parsed: Record<string, Conversation> = JSON.parse(data);
      this.conversations.clear();
      for (const [key, conv] of Object.entries(parsed)) {
        this.conversations.set(key, conv);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.save();
      } else if (error instanceof SyntaxError) {
        logger.warn('JSON 解析錯誤，保留現有資料');
      } else {
        throw error;
      }
    }
  }

  private async save(): Promise<void> {
    await this.ensureDataDir();
    const obj: Record<string, Conversation> = {};
    for (const [key, conv] of this.conversations) {
      obj[key] = conv;
    }
    await writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
  }

  async getHistory(id: string): Promise<ConversationTurn[]> {
    const conv = this.conversations.get(id);
    return conv ? [...conv.turns] : [];
  }

  async addExchange(id: string, userMessage: string, assistantResponse: string): Promise<void> {
    const now = new Date().toISOString();

    let conv = this.conversations.get(id);
    if (!conv) {
      conv = {
        id,
        turns: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    conv.turns.push(
      { role: 'user', content: userMessage, timestamp: now },
      { role: 'assistant', content: assistantResponse, timestamp: now },
    );
    conv.updatedAt = now;

    this.trim(conv);
    this.conversations.set(id, conv);
    await this.save();
  }

  async clear(id: string): Promise<void> {
    this.conversations.delete(id);
    await this.save();
  }

  async cleanup(): Promise<number> {
    const cutoff = Date.now() - this.maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [key, conv] of this.conversations) {
      const updatedAt = new Date(conv.updatedAt).getTime();
      if (updatedAt < cutoff) {
        this.conversations.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      await this.save();
      logger.info(`清除了 ${removed} 筆過期對話`);
    }

    return removed;
  }

  private trim(conv: Conversation): void {
    // 先按 maxTurns 裁剪
    if (conv.turns.length > this.maxTurns) {
      conv.turns = conv.turns.slice(conv.turns.length - this.maxTurns);
    }

    // 再按 maxChars 裁剪
    let totalChars = conv.turns.reduce((sum, t) => sum + t.content.length, 0);
    while (totalChars > this.maxChars && conv.turns.length > 0) {
      const removed = conv.turns.shift()!;
      totalChars -= removed.content.length;
    }
  }
}

/**
 * 將對話歷史注入到 prompt 中
 */
export function buildPromptWithHistory(history: ConversationTurn[], newPrompt: string): string {
  if (history.length === 0) {
    return newPrompt;
  }

  const lines = history.map((turn) => {
    const label = turn.role === 'user' ? '[User]' : '[Assistant]';
    return `${label}: ${turn.content}`;
  });

  return `<conversation_history>\n${lines.join('\n')}\n</conversation_history>\n\n${newPrompt}`;
}

export default ConversationStore;
