## 1. NotificationManager + Slack Adapter

- [x] 1.1 建立 `src/core/notification/types.ts` — 定義 NotificationAdapter、NotificationMessage、NotificationResult 等介面
- [x] 1.2 建立 `src/core/notification/adapters/slack.ts` — 實作 Slack adapter，從 scheduler-daemon 抽取 sendToSlack 邏輯
- [x] 1.3 建立 `src/core/notification/manager.ts` — 實作 NotificationManager（registerAdapter、send、getNotificationManager singleton）
- [x] 1.4 建立 `src/core/notification/index.ts` — 匯出 notification 模組
- [x] 1.5 撰寫 NotificationManager 和 Slack adapter 的單元測試

## 2. 重構 scheduler-daemon 使用 NotificationManager

- [x] 2.1 修改 `src/interfaces/scheduler-daemon.ts` — 移除直接的 Slack WebClient 呼叫，改用 NotificationManager
- [x] 2.2 修改 token refresh notification callback，改用 NotificationManager
- [x] 2.3 驗證 scheduler-daemon 既有功能不受影響（手動測試或跑既有測試）

## 3. HA WebSocket 連線模組

- [x] 3.1 確認 Node.js 版本決定使用內建 WebSocket 或 `ws` 套件（若需要則 `npm install ws`）
- [x] 3.2 建立 `src/core/ha-websocket.ts` — 實作 HAWebSocket class（connect、auth、subscribeEvents、unsubscribeEvents、disconnect）
- [x] 3.3 實作自動重連機制（指數退避：1s base, 2x, max 60s, 10 attempts）
- [x] 3.4 實作心跳維持（ping every 30s, pong timeout 10s）
- [x] 3.5 實作重連後自動重新訂閱
- [x] 3.6 撰寫 HAWebSocket 的單元測試

## 4. EventSubscriptionStore

- [x] 4.1 建立 `src/core/event-subscription-store.ts` — 實作 CRUD 操作、JSON 持久化、file watching（沿用 ScheduleStore 模式）
- [x] 4.2 撰寫 EventSubscriptionStore 的單元測試

## 5. manage_event_subscription MCP Tool

- [x] 5.1 建立 `src/tools/manage-event-subscription.ts` — 實作 create/list/enable/disable/delete 操作
- [x] 5.2 在 `src/tools/index.ts` 註冊新 tool 到 haTools 和 executeTool
- [x] 5.3 在 `src/interfaces/mcp-server.ts` 確認新 tool 可被呼叫
- [x] 5.4 撰寫 manage-event-subscription tool 的單元測試

## 6. Event Listener Daemon

- [x] 6.1 建立 `src/interfaces/event-listener-daemon.ts` — 主程式框架（啟動、關閉、signal handling）
- [x] 6.2 實作事件處理流程（收到事件 → 比對訂閱 → 呼叫 Claude CLI → 送通知）
- [x] 6.3 實作 entity filter 萬用字元比對邏輯
- [x] 6.4 實作並發控制（最多 3 個 Claude CLI 同時執行，佇列上限 20）
- [x] 6.5 實作訂閱檔案變更重載（新增/移除事件類型訂閱）
- [x] 6.6 實作 WebSocket 重連後重新訂閱
- [x] 6.7 在 `package.json` 新增 `event-listener` script

## 7. 整合與文件

- [x] 7.1 更新 `claude-ha-assistant/run.sh` 新增啟動 event-listener-daemon
- [x] 7.2 更新 `CLAUDE.md` 新增 event-listener 相關說明
- [ ] 7.3 端到端手動測試：建立訂閱 → HA 觸發 automation → 收到 Slack 通知（需要 HA 環境）
