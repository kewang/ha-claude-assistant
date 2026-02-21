# Changelog

## [1.9.0] - 2026-02-21

### Added
- **動態記憶功能**：新增 `manage_memory` MCP tool，可透過自然語言新增、列出、刪除長期記憶
  - Slack Bot 和 Scheduler 執行 Claude CLI 前會自動注入記憶內容
  - 記憶持久化儲存於 `data/memories.json`（Add-on: `/data/memories/memories.json`）

### Fixed
- 修正 Token 刷新誤報：僅在 OAuth API 回傳 HTTP 400 + `invalid_grant` 時才判定 refresh token 失效，避免暫時性錯誤觸發「需要重新登入」通知
- 修正事件訂閱 `entityFilter` 無法正確過濾多個實體：將格式從字串改為陣列，支援多個 pattern 各自獨立比對

## [1.8.0] - 2026-02-18

### Added
- Slack thread 自動回覆：在 bot 已參與的 thread 中，使用者不需 @mention 即可繼續對話
- DM 訊息支援 thread 回覆，不再需要每次 @mention
- 啟動時自動取得 bot user ID，避免 @mention 訊息重複處理

## [1.7.7] - 2026-02-18

### Fixed
- 改善 automation_triggered 事件通知品質：透過 HA Config API 取得自動化的完整設定（actions、description），讓 Claude 能描述自動化實際執行了什麼動作
- 移除 debug logging

## [1.7.4] - 2026-02-18

### Fixed
- 改善 automation_triggered 事件通知內容：透過 HA Config API 取得自動化的完整設定，在 prompt 中包含實際動作（action）和描述（description），讓 Claude 生成更具體的通知（例如「已自動開啟客廳燈」而非「自動化已觸發」）

## [1.7.3] - 2026-02-18

### Fixed
- 修正 automation_triggered 事件通知過於空泛：現在會包含觸發來源（source）和觸發詳情（variables），讓 Claude 生成更有意義的通知訊息

## [1.7.2] - 2026-02-18

### Fixed
- 修正 Add-on `/data` 目錄權限不一致：`conversations/` 和 `event-subscriptions/` 現在與其他目錄一樣統一為 `claude:claude` 擁有者

## [1.7.1] - 2026-02-18

### Fixed
- Event listener daemon 啟動時若無訂閱，自動建立預設的 `automation_triggered` 訂閱，實現開箱即用

## [1.7.0] - 2026-02-18

### Added
- **WebSocket 即時事件監聯**：透過 HA WebSocket API 即時接收事件，不需修改任何 HA automation
  - 新增 `HAWebSocket` 模組，支援自動重連（指數退避）和心跳維持
  - 新增 `EventSubscriptionStore` 事件訂閱持久化儲存
  - 新增 `event-listener-daemon` 背景服務，監聽事件並透過 Claude CLI 生成友善通知
  - 並發控制：最多 3 個 Claude CLI 同時執行，佇列上限 20
- **NotificationManager 通知管理架構**：統一所有通知發送邏輯
  - Adapter 模式支援多渠道（目前 Slack，未來可擴展 Telegram/Discord/LINE）
  - Scheduler daemon 重構為使用 NotificationManager
- **manage_event_subscription MCP tool**：透過 Claude 自然語言管理事件訂閱（新增/列出/啟用/停用/刪除）
- MCP Server 新增 `get_history` 和 `manage_event_subscription` tool handler
- Add-on `run.sh` 新增啟動 event-listener-daemon

### Changed
- `scheduler-daemon` 從直接呼叫 Slack API 改為透過 NotificationManager 發送通知
- 新增 `ws` 依賴（WebSocket client for Node.js 20）

## [1.6.0] - 2026-02-17

### Added
- **get_history MCP tool**：查詢 HA 實體歷史紀錄，支援多實體和時間範圍
- 新增 OpenSpec 工作流程規範
- 新增專案 roadmap 文件
- 新增所有既有模組的 OpenSpec specs

## [1.5.0] - 2026-02-07

### Added
- **對話記憶持久化**：所有介面（Slack Bot、CLI、Scheduler）支援多輪對話上下文
  - Slack Bot：同一 thread 內的訊息共用對話記憶
  - CLI：互動模式下整個 session 保持對話上下文，`/clear` 可清除
  - Scheduler：每個排程任務保留前次執行結果，可做趨勢比較
- 新增 `ConversationStore` 核心模組，JSON 檔案持久化儲存
- 支援環境變數自訂對話參數：`CONVERSATION_MAX_TURNS`、`CONVERSATION_MAX_CHARS`、`CONVERSATION_MAX_AGE_DAYS`
- 自動清除過期對話（預設 7 天）

### Fixed
- 修正 Slack Bot thread reply 時 `thread_ts` 錯誤，導致回覆建立新 thread 而非回到原 thread

## [1.4.14] - 2026-02-07

### Changed
- Claude CLI timeout 從 1 分鐘增加到 3 分鐘（Slack Bot 和 Scheduler）
- 支援 `CLAUDE_TIMEOUT_MS` 環境變數自訂 timeout
- Slack Bot 收到訊息後先回覆「處理中」提示，完成後更新為正式回覆

### Fixed
- 修正文件中 ingress port 寫死 8099 的問題（實際由 Supervisor 動態指派）

## [1.4.13] - 2026-02-07

### Added
- **Web UI 登入介面**：透過 HA 側邊欄即可完成 Claude 登入，不再需要手動進容器操作
  - OAuth PKCE flow 實作，安全地完成授權流程
  - 即時顯示登入狀態與 Token 到期時間
  - 支援手動刷新 Token
  - 支援深色/淺色主題
- HA Ingress 整合，Add-on 安裝後自動出現在側邊欄
- 使用 Supervisor API 動態取得 ingress port

### Fixed
- 修正 credentials 格式與 CLI 一致（`expiresAt` 為 Unix ms 數字、`scopes` 為字串陣列、不存入巢狀物件）
- 修正 OAuth token exchange/refresh 使用 `application/json` 格式
- 修正 authorization code 需移除 `#state` fragment（callback page 回傳 `code#state` 格式）
- 修正 Add-on 中 credentials 檔案權限（`chown claude:claude`）
- 修正 OAuth authorize endpoint、scope、state 參數等多項相容性問題
- Web UI `parseBody()` 同時支援 JSON 和 form-urlencoded 格式

## [1.3.1] - 2026-02-04

### Fixed
- 修正 Docker build cache 導致 Add-on 使用舊版程式碼

## [1.3.0] - 2026-02-04

### Added
- 新增 release skill 自動化版本發佈流程

## [1.2.0] - 2026-02-03

### Added
- 統一版號管理，`npm version` 自動同步 `config.yaml`
- 從 Claude CLI binary 動態提取 OAuth 設定
- 統一 Logger，所有輸出加入時間戳記
- OAuth token 自動刷新機制（每 5 分鐘檢查，過期前 30 分鐘刷新）
- 排程服務 token 過期重試機制
- Slack Bot 自動重連機制（指數退避策略）

### Fixed
- 修正 token refresh 遺失必要欄位
- 降低 token refresh 日誌雜訊
- 修正 vitest 測試完成後無法正常退出
