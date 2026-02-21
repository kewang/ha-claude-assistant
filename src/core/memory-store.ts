/**
 * 長期記憶持久化儲存
 *
 * 提供跨對話的長期記憶儲存，讓助理能記住使用者偏好、設備暱稱、生活習慣等。
 * 類似 Claude Code 的 MEMORY.md 概念。
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('MemoryStore');

export interface Memory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface MemoryStoreOptions {
  maxItems?: number;
  filePath?: string;
}

/**
 * 取得預設資料路徑
 */
function getDefaultDataPath(): string {
  const env = detectEnvironment();
  if (env.isAddon) {
    return '/data/memories/memories.json';
  }
  return join(__dirname, '../../data/memories.json');
}

export class MemoryStore {
  private filePath: string;
  private memories: Map<string, Memory> = new Map();
  private maxItems: number;

  constructor(options?: MemoryStoreOptions) {
    this.filePath = options?.filePath || getDefaultDataPath();
    this.maxItems = options?.maxItems
      ?? (parseInt(process.env.MEMORY_MAX_ITEMS || '', 10) || 100);
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

      const memories: Memory[] = JSON.parse(data);
      this.memories.clear();
      for (const memory of memories) {
        this.memories.set(memory.id, memory);
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
    const data = JSON.stringify(this.getAll(), null, 2);
    await writeFile(this.filePath, data, 'utf-8');
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  async add(content: string): Promise<Memory | { error: string }> {
    if (this.memories.size >= this.maxItems) {
      return { error: `記憶已滿（上限 ${this.maxItems} 筆），請先刪除不需要的記憶` };
    }

    const id = this.generateId();
    const now = new Date().toISOString();

    const memory: Memory = {
      id,
      content,
      createdAt: now,
      updatedAt: now,
    };

    this.memories.set(id, memory);
    await this.save();

    return memory;
  }

  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  get(id: string): Memory | undefined {
    return this.memories.get(id);
  }

  async update(id: string, content: string): Promise<Memory | undefined> {
    const memory = this.memories.get(id);
    if (!memory) {
      return undefined;
    }

    const updated: Memory = {
      ...memory,
      content,
      updatedAt: new Date().toISOString(),
    };

    this.memories.set(id, updated);
    await this.save();

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.memories.delete(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }

  search(keyword: string): Memory[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(
      (memory) => memory.content.toLowerCase().includes(lowerKeyword)
    );
  }
}

/**
 * 將長期記憶注入到 prompt 中
 */
export function buildPromptWithMemory(memories: Memory[], prompt: string): string {
  if (memories.length === 0) {
    return prompt;
  }

  const lines = memories.map((m) => `- ${m.content}`);

  return `<long_term_memory>\n${lines.join('\n')}\n</long_term_memory>\n\n${prompt}`;
}

export default MemoryStore;
