## ADDED Requirements

### Requirement: MCP Tool 定義
The system SHALL provide a `manage_event_subscription` MCP tool for managing event subscriptions via Claude.

#### Scenario: Tool 定義
- **WHEN** the MCP server registers tools
- **THEN** it SHALL include `manage_event_subscription` with the following input schema:
  - `action`: required — `"create"` | `"list"` | `"enable"` | `"disable"` | `"delete"`
  - `name`: optional — 訂閱名稱（create 時必填）
  - `event_type`: optional — HA 事件類型（create 時必填，如 `"automation_triggered"`、`"state_changed"`）
  - `entity_filter`: optional — entity_id 過濾條件（支援 `*` 萬用字元）
  - `description`: optional — 給 Claude 的通知生成提示
  - `id`: optional — 訂閱 ID（enable/disable/delete 時使用）

### Requirement: 建立訂閱
The system SHALL support creating event subscriptions.

#### Scenario: 建立新訂閱
- **WHEN** action is `"create"` with `name`, `event_type`
- **THEN** the system creates a new subscription with `enabled: true` and returns the created subscription

#### Scenario: 建立訂閱缺少必填欄位
- **WHEN** action is `"create"` without `name` or `event_type`
- **THEN** the system returns an error message indicating the missing field

### Requirement: 列出訂閱
The system SHALL support listing all event subscriptions.

#### Scenario: 列出所有訂閱
- **WHEN** action is `"list"`
- **THEN** the system returns all subscriptions with their ID, name, event type, entity filter, enabled status, and description

#### Scenario: 無訂閱時列出
- **WHEN** action is `"list"` and no subscriptions exist
- **THEN** the system returns a message indicating no subscriptions are configured

### Requirement: 啟用/停用訂閱
The system SHALL support enabling and disabling subscriptions.

#### Scenario: 啟用訂閱（by ID）
- **WHEN** action is `"enable"` with `id`
- **THEN** the system enables the subscription and returns confirmation

#### Scenario: 啟用訂閱（by name）
- **WHEN** action is `"enable"` with `name` but no `id`
- **THEN** the system searches by name, enables the first match, and returns confirmation

#### Scenario: 停用訂閱
- **WHEN** action is `"disable"` with `id` or `name`
- **THEN** the system disables the matching subscription

#### Scenario: 找不到訂閱
- **WHEN** action is `"enable"` or `"disable"` with non-matching ID/name
- **THEN** the system returns an error message

### Requirement: 刪除訂閱
The system SHALL support deleting event subscriptions.

#### Scenario: 刪除訂閱（by ID）
- **WHEN** action is `"delete"` with `id`
- **THEN** the system deletes the subscription and returns confirmation

#### Scenario: 刪除訂閱（by name）
- **WHEN** action is `"delete"` with `name` but no `id`
- **THEN** the system searches by name, deletes the first match, and returns confirmation

### Requirement: 常見事件類型提示
The system SHALL include helpful descriptions of common HA event types in the tool description.

#### Scenario: Tool description 內容
- **WHEN** the tool is registered
- **THEN** the description SHALL mention common event types:
  - `automation_triggered` — 自動化觸發
  - `state_changed` — 實體狀態變更
  - `call_service` — 服務呼叫
  - `script_started` — 腳本執行
