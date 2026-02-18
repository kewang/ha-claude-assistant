## 1. Bot User ID 初始化

- [x] 1.1 在 `SlackBot` class 新增 `botUserId` 屬性
- [x] 1.2 在 `start()` 方法中呼叫 `auth.test` API 取得 bot user ID 並儲存

## 2. 修改 app.message() handler

- [x] 2.1 判斷訊息來源類型（DM vs channel），使用 `channel_type` 欄位區分
- [x] 2.2 DM 訊息：移除原有的 thread 過濾邏輯，確保所有 DM 訊息（含 thread 回覆）都處理
- [x] 2.3 Channel 訊息：若含 @mention bot 則跳過（交給 `app_mention` handler）
- [x] 2.4 Channel 訊息：若為 thread 回覆且 ConversationStore 有 `slack:${threadTs}` 記錄，則自動處理
- [x] 2.5 Channel 訊息：若非 thread 或 bot 未參與過的 thread，則忽略

## 3. 測試

- [x] 3.1 新增 slack-bot thread 自動回覆的單元測試
