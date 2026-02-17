## MODIFIED Requirements

### Requirement: Slack 通知
The system SHALL send execution results via NotificationManager instead of directly calling Slack API.

#### Scenario: 成功通知
- **WHEN** a scheduled task executes successfully
- **THEN** the system sends via `NotificationManager` with `source: "schedule"`:
  ```
  📋 *排程任務執行完成*
  *名稱*: {schedule.name}
  *時間*: {timestamp}

  {output}
  ```

#### Scenario: 失敗通知
- **WHEN** a scheduled task fails
- **THEN** the system sends via `NotificationManager` with `source: "schedule"`:
  ```
  ❌ *排程任務執行失敗*
  *名稱*: {schedule.name}
  *時間*: {timestamp}
  *錯誤*: {error message}
  ```

#### Scenario: Token 刷新服務通知回呼
- **WHEN** the token refresh service needs to send a notification
- **THEN** the system uses `NotificationManager` for the callback instead of direct Slack API call
