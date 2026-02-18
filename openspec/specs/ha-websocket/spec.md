## ADDED Requirements

### Requirement: HA WebSocket 連線管理
The system SHALL provide an `HAWebSocket` class that manages a persistent WebSocket connection to the Home Assistant WebSocket API.

#### Scenario: 建立連線
- **WHEN** `connect()` is called
- **THEN** the system opens a WebSocket connection to `ws://<ha-url>/api/websocket` (or `wss://` for HTTPS URLs)

#### Scenario: Add-on 環境連線
- **WHEN** running in Add-on environment (SUPERVISOR_TOKEN present)
- **THEN** the system connects to `ws://supervisor/core/api/websocket` using SUPERVISOR_TOKEN for authentication

#### Scenario: 一般環境連線
- **WHEN** running in standalone environment
- **THEN** the system connects using HA_URL and HA_TOKEN from environment variables

### Requirement: HA WebSocket 認證
The system SHALL authenticate with the HA WebSocket API using the standard authentication flow.

#### Scenario: 認證成功
- **WHEN** the WebSocket connection is established and `auth_required` message is received
- **THEN** the system sends `{ type: "auth", access_token: "<token>" }` and waits for `auth_ok` response

#### Scenario: 認證失敗
- **WHEN** the server responds with `auth_invalid`
- **THEN** the system logs the error, closes the connection, and emits an `auth_failed` event

### Requirement: 事件訂閱
The system SHALL support subscribing to HA event types via the WebSocket API.

#### Scenario: 訂閱事件類型
- **WHEN** `subscribeEvents(eventType)` is called (e.g., `"automation_triggered"`, `"state_changed"`)
- **THEN** the system sends `{ type: "subscribe_events", event_type: eventType, id: <msgId> }` and tracks the subscription

#### Scenario: 接收事件
- **WHEN** an event matching a subscription is received
- **THEN** the system emits an `event` callback with the event data including `event_type`, `data`, and `time_fired`

#### Scenario: 取消訂閱
- **WHEN** `unsubscribeEvents(subscriptionId)` is called
- **THEN** the system sends `{ type: "unsubscribe_events", subscription: subscriptionId }` and removes the subscription tracking

### Requirement: 自動重連機制
The system SHALL automatically reconnect on disconnection with exponential backoff.

#### Scenario: 偵測到斷線
- **WHEN** the WebSocket connection closes unexpectedly
- **THEN** the system triggers the reconnection process

#### Scenario: 指數退避重連
- **WHEN** reconnection is triggered
- **THEN** the system waits with exponential backoff:
  - Initial delay: 1 second
  - Subsequent: delay * 2 (capped at 60 seconds)
  - Maximum attempts: 10

#### Scenario: 重連成功
- **WHEN** reconnection succeeds
- **THEN** the system re-authenticates, re-subscribes all previously subscribed event types, resets the reconnect counter, and emits a `reconnected` event

#### Scenario: 超過重連上限
- **WHEN** reconnection fails 10 consecutive times
- **THEN** the system emits a `connection_failed` event and stops retrying

### Requirement: 心跳維持
The system SHALL send periodic ping messages to keep the connection alive.

#### Scenario: 定期 ping
- **WHEN** the connection is established and authenticated
- **THEN** the system sends `{ type: "ping", id: <msgId> }` every 30 seconds

#### Scenario: pong 逾時
- **WHEN** a pong response is not received within 10 seconds after ping
- **THEN** the system considers the connection dead and triggers reconnection

### Requirement: 優雅關閉
The system SHALL support graceful shutdown.

#### Scenario: 關閉連線
- **WHEN** `disconnect()` is called
- **THEN** the system cancels all subscriptions, stops the ping interval, closes the WebSocket connection, and stops the reconnection process
