import { readFile, writeFile, mkdir, watch } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logger = createLogger('EventSubscriptionStore');

export interface StoredEventSubscription {
  id: string;
  name: string;
  eventType: string;
  entityFilter: string[] | null;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventSubscriptionInput = Omit<StoredEventSubscription, 'id' | 'createdAt' | 'updatedAt'>;

function getDefaultDataPath(): string {
  const env = detectEnvironment();
  if (env.isAddon) {
    return '/data/event-subscriptions/event-subscriptions.json';
  }
  return join(__dirname, '../../data/event-subscriptions.json');
}

export class EventSubscriptionStore {
  private filePath: string;
  private subscriptions: Map<string, StoredEventSubscription> = new Map();
  private watchers: Array<() => void> = [];
  private watchController: AbortController | null = null;
  private reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath || getDefaultDataPath();
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

  async load(): Promise<void> {
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

      const subscriptions: StoredEventSubscription[] = JSON.parse(data);

      this.subscriptions.clear();
      for (const sub of subscriptions) {
        this.subscriptions.set(sub.id, sub);
      }

      logger.info(`Loaded ${subscriptions.length} subscription(s): ${subscriptions.map(s => `"${s.name}" (filter: ${s.entityFilter ? JSON.stringify(s.entityFilter) : 'none'})`).join(', ')}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.save();
      } else if (error instanceof SyntaxError) {
        logger.warn('JSON 解析錯誤，可能正在寫入中，保留現有資料');
      } else {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    await this.ensureDataDir();
    const data = JSON.stringify(this.getAll(), null, 2);
    await writeFile(this.filePath, data, 'utf-8');
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  async create(input: EventSubscriptionInput): Promise<StoredEventSubscription> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const subscription: StoredEventSubscription = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(id, subscription);
    await this.save();

    return subscription;
  }

  getAll(): StoredEventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  get(id: string): StoredEventSubscription | undefined {
    return this.subscriptions.get(id);
  }

  findByName(name: string): StoredEventSubscription | undefined {
    const lowerName = name.toLowerCase();
    for (const sub of this.subscriptions.values()) {
      if (sub.name.toLowerCase().includes(lowerName)) {
        return sub;
      }
    }
    return undefined;
  }

  async update(id: string, updates: Partial<EventSubscriptionInput>): Promise<StoredEventSubscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return undefined;
    }

    const updated: StoredEventSubscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(id, updated);
    await this.save();

    return updated;
  }

  async enable(id: string): Promise<boolean> {
    const result = await this.update(id, { enabled: true } as Partial<EventSubscriptionInput>);
    return result !== undefined;
  }

  async disable(id: string): Promise<boolean> {
    const result = await this.update(id, { enabled: false } as Partial<EventSubscriptionInput>);
    return result !== undefined;
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.subscriptions.delete(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }

  async startWatching(onChange: () => void): Promise<void> {
    this.watchers.push(onChange);

    if (this.watchController) {
      return;
    }

    this.watchController = new AbortController();

    try {
      const watcher = watch(this.filePath, { signal: this.watchController.signal });

      (async () => {
        try {
          for await (const _event of watcher) {
            // 處理所有事件類型（change 和 rename），避免因 Linux 核心差異遺漏
            if (this.reloadTimeout) {
              clearTimeout(this.reloadTimeout);
            }
            this.reloadTimeout = setTimeout(async () => {
              try {
                await this.load();
                for (const callback of this.watchers) {
                  callback();
                }
              } catch (error) {
                logger.error('Reload error:', error);
              }
            }, 500);
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            logger.error('Watch error:', error);
          }
        }
      })();

    } catch (error) {
      logger.error('Failed to start watching:', error);
    }
  }

  stopWatching(): void {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }
    if (this.watchController) {
      this.watchController.abort();
      this.watchController = null;
    }
    this.watchers = [];
  }
}
