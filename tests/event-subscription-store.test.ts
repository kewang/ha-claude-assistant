import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { EventSubscriptionStore } from '../src/core/event-subscription-store.js';

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

describe('EventSubscriptionStore', () => {
  let tmpDir: string;
  let store: EventSubscriptionStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'event-sub-test-'));
    store = new EventSubscriptionStore(join(tmpDir, 'subscriptions.json'));
    await store.init();
  });

  afterEach(async () => {
    store.stopWatching();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('init 後 getAll 回傳空陣列', () => {
    expect(store.getAll()).toHaveLength(0);
  });

  it('create 建立訂閱並回傳含 id', async () => {
    const sub = await store.create({
      name: '前門通知',
      eventType: 'state_changed',
      entityFilter: 'binary_sensor.front_door',
      description: '請通知前門狀態變化',
      enabled: true,
    });

    expect(sub.id).toBeDefined();
    expect(sub.name).toBe('前門通知');
    expect(sub.eventType).toBe('state_changed');
    expect(sub.entityFilter).toBe('binary_sensor.front_door');
    expect(sub.enabled).toBe(true);
    expect(sub.createdAt).toBeDefined();
    expect(sub.updatedAt).toBeDefined();
  });

  it('getAll 回傳所有訂閱', async () => {
    await store.create({
      name: '訂閱 A',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });
    await store.create({
      name: '訂閱 B',
      eventType: 'state_changed',
      entityFilter: null,
      description: 'test',
      enabled: false,
    });

    expect(store.getAll()).toHaveLength(2);
  });

  it('get 取得單一訂閱', async () => {
    const created = await store.create({
      name: 'test',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });

    const found = store.get(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('test');
  });

  it('get 找不到回傳 undefined', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('findByName 部分比對', async () => {
    await store.create({
      name: '前門開啟通知',
      eventType: 'state_changed',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });

    const found = store.findByName('前門');
    expect(found).toBeDefined();
    expect(found!.name).toBe('前門開啟通知');
  });

  it('update 更新欄位', async () => {
    const created = await store.create({
      name: 'original',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });

    // Wait to ensure updatedAt will differ
    await new Promise(resolve => setTimeout(resolve, 10));

    const updated = await store.update(created.id, { name: 'modified' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('modified');
    expect(updated!.updatedAt).not.toBe(created.updatedAt);
  });

  it('enable / disable 切換狀態', async () => {
    const created = await store.create({
      name: 'test',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: false,
    });

    await store.enable(created.id);
    expect(store.get(created.id)!.enabled).toBe(true);

    await store.disable(created.id);
    expect(store.get(created.id)!.enabled).toBe(false);
  });

  it('delete 移除訂閱', async () => {
    const created = await store.create({
      name: 'to-delete',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });

    const result = await store.delete(created.id);
    expect(result).toBe(true);
    expect(store.getAll()).toHaveLength(0);
  });

  it('delete 不存在的 id 回傳 false', async () => {
    const result = await store.delete('nonexistent');
    expect(result).toBe(false);
  });

  it('資料持久化後可重新載入', async () => {
    await store.create({
      name: 'persisted',
      eventType: 'automation_triggered',
      entityFilter: null,
      description: 'test',
      enabled: true,
    });

    // Create new store instance pointing to same file
    const store2 = new EventSubscriptionStore(join(tmpDir, 'subscriptions.json'));
    await store2.init();

    expect(store2.getAll()).toHaveLength(1);
    expect(store2.getAll()[0].name).toBe('persisted');
  });
});
