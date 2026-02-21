## 1. 修改資料模型

- [x] 1.1 修改 `src/core/event-subscription-store.ts` — `StoredEventSubscription.entityFilter` 型別從 `string | null` 改為 `string[] | null`

## 2. 修改 MCP Tool

- [x] 2.1 修改 `src/tools/manage-event-subscription.ts` — `entity_filter` 參數 schema 改為 `{ type: 'array', items: { type: 'string' } }`，description 更新，`executeManageEventSubscription` 中傳入 store 的值改為 array
- [x] 2.2 修改 `src/tools/manage-event-subscription.ts` — `ManageEventSubscriptionInput.entity_filter` 型別從 `string?` 改為 `string[]?`

## 3. 修改 Event Listener

- [x] 3.1 修改 `src/interfaces/event-listener-daemon.ts` 的 `handleEvent()` — entity filter 比對改為 iterate `entityFilter` array，任一 pattern 匹配即通過；`null` 和空陣列都視為不過濾
- [x] 3.2 修改 `handleEvent()` 支援 `!` 前綴排除 pattern — 排除優先，再檢查包含

## 4. 修改 MCP Tool Description

- [x] 4.1 修改 `src/tools/manage-event-subscription.ts` — description 說明 `!` 前綴排除語法和 automation_triggered 事件的 entity_id 格式

## 5. 驗證

- [x] 5.1 執行 `npm test` 確認所有測試通過
- [x] 5.2 執行 `npm run build` 確認編譯成功
