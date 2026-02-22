## ADDED Requirements

### Requirement: 跨 Process 容錯
The system SHALL detect when another process has already refreshed the token, avoiding false re-login notifications.

#### Scenario: invalid_grant 後偵測到 credentials 已更新
- **WHEN** the OAuth API returns HTTP 400 with `invalid_grant`
- **AND** re-reading the credentials file reveals a different `expiresAt` value than what was read at the start of this refresh attempt
- **AND** the new `expiresAt` is not within the expiring-soon threshold (30 minutes)
- **THEN** the system SHALL return a successful result with message indicating another process performed the refresh
- **AND** the system SHALL NOT send a re-login notification
- **AND** the system SHALL reset the consecutive failure counter

#### Scenario: invalid_grant 且 credentials 未更新
- **WHEN** the OAuth API returns HTTP 400 with `invalid_grant`
- **AND** re-reading the credentials file shows the same `expiresAt` or a still-expiring-soon value
- **THEN** the system SHALL send the re-login notification (existing behavior)

#### Scenario: invalid_grant 且 credentials 檔案不存在
- **WHEN** the OAuth API returns HTTP 400 with `invalid_grant`
- **AND** re-reading the credentials file returns null
- **THEN** the system SHALL send the re-login notification (existing behavior)

### Requirement: Process Label 支援
The system SHALL support an optional process label for log identification across multiple daemon processes.

#### Scenario: 建立帶 label 的 service
- **WHEN** `new ClaudeTokenRefreshService('Scheduler')` is called
- **THEN** the service's logger module name SHALL be `TokenRefresh:Scheduler`

#### Scenario: 建立不帶 label 的 service（向下相容）
- **WHEN** `new ClaudeTokenRefreshService()` is called
- **THEN** the service's logger module name SHALL be `TokenRefresh`

#### Scenario: singleton factory 帶 label
- **WHEN** `getTokenRefreshService('EventListener')` is called for the first time
- **THEN** the singleton instance SHALL be created with label `EventListener`

#### Scenario: singleton factory 重複呼叫
- **WHEN** `getTokenRefreshService()` is called after the singleton has been created
- **THEN** the system SHALL return the existing instance, ignoring any new label parameter

## MODIFIED Requirements

### Requirement: 刷新失敗 - invalid_grant
The system SHALL handle `invalid_grant` errors with cross-process awareness.

#### Scenario: 刷新失敗 - invalid_grant
- **WHEN** the token endpoint returns HTTP 400 with `{"error": "invalid_grant"}`
- **THEN** the system SHALL re-read the credentials file to check for updates by another process
- **AND** if credentials have been updated with a valid (not expiring soon) token, return success
- **AND** if credentials have NOT been updated, mark the state as needing re-login and trigger notification

### Requirement: Singleton 模式
The system SHALL provide a singleton via `getTokenRefreshService()` with optional process label.

#### Scenario: 取得 singleton（帶 label）
- **WHEN** `getTokenRefreshService('Scheduler')` is called for the first time
- **THEN** the system creates and returns a `ClaudeTokenRefreshService` instance with label `Scheduler`

#### Scenario: 取得 singleton（不帶 label）
- **WHEN** `getTokenRefreshService()` is called for the first time without label
- **THEN** the system creates and returns a `ClaudeTokenRefreshService` instance without label

#### Scenario: 取得既有 singleton
- **WHEN** `getTokenRefreshService()` is called after the singleton has been created
- **THEN** the system returns the same `ClaudeTokenRefreshService` instance
