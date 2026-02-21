## MODIFIED Requirements

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
- **WHEN** a subscription has `entityFilter` set to a non-empty array (e.g., `["binary_sensor.front_*", "automation.morning_*"]`)
- **THEN** the system only processes events whose `entity_id` matches ANY of the filter patterns (each supports `*` wildcard)

#### Scenario: 無 entity 過濾
- **WHEN** a subscription has `entityFilter` set to `null` or empty array `[]`
- **THEN** the system processes all events of the subscribed event type

#### Scenario: Token 過期需重新登入
- **WHEN** `ensureValidToken()` returns `needsRelogin: true`
- **THEN** the system sends a failure notification via NotificationManager and skips Claude CLI execution
