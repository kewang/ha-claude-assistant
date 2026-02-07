import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { ConversationStore, buildPromptWithHistory } from '../src/core/conversation-store.js';

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

describe('buildPromptWithHistory', () => {
  it('空歷史回傳原始 prompt', () => {
    expect(buildPromptWithHistory([], '你好')).toBe('你好');
  });

  it('有歷史回傳含 conversation_history 的格式', () => {
    const history = [
      { role: 'user' as const, content: '客廳溫度多少？', timestamp: '2026-01-01T00:00:00.000Z' },
      { role: 'assistant' as const, content: '客廳目前溫度是 25.3°C。', timestamp: '2026-01-01T00:00:01.000Z' },
    ];

    const result = buildPromptWithHistory(history, '那臥室呢？');

    expect(result).toContain('<conversation_history>');
    expect(result).toContain('[User]: 客廳溫度多少？');
    expect(result).toContain('[Assistant]: 客廳目前溫度是 25.3°C。');
    expect(result).toContain('</conversation_history>');
    expect(result).toContain('那臥室呢？');
    // 確認新 prompt 在歷史之後
    expect(result.indexOf('</conversation_history>')).toBeLessThan(result.indexOf('那臥室呢？'));
  });

  it('保留特殊字元', () => {
    const history = [
      { role: 'user' as const, content: '溫度 > 30°C 嗎？', timestamp: '2026-01-01T00:00:00.000Z' },
      { role: 'assistant' as const, content: '不，目前是 25°C < 30°C。', timestamp: '2026-01-01T00:00:01.000Z' },
    ];

    const result = buildPromptWithHistory(history, '好的');
    expect(result).toContain('溫度 > 30°C 嗎？');
    expect(result).toContain('不，目前是 25°C < 30°C。');
  });
});

describe('ConversationStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'conv-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createStore(options?: { maxTurns?: number; maxChars?: number; maxAgeDays?: number }) {
    return new ConversationStore({
      ...options,
      filePath: join(tempDir, 'conversations.json'),
    });
  }

  it('init() 建立目錄和檔案', async () => {
    const store = new ConversationStore({
      filePath: join(tempDir, 'subdir', 'conversations.json'),
    });
    await store.init();

    const { existsSync } = await import('fs');
    expect(existsSync(join(tempDir, 'subdir', 'conversations.json'))).toBe(true);
  });

  it('getHistory() 未知 id 回傳空陣列', async () => {
    const store = createStore();
    await store.init();

    const history = await store.getHistory('unknown');
    expect(history).toEqual([]);
  });

  it('addExchange() 正確新增並持久化', async () => {
    const store = createStore();
    await store.init();

    await store.addExchange('test-1', '你好', '你好！有什麼可以幫忙的嗎？');

    const history = await store.getHistory('test-1');
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('你好');
    expect(history[1].role).toBe('assistant');
    expect(history[1].content).toBe('你好！有什麼可以幫忙的嗎？');
  });

  it('addExchange() 多輪對話累積', async () => {
    const store = createStore();
    await store.init();

    await store.addExchange('test-1', '客廳溫度？', '25°C');
    await store.addExchange('test-1', '那臥室呢？', '23°C');

    const history = await store.getHistory('test-1');
    expect(history).toHaveLength(4);
    expect(history[2].content).toBe('那臥室呢？');
    expect(history[3].content).toBe('23°C');
  });

  it('trim: 超過 maxTurns 時裁剪最舊的', async () => {
    const store = createStore({ maxTurns: 4 }); // 4 turns = 2 exchanges
    await store.init();

    await store.addExchange('test-1', '第一輪', '回覆一');
    await store.addExchange('test-1', '第二輪', '回覆二');
    await store.addExchange('test-1', '第三輪', '回覆三');

    const history = await store.getHistory('test-1');
    expect(history).toHaveLength(4);
    // 最舊的應該被移除
    expect(history[0].content).toBe('第二輪');
    expect(history[1].content).toBe('回覆二');
  });

  it('trim: 超過 maxChars 時裁剪最舊的', async () => {
    const store = createStore({ maxTurns: 100, maxChars: 50 });
    await store.init();

    // 每個 exchange 約 20+ chars
    await store.addExchange('test-1', 'A'.repeat(15), 'B'.repeat(15));
    await store.addExchange('test-1', 'C'.repeat(15), 'D'.repeat(15));

    const history = await store.getHistory('test-1');
    // 總共 60 chars > 50，應該裁剪到 <= 50
    const totalChars = history.reduce((sum, t) => sum + t.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(50);
  });

  it('clear() 清除指定對話', async () => {
    const store = createStore();
    await store.init();

    await store.addExchange('test-1', '你好', '嗨');
    await store.addExchange('test-2', '哈囉', '嗨嗨');

    await store.clear('test-1');

    const history1 = await store.getHistory('test-1');
    const history2 = await store.getHistory('test-2');
    expect(history1).toEqual([]);
    expect(history2).toHaveLength(2);
  });

  it('cleanup() 移除過期對話、保留新鮮對話', async () => {
    const store = createStore({ maxAgeDays: 1 });
    await store.init();

    // 新增一筆對話
    await store.addExchange('fresh', '新的', '新回覆');

    // 手動注入一筆過期對話（直接操作內部狀態）
    await store.addExchange('old', '舊的', '舊回覆');

    // 讀取檔案，修改 updatedAt 為 2 天前
    const { readFile, writeFile } = await import('fs/promises');
    const filePath = join(tempDir, 'conversations.json');
    const data = JSON.parse(await readFile(filePath, 'utf-8'));
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    data['old'].updatedAt = twoDaysAgo;
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // 重新初始化以載入修改後的資料
    const store2 = createStore({ maxAgeDays: 1 });
    await store2.init();

    const removed = await store2.cleanup();
    expect(removed).toBe(1);

    const historyOld = await store2.getHistory('old');
    const historyFresh = await store2.getHistory('fresh');
    expect(historyOld).toEqual([]);
    expect(historyFresh).toHaveLength(2);
  });

  it('跨實例持久化', async () => {
    const store1 = createStore();
    await store1.init();
    await store1.addExchange('test-1', '問題', '回答');

    const store2 = createStore();
    await store2.init();

    const history = await store2.getHistory('test-1');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('問題');
    expect(history[1].content).toBe('回答');
  });
});
