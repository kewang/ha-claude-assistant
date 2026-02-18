import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationStore, buildPromptWithHistory } from '../src/core/conversation-store.js';

// Mock env-detect
vi.mock('../src/core/env-detect.js', () => ({
  detectEnvironment: () => ({
    isAddon: false,
    supervisorUrl: '',
    dataPath: '',
    claudePath: 'claude',
    claudeConfigDir: '',
  }),
}));

/**
 * 測試 Slack Bot thread 自動回覆的訊息過濾邏輯。
 *
 * 由於 SlackBot class 與 @slack/bolt 緊密耦合，
 * 這裡提取核心過濾邏輯進行單元測試。
 */

interface MockMessage {
  subtype?: string;
  user?: string;
  text?: string;
  bot_id?: string;
  channel: string;
  channel_type: 'im' | 'channel' | 'group';
  ts: string;
  thread_ts?: string;
}

/**
 * 模擬 app.message() handler 中的過濾邏輯
 * 回傳 'process' 表示應處理，'skip' 表示應忽略
 */
async function shouldProcessMessage(
  message: MockMessage,
  botUserId: string,
  conversationStore: ConversationStore,
): Promise<'process' | 'skip'> {
  // 基本過濾
  if (message.subtype !== undefined) return 'skip';
  if (!message.user) return 'skip';
  if (!message.text) return 'skip';
  if (message.bot_id) return 'skip';

  const threadTs = message.thread_ts || message.ts;
  const isThreadReply = message.thread_ts !== undefined;
  const isDM = message.channel_type === 'im';

  if (!isDM) {
    // Channel: skip @mention messages (handled by app_mention)
    if (botUserId && message.text.includes(`<@${botUserId}>`)) return 'skip';

    // Channel: skip non-thread messages
    if (!isThreadReply) return 'skip';

    // Channel thread: check if bot has participated
    const conversationKey = `slack:${threadTs}`;
    const history = await conversationStore.getHistory(conversationKey);
    if (history.length === 0) return 'skip';
  }

  return 'process';
}

describe('Slack Bot Thread 自動回覆邏輯', () => {
  let conversationStore: ConversationStore;
  const botUserId = 'U_BOT_123';

  beforeEach(async () => {
    conversationStore = new ConversationStore();
    // Mock getHistory to avoid file system dependency
    vi.spyOn(conversationStore, 'getHistory');
  });

  describe('DM 訊息', () => {
    it('一般 DM 訊息應處理', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '客廳溫度多少？',
        channel: 'D123',
        channel_type: 'im',
        ts: '1000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('process');
    });

    it('DM thread 回覆應處理', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '那臥室呢？',
        channel: 'D123',
        channel_type: 'im',
        ts: '1000.002',
        thread_ts: '1000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('process');
    });

    it('bot 自己的訊息應忽略', async () => {
      const msg: MockMessage = {
        user: 'U_BOT_123',
        text: '回覆',
        bot_id: 'B123',
        channel: 'D123',
        channel_type: 'im',
        ts: '1000.003',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });
  });

  describe('Channel 訊息', () => {
    it('含 @mention 的訊息應忽略（交給 app_mention）', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: `<@${botUserId}> 打開客廳燈`,
        channel: 'C123',
        channel_type: 'channel',
        ts: '2000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });

    it('非 thread 的一般 channel 訊息應忽略', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '隨便說說',
        channel: 'C123',
        channel_type: 'channel',
        ts: '2000.002',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });

    it('bot 已參與的 thread 回覆應處理', async () => {
      vi.spyOn(conversationStore, 'getHistory').mockResolvedValue([
        { role: 'user', content: '打開燈', timestamp: '2026-01-01T00:00:00.000Z' },
        { role: 'assistant', content: '已打開', timestamp: '2026-01-01T00:00:01.000Z' },
      ]);

      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '再關掉',
        channel: 'C123',
        channel_type: 'channel',
        ts: '2000.004',
        thread_ts: '2000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('process');
    });

    it('bot 未參與的 thread 回覆應忽略', async () => {
      vi.spyOn(conversationStore, 'getHistory').mockResolvedValue([]);

      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '討論其他事',
        channel: 'C123',
        channel_type: 'channel',
        ts: '2000.005',
        thread_ts: '2000.003',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });

    it('thread 中含 @mention 的訊息應忽略（交給 app_mention）', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: `<@${botUserId}> 幫我查一下`,
        channel: 'C123',
        channel_type: 'channel',
        ts: '2000.006',
        thread_ts: '2000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });
  });

  describe('邊界情況', () => {
    it('message subtype 不為 undefined 時應忽略', async () => {
      const msg: MockMessage = {
        subtype: 'channel_join',
        user: 'U_USER_1',
        text: 'joined',
        channel: 'C123',
        channel_type: 'channel',
        ts: '3000.001',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });

    it('沒有 text 的訊息應忽略', async () => {
      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '',
        channel: 'D123',
        channel_type: 'im',
        ts: '3000.002',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('skip');
    });

    it('private channel (group) thread 回覆也應處理', async () => {
      vi.spyOn(conversationStore, 'getHistory').mockResolvedValue([
        { role: 'user', content: '查狀態', timestamp: '2026-01-01T00:00:00.000Z' },
        { role: 'assistant', content: '回覆', timestamp: '2026-01-01T00:00:01.000Z' },
      ]);

      const msg: MockMessage = {
        user: 'U_USER_1',
        text: '再查一次',
        channel: 'G123',
        channel_type: 'group',
        ts: '3000.004',
        thread_ts: '3000.003',
      };
      expect(await shouldProcessMessage(msg, botUserId, conversationStore)).toBe('process');
    });
  });
});
