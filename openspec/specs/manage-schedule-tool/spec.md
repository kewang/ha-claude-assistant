### Requirement: 管理排程 MCP Tool
The system SHALL provide a `manage_schedule` MCP Tool for CRUD operations on scheduled tasks.

### Requirement: 建立排程
The system SHALL support creating new scheduled tasks.

#### Scenario: 建立排程成功
- **WHEN** `manage_schedule` is called with `action: "create"`, `name`, `cron`, and `prompt`
- **THEN** the system validates the cron expression, creates the schedule via `ScheduleStore`, and returns the formatted schedule

#### Scenario: 缺少必要參數
- **WHEN** `create` action is called without `name`, `cron`, or `prompt`
- **THEN** the system returns an error indicating the missing parameter

#### Scenario: 無效的 Cron 表達式
- **WHEN** `create` action is called with an invalid cron expression
- **THEN** the system returns an error indicating invalid cron format

### Requirement: 列出排程
The system SHALL support listing all scheduled tasks.

#### Scenario: 列出所有排程
- **WHEN** `manage_schedule` is called with `action: "list"`
- **THEN** the system returns all schedules with human-readable cron descriptions

### Requirement: 啟用/停用排程
The system SHALL support toggling schedule enabled state.

#### Scenario: 啟用排程
- **WHEN** `manage_schedule` is called with `action: "enable"` and `id` or `name`
- **THEN** the system finds the schedule and sets `enabled: true`

#### Scenario: 停用排程
- **WHEN** `manage_schedule` is called with `action: "disable"` and `id` or `name`
- **THEN** the system finds the schedule and sets `enabled: false`

### Requirement: 刪除排程
The system SHALL support deleting scheduled tasks.

#### Scenario: 刪除排程
- **WHEN** `manage_schedule` is called with `action: "delete"` and `id` or `name`
- **THEN** the system finds and removes the schedule

#### Scenario: 找不到排程
- **WHEN** enable/disable/delete is called with an unknown `id` or `name`
- **THEN** the system returns an error indicating the schedule was not found

### Requirement: 排程查詢輔助
The system SHALL support finding schedules by ID or name.

#### Scenario: 依 ID 查詢
- **WHEN** `id` parameter is provided
- **THEN** the system looks up the schedule by exact ID match

#### Scenario: 依名稱查詢
- **WHEN** `name` parameter is provided (without `id`)
- **THEN** the system looks up the schedule by partial name match via `findByName()`

### Requirement: Cron 人性化描述
The system SHALL convert cron expressions to human-readable descriptions.

#### Scenario: 常見 Cron 描述
- **WHEN** formatting schedule output
- **THEN** the system converts cron expressions to readable text:
  - `0 19 * * *` → "每天 19:00"
  - `0 8 * * 1-5` → "週一到週五 08:00"
  - `*/30 * * * *` → "每 30 分鐘"
