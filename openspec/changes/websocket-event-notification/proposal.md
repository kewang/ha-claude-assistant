## Why

目前系統只能「主動去問 HA」（REST API），無法在 HA 發生事件時即時收到通知。使用者如果想知道「前門被打開了」或「某個 automation 執行了」，只能靠排程定期查詢或手動詢問。透過 HA WebSocket API 訂閱事件，可以讓系統即時反應 HA 的狀態變化，實現真正的雙向整合。

同時，目前 Slack 發訊息的邏輯散在 `scheduler-daemon.ts` 裡，沒有統一的通知抽象層。引入 NotificationManager + adapter 架構，可以讓排程通知、事件通知共用同一套發送機制，未來擴展 Telegram/Discord/LINE 也只需加 adapter。

## What Changes

- **新增 HA WebSocket 連線模組**：獨立於 `ha-client`（REST），建立持久 WebSocket 連線，支援訂閱 HA 事件（`automation_triggered`、`state_changed` 等），具備自動重連機制
- **新增事件訂閱設定儲存**：類似 `schedule-store` 的 JSON 持久化儲存，管理「哪些事件要通知、通知到哪裡」的設定
- **新增 NotificationManager + adapter 架構**：統一的通知發送介面，首先實作 Slack adapter，抽出 `scheduler-daemon` 中的 Slack 發送邏輯
- **新增 Event Listener 背景服務**：類似 `scheduler-daemon` 的獨立程序，監聽 WebSocket 事件，透過 Claude CLI 生成友善通知訊息，再經 NotificationManager 發送
- **新增 MCP tool**：`manage_event_subscription` — 讓使用者透過 Claude 管理事件訂閱（新增/列出/啟用/停用/刪除）
- **修改 scheduler-daemon**：重構 Slack 發送邏輯，改用 NotificationManager

## Capabilities

### New Capabilities

- `ha-websocket`: HA WebSocket API 連線管理，包含認證、事件訂閱、自動重連、心跳維持
- `event-subscription-store`: 事件訂閱設定的 CRUD 持久化儲存（JSON 檔案），管理訂閱規則（事件類型、過濾條件、通知頻道）
- `notification-manager`: 統一通知發送介面，adapter 模式支援多渠道，首先實作 Slack adapter
- `event-listener-daemon`: 背景服務，連接 WebSocket、比對訂閱規則、呼叫 Claude CLI 生成友善訊息、透過 NotificationManager 發送通知
- `manage-event-subscription-tool`: MCP tool，讓 Claude 管理事件訂閱的 CRUD 操作

### Modified Capabilities

- `scheduler-daemon`: Slack 通知改為透過 NotificationManager 發送，不再直接呼叫 Slack API

## Impact

- **新增檔案**：
  - `src/core/ha-websocket.ts` — WebSocket 連線管理
  - `src/core/event-subscription-store.ts` — 事件訂閱儲存
  - `src/core/notification/manager.ts` — NotificationManager
  - `src/core/notification/types.ts` — 通知介面定義
  - `src/core/notification/adapters/slack.ts` — Slack adapter
  - `src/interfaces/event-listener-daemon.ts` — 事件監聽背景服務
  - `src/tools/manage-event-subscription.ts` — MCP tool
- **修改檔案**：
  - `src/interfaces/scheduler-daemon.ts` — 重構 Slack 發送邏輯
  - `src/tools/index.ts` — 註冊新 tool
  - `src/interfaces/mcp-server.ts` — 註冊新 tool
- **新增依賴**：`ws`（WebSocket client library）
- **新增環境變數**：無（複用現有 HA_URL/HA_TOKEN 和 SLACK_BOT_TOKEN）
- **資料檔案**：`data/event-subscriptions.json`（Add-on: `/data/event-subscriptions/event-subscriptions.json`）
- **Add-on 整合**：`run.sh` 需新增啟動 event-listener-daemon
