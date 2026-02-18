## Context

目前系統透過 REST API 單向與 HA 溝通（查詢/控制），無法即時接收 HA 端的事件。現有 Slack 通知邏輯直接寫在 `scheduler-daemon.ts` 的 `sendToSlack()` 函數中，與排程邏輯耦合。

HA 提供 WebSocket API（`ws://<host>/api/websocket`），支援即時事件訂閱，包含 `automation_triggered`、`state_changed` 等事件類型。

## Goals / Non-Goals

**Goals:**

- 透過 HA WebSocket API 即時監聽事件，不需修改任何 HA automation 設定
- 事件觸發後經 Claude CLI 生成友善通知訊息，發送到 Slack
- 使用者可透過 Claude 自然語言管理事件訂閱（新增/列出/啟用/停用/刪除）
- 建立 NotificationManager + adapter 架構，統一所有通知發送邏輯
- 重構 scheduler-daemon 的 Slack 通知，改用 NotificationManager

**Non-Goals:**

- 不在此次實作 Telegram/Discord/LINE adapter（僅預留介面）
- 不做事件的條件邏輯判斷（如「溫度 > 28 才通知」），這屬於 HA automation 的職責
- 不取代 HA 原生的通知系統，這是補充性質
- 不處理高頻事件的去重或合併（如感測器每秒更新）

## Decisions

### 1. WebSocket 模組獨立於 ha-client

**決定**：建立獨立的 `ha-websocket.ts`，不擴充現有 `ha-client.ts`。

**替代方案**：
- 擴充 ha-client 加入 WebSocket 方法
- 使用 HA REST API 輪詢事件

**理由**：
- REST 和 WebSocket 是根本不同的通訊模式（請求-回應 vs. 持久連線）
- ha-client 已經有清晰的職責（REST API 封裝），不應膨脹
- WebSocket 需要連線管理、心跳、重連等獨立邏輯
- 兩者共用 URL/token 設定（透過 env-detect），但實作完全獨立

### 2. 使用 Node.js 內建 WebSocket（不引入 ws 套件）

**決定**：優先使用 Node.js 22+ 內建的 `WebSocket` API。若目標環境為 Node.js 20，則引入 `ws` 套件。

**替代方案**：
- 直接使用 `ws` 套件
- 使用 `home-assistant-js-websocket` 官方套件

**理由**：
- 減少外部依賴
- Node.js 22 起 WebSocket 已穩定，但需確認 Add-on 環境的 Node 版本
- HA WebSocket 協議相對簡單（JSON 訊息），不需要完整的 HA 官方 SDK
- 若需要 `ws`，它是成熟且輕量的選擇

### 3. 事件訂閱設定使用獨立 JSON 儲存

**決定**：建立 `EventSubscriptionStore`，沿用 `ScheduleStore` 的 JSON 檔案 + file watching 模式。

**替代方案**：
- 整合到現有 schedule-store
- 使用 SQLite 或其他資料庫

**理由**：
- 與 ScheduleStore 的使用模式幾乎相同（CRUD + 檔案監控 + debounce）
- JSON 檔案簡單易維護，符合現有專案慣例
- 事件訂閱和排程是不同概念，不應混在一起
- 未來可以抽取共用的 JsonFileStore 基底類別（但此次不做）

### 4. 通知一律經過 Claude CLI 生成

**決定**：每次事件觸發都呼叫 `claude --print` 生成友善訊息後再發送。

**替代方案**：
- 使用固定模板直接通知
- 混合模式（簡單事件用模板，複雜的用 Claude）

**理由**：
- 使用者明確要求自然語言通知
- 訊息品質一致，Claude 可以根據事件上下文（觸發時間、實體名稱等）生成有意義的訊息
- 通知不需要毫秒級即時性，5-15 秒的延遲是可接受的
- 與 scheduler-daemon 的處理模式一致，複用相同的 Claude CLI 執行邏輯

### 5. Event Listener 作為獨立背景服務

**決定**：建立 `event-listener-daemon.ts`，獨立於 scheduler-daemon 運行。

**替代方案**：
- 整合到 scheduler-daemon
- 整合到 slack-bot

**理由**：
- 職責單一：WebSocket 事件監聯 vs. cron 排程 vs. Slack 互動
- 可以獨立啟停，不影響其他服務
- 與 scheduler-daemon 共用的部分（Claude CLI 執行、通知發送）透過 NotificationManager 和共用函數解決
- Add-on 中作為獨立程序在 `run.sh` 啟動

### 6. HA WebSocket 認證與事件訂閱協議

**決定**：實作 HA WebSocket API 標準認證流程。

**流程**：
1. 連線到 `ws://<ha-url>/api/websocket`
2. 收到 `auth_required` 訊息
3. 發送 `{ type: "auth", access_token: "<token>" }`
4. 收到 `auth_ok` 確認
5. 發送 `{ type: "subscribe_events", event_type: "automation_triggered" }` 訂閱事件
6. 持續接收事件訊息

**重連機制**：沿用 slack-bot 的指數退避模式（1s base, 2x multiplier, max 60s, 10 attempts）。

### 7. Claude CLI 執行邏輯共用

**決定**：將 `executeClaudePrompt()` 和 `isTokenExpiredError()` 從 scheduler-daemon 抽取到共用模組 `src/core/claude-agent.ts`（已存在此檔案，待確認內容後決定是否擴充或使用）。

**理由**：
- scheduler-daemon 和 event-listener-daemon 都需要執行 Claude CLI
- 避免重複程式碼
- Token 重試邏輯也相同

## Risks / Trade-offs

**[Claude CLI 執行延遲]** → 每次事件通知都呼叫 Claude CLI，會有 5-15 秒延遲。若短時間內大量事件觸發（如多個 automation 同時執行），通知會排隊處理。**緩解**：使用佇列機制，避免同時 spawn 過多 Claude 程序，設定合理的並發上限（如同時最多 3 個）。

**[WebSocket 連線穩定性]** → 長期運行的 WebSocket 連線可能因網路問題、HA 重啟等原因斷開。**緩解**：實作指數退避自動重連，重連後重新訂閱所有事件。

**[Claude API 額度消耗]** → 每個事件都消耗 Claude 額度。若訂閱的事件頻率高，可能快速消耗配額。**緩解**：由使用者自行控制訂閱哪些事件，在 MCP tool 描述中提醒頻率影響。

**[Add-on 環境 WebSocket URL]** → Add-on 環境中 HA URL 是 `http://supervisor/core`，需確認 WebSocket 路徑為 `ws://supervisor/core/api/websocket`。**緩解**：啟動時進行連線測試，記錄連線狀態。

## Open Questions

- `src/core/claude-agent.ts` 目前的內容是什麼？能否直接擴充作為 Claude CLI 執行的共用模組？
- Add-on Docker 環境中 Node.js 版本是否 >= 22（影響是否需要 `ws` 套件）？
- HA WebSocket API 在 Add-on 環境中的 URL 路徑格式需要實測確認。
