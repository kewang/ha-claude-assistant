## Context

目前 Slack Bot 有兩個事件處理入口：
1. `app.message()` — 處理所有收到的 message 事件（目前主要處理 DM）
2. `app.event('app_mention')` — 處理 @mention 事件

當使用者在 channel @mention bot 後，bot 會在 thread 中回覆。但使用者後續在同一 thread 回覆時，若不再次 @mention，bot 不會回應。DM 中的 thread 也有類似問題。

ConversationStore 已使用 `slack:${threadTs}` 作為對話 key，所以判斷 bot 是否參與過 thread 只需檢查是否有該 key 的歷史記錄。

## Goals / Non-Goals

**Goals:**
- Bot 已參與的 thread 中，使用者不需 @mention 即可觸發回應
- DM 中所有訊息（包含 thread 回覆）都自動回應
- 避免 @mention 訊息被 `app.message()` 和 `app_mention` 重複處理

**Non-Goals:**
- 不處理 bot 未參與過的 channel thread（避免打擾無關對話）
- 不改動 ConversationStore 的行為或格式
- 不改動 `/ha` slash command 行為

## Decisions

### 1. 使用 ConversationStore 判斷 bot 是否參與過 thread

**選擇**: 檢查 `conversationStore.getHistory(slack:${threadTs})` 是否有記錄

**替代方案**: 呼叫 Slack API `conversations.replies` 查 thread 中是否有 bot 的回覆

**理由**: ConversationStore 已有資料，無需額外 API 呼叫，效能更好且邏輯簡單。唯一風險是對話記錄被清理（7 天過期），但 7 天前的 thread 通常也不會再繼續對話。

### 2. 透過 bot user ID 判斷 @mention 訊息以避免重複處理

**選擇**: 啟動時透過 `auth.test` API 取得 bot user ID，在 `app.message()` 中檢查訊息文字是否包含 `<@BOT_USER_ID>`，若包含則跳過（交給 `app_mention` 處理）

**替代方案**: 移除 `app_mention` handler，統一在 `app.message()` 處理

**理由**: 保留 `app_mention` handler 可確保 channel 中首次對話仍需明確 @mention 觸發，也與 Slack 事件模型一致。只需在 `app.message()` 中過濾掉含 @mention 的 channel 訊息即可。

### 3. 利用 `message.channel_type` 區分 DM 和 channel

**選擇**: 使用 Slack 訊息中的 `channel_type` 欄位判斷訊息來源

**理由**: 這是 Slack 原生提供的欄位，可靠且無需額外 API 呼叫。`im` 表示 DM，`channel`/`group` 表示 channel。

## Risks / Trade-offs

- **[ConversationStore 清理]** 7 天過期的對話記錄會導致 bot 「忘記」參與過的舊 thread → 可接受，超過 7 天的 thread 重新 @mention 是合理的
- **[Slack 事件訂閱]** 需要 Slack App 訂閱 `message.channels` 和 `message.groups` 事件才能收到 channel 訊息 → 需在 Slack App 設定中確認
- **[訊息量增加]** Bot 會收到所有 channel 訊息（不只 @mention），增加事件量 → 影響極小，因為非 thread 和非參與 thread 的訊息會被快速過濾掉
