## Why

目前 Slack Bot 在 channel 和 DM 中的 thread 對話串，使用者每次回覆都必須 @mention bot 才會觸發回應。這對持續對話來說非常不方便，尤其是已經在同一個 thread 中來回對話的場景。Bot 應該在已參與的 thread 中自動回覆，不需要重複 @mention。

## What Changes

- 修改 `app.message()` handler，讓 bot 在已參與的 thread 中自動回覆（不需 @mention）
- 利用 ConversationStore 已有的 `slack:${threadTs}` key 判斷 bot 是否參與過該 thread
- 在啟動時取得 bot 自身的 user ID，用於判斷是否為 @mention 訊息（避免與 `app_mention` 重複處理）
- DM 訊息無論是否在 thread 中都自動回覆
- Channel 訊息：thread 回覆若 bot 已參與過則自動回覆，非 thread 的一般訊息仍需 @mention

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `slack-bot`: 新增 thread 自動回覆行為 — bot 已參與的 thread 中不需 @mention 即可觸發回應

## Impact

- `src/interfaces/slack-bot.ts` — 主要修改檔案，調整 `app.message()` handler 邏輯
- 無新增依賴，無 API 變更
- 需要 Slack App 訂閱 `message.channels` 和 `message.groups` 事件（若尚未訂閱）
