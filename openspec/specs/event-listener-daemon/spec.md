## ADDED Requirements

### Requirement: 事件監聽背景服務
The system SHALL provide an event listener daemon that monitors HA events via WebSocket and sends Claude-generated notifications.

#### Scenario: 啟動服務
- **WHEN** the event listener daemon starts
- **THEN** the system:
  1. Loads all event subscriptions from `EventSubscriptionStore`
  2. Initializes `HAWebSocket` and connects to HA
  3. Subscribes to all unique event types from enabled subscriptions
  4. Starts the token refresh service
  5. Begins watching the subscription file for changes

#### Scenario: 優雅關閉
- **WHEN** SIGINT or SIGTERM is received
- **THEN** the system disconnects WebSocket, stops token refresh, stops file watching, and exits

### Requirement: 事件處理流程
The system SHALL process incoming HA events through Claude CLI and send notifications.

#### Scenario: 收到匹配事件
- **WHEN** an HA event is received that matches an enabled subscription (event type + entity filter)
- **THEN** the system:
  1. Calls `ensureValidToken()` to check token status
  2. Builds a prompt including the event data and the subscription's description
  3. Spawns `claude --print --permission-mode bypassPermissions` with the prompt
  4. Sends the Claude-generated message via `NotificationManager`

#### Scenario: Entity 過濾
- **WHEN** a subscription has `entityFilter` set (e.g., `"binary_sensor.front_*"`)
- **THEN** the system only processes events whose `entity_id` matches the filter pattern (supports `*` wildcard)

#### Scenario: 無 entity 過濾
- **WHEN** a subscription has `entityFilter` set to `null`
- **THEN** the system processes all events of the subscribed event type

#### Scenario: Token 過期需重新登入
- **WHEN** `ensureValidToken()` returns `needsRelogin: true`
- **THEN** the system sends a failure notification via NotificationManager and skips Claude CLI execution

### Requirement: Token 過期重試機制
The system SHALL retry Claude CLI execution once on token-related failures (same as scheduler-daemon).

#### Scenario: Token 錯誤重試
- **WHEN** Claude CLI execution fails with token-related error (401, authentication_error, token expired)
- **THEN** the system calls `refreshToken()`, retries once, and sends the result (success or failure) via NotificationManager

### Requirement: 通知訊息格式
The system SHALL build prompts that provide Claude with event context for generating friendly messages.

#### Scenario: 建立 Claude prompt
- **WHEN** an event is processed
- **THEN** the prompt SHALL include:
  - 事件類型（如 `automation_triggered`）
  - 觸發時間（格式化為 Asia/Taipei 時區）
  - 相關實體 ID 和 friendly name（如有）
  - 狀態變化（如有，from → to）
  - 訂閱的 description（使用者自訂的提示）
  - 指示 Claude 生成簡潔友善的繁體中文通知訊息

#### Scenario: 通知發送
- **WHEN** Claude generates a notification message
- **THEN** the system sends via NotificationManager with `source: "event"`

### Requirement: 並發控制
The system SHALL limit concurrent Claude CLI executions to prevent resource exhaustion.

#### Scenario: 並發上限
- **WHEN** multiple events trigger simultaneously
- **THEN** the system queues Claude CLI executions with a maximum of 3 concurrent processes

#### Scenario: 佇列溢出
- **WHEN** the queue exceeds 20 pending events
- **THEN** the system drops the oldest pending events and logs a warning

### Requirement: 訂閱變更即時重載
The system SHALL reload subscriptions when the JSON file changes.

#### Scenario: 訂閱檔案變更
- **WHEN** `event-subscriptions.json` is modified (with 500ms debounce)
- **THEN** the system:
  1. Reloads subscriptions from file
  2. Compares new vs. old subscriptions
  3. Unsubscribes removed event types from WebSocket
  4. Subscribes newly added event types to WebSocket

### Requirement: WebSocket 重連後恢復
The system SHALL restore event subscriptions after WebSocket reconnection.

#### Scenario: 重連後重新訂閱
- **WHEN** HAWebSocket emits a `reconnected` event
- **THEN** the system re-subscribes all active event types based on current enabled subscriptions
