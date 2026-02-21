import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { MemoryStore, buildPromptWithMemory } from '../src/core/memory-store.js';

// Mock env-detect
vi.mock('../src/core/env-detect.js', () => ({
  detectEnvironment: () => ({
    isAddon: false,
    supervisorUrl: '',
    dataPath: '',
    claudePath: '',
    claudeConfigDir: '',
  }),
}));

describe('buildPromptWithMemory', () => {
  it('空記憶回傳原始 prompt', () => {
    expect(buildPromptWithMemory([], '你好')).toBe('你好');
  });

  it('有記憶回傳含 long_term_memory 的格式', () => {
    const memories = [
      { id: '1', content: '使用者偏好冷氣 24°C', createdAt: '', updatedAt: '' },
      { id: '2', content: '書桌燈是 light.office_desk', createdAt: '', updatedAt: '' },
    ];

    const result = buildPromptWithMemory(memories, '開冷氣');

    expect(result).toContain('<long_term_memory>');
    expect(result).toContain('- 使用者偏好冷氣 24°C');
    expect(result).toContain('- 書桌燈是 light.office_desk');
    expect(result).toContain('</long_term_memory>');
    expect(result).toContain('開冷氣');
    expect(result.indexOf('</long_term_memory>')).toBeLessThan(result.indexOf('開冷氣'));
  });
});

describe('MemoryStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createStore(options?: { maxItems?: number }) {
    return new MemoryStore({
      ...options,
      filePath: join(tempDir, 'memories.json'),
    });
  }

  it('init() 建立目錄和檔案', async () => {
    const store = new MemoryStore({
      filePath: join(tempDir, 'subdir', 'memories.json'),
    });
    await store.init();

    const { existsSync } = await import('fs');
    expect(existsSync(join(tempDir, 'subdir', 'memories.json'))).toBe(true);
  });

  it('getAll() 初始回傳空陣列', async () => {
    const store = createStore();
    await store.init();

    expect(store.getAll()).toEqual([]);
  });

  it('add() 正確新增記憶', async () => {
    const store = createStore();
    await store.init();

    const result = await store.add('使用者偏好冷氣 24°C');

    expect('error' in result).toBe(false);
    const memory = result as { id: string; content: string; createdAt: string; updatedAt: string };
    expect(memory.id).toBeTruthy();
    expect(memory.content).toBe('使用者偏好冷氣 24°C');
    expect(memory.createdAt).toBeTruthy();
    expect(memory.updatedAt).toBeTruthy();
  });

  it('add() 容量滿時回傳錯誤', async () => {
    const store = createStore({ maxItems: 2 });
    await store.init();

    await store.add('記憶一');
    await store.add('記憶二');
    const result = await store.add('記憶三');

    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toContain('記憶已滿');
  });

  it('get() 取得單一記憶', async () => {
    const store = createStore();
    await store.init();

    const added = await store.add('測試記憶') as { id: string; content: string };
    const memory = store.get(added.id);

    expect(memory).toBeDefined();
    expect(memory!.content).toBe('測試記憶');
  });

  it('get() 不存在的 ID 回傳 undefined', async () => {
    const store = createStore();
    await store.init();

    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('update() 更新記憶內容', async () => {
    const store = createStore();
    await store.init();

    const added = await store.add('原始內容') as { id: string };
    // 等待一小段時間確保時間戳不同
    await new Promise(resolve => setTimeout(resolve, 10));
    const updated = await store.update(added.id, '更新後內容');

    expect(updated).toBeDefined();
    expect(updated!.content).toBe('更新後內容');
    expect(updated!.updatedAt).not.toBe(updated!.createdAt);
  });

  it('update() 不存在的 ID 回傳 undefined', async () => {
    const store = createStore();
    await store.init();

    const result = await store.update('nonexistent', '內容');
    expect(result).toBeUndefined();
  });

  it('delete() 刪除記憶', async () => {
    const store = createStore();
    await store.init();

    const added = await store.add('要刪除的') as { id: string };
    const result = await store.delete(added.id);

    expect(result).toBe(true);
    expect(store.get(added.id)).toBeUndefined();
    expect(store.getAll()).toHaveLength(0);
  });

  it('delete() 不存在的 ID 回傳 false', async () => {
    const store = createStore();
    await store.init();

    const result = await store.delete('nonexistent');
    expect(result).toBe(false);
  });

  it('search() 關鍵字搜尋（不分大小寫）', async () => {
    const store = createStore();
    await store.init();

    await store.add('使用者偏好冷氣 24°C');
    await store.add('書桌燈是 light.office_desk');
    await store.add('使用者每天 7 點起床');

    const results = store.search('使用者');
    expect(results).toHaveLength(2);

    const results2 = store.search('LIGHT');
    expect(results2).toHaveLength(1);
    expect(results2[0].content).toContain('light.office_desk');
  });

  it('search() 無結果回傳空陣列', async () => {
    const store = createStore();
    await store.init();

    await store.add('測試記憶');
    const results = store.search('不存在的關鍵字');
    expect(results).toEqual([]);
  });

  it('跨實例持久化', async () => {
    const store1 = createStore();
    await store1.init();
    await store1.add('持久化測試');

    const store2 = createStore();
    await store2.init();

    const memories = store2.getAll();
    expect(memories).toHaveLength(1);
    expect(memories[0].content).toBe('持久化測試');
  });
});
