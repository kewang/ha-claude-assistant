import { readFile, writeFile, mkdir, watch } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface StoredSchedule {
  id: string;
  name: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleInput = Omit<StoredSchedule, 'id' | 'createdAt' | 'updatedAt'>;

const DEFAULT_DATA_PATH = join(__dirname, '../../data/schedules.json');

export class ScheduleStore {
  private filePath: string;
  private schedules: Map<string, StoredSchedule> = new Map();
  private watchers: Array<() => void> = [];
  private watchController: AbortController | null = null;
  private reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_DATA_PATH;
  }

  /**
   * 初始化 store，讀取現有資料
   */
  async init(): Promise<void> {
    await this.ensureDataDir();
    await this.load();
  }

  /**
   * 確保資料目錄存在
   */
  private async ensureDataDir(): Promise<void> {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  /**
   * 從檔案載入排程
   */
  async load(): Promise<void> {
    try {
      if (!existsSync(this.filePath)) {
        await this.save();
        return;
      }

      const data = await readFile(this.filePath, 'utf-8');

      // 跳過空檔案（可能正在寫入中）
      if (!data.trim()) {
        console.warn('[ScheduleStore] 檔案為空，跳過載入');
        return;
      }

      const schedules: StoredSchedule[] = JSON.parse(data);

      this.schedules.clear();
      for (const schedule of schedules) {
        this.schedules.set(schedule.id, schedule);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.save();
      } else if (error instanceof SyntaxError) {
        // JSON 解析錯誤，可能是檔案正在寫入中，稍後重試
        console.warn('[ScheduleStore] JSON 解析錯誤，可能正在寫入中，保留現有資料');
      } else {
        throw error;
      }
    }
  }

  /**
   * 儲存排程到檔案
   */
  async save(): Promise<void> {
    await this.ensureDataDir();
    const data = JSON.stringify(this.getAll(), null, 2);
    await writeFile(this.filePath, data, 'utf-8');
  }

  /**
   * 產生唯一 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * 新增排程
   */
  async create(input: ScheduleInput): Promise<StoredSchedule> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const schedule: StoredSchedule = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    this.schedules.set(id, schedule);
    await this.save();

    return schedule;
  }

  /**
   * 取得所有排程
   */
  getAll(): StoredSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * 取得單一排程
   */
  get(id: string): StoredSchedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * 依名稱搜尋排程
   */
  findByName(name: string): StoredSchedule | undefined {
    const lowerName = name.toLowerCase();
    for (const schedule of this.schedules.values()) {
      if (schedule.name.toLowerCase().includes(lowerName)) {
        return schedule;
      }
    }
    return undefined;
  }

  /**
   * 更新排程
   */
  async update(id: string, updates: Partial<ScheduleInput>): Promise<StoredSchedule | undefined> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return undefined;
    }

    const updated: StoredSchedule = {
      ...schedule,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.schedules.set(id, updated);
    await this.save();

    return updated;
  }

  /**
   * 啟用排程
   */
  async enable(id: string): Promise<boolean> {
    const result = await this.update(id, { enabled: true });
    return result !== undefined;
  }

  /**
   * 停用排程
   */
  async disable(id: string): Promise<boolean> {
    const result = await this.update(id, { enabled: false });
    return result !== undefined;
  }

  /**
   * 刪除排程
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.schedules.delete(id);
    if (existed) {
      await this.save();
    }
    return existed;
  }

  /**
   * 監控檔案變更（含 debounce 避免寫入中途觸發）
   */
  async startWatching(onChange: () => void): Promise<void> {
    this.watchers.push(onChange);

    if (this.watchController) {
      return; // 已經在監控
    }

    this.watchController = new AbortController();

    try {
      const watcher = watch(this.filePath, { signal: this.watchController.signal });

      (async () => {
        try {
          for await (const event of watcher) {
            if (event.eventType === 'change') {
              // Debounce: 等待 500ms 確保檔案寫入完成
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
                  console.error('[ScheduleStore] Reload error:', error);
                }
              }, 500);
            }
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('[ScheduleStore] Watch error:', error);
          }
        }
      })();
    } catch (error) {
      console.error('[ScheduleStore] Failed to start watching:', error);
    }
  }

  /**
   * 停止監控
   */
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

export default ScheduleStore;
