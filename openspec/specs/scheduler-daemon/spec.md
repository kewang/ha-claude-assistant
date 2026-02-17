### Requirement: 排程服務背景程序
The system SHALL provide a daemon process that executes scheduled tasks via Claude CLI and sends results to Slack.

#### Scenario: 啟動排程服務
- **WHEN** the scheduler daemon starts
- **THEN** the system:
  1. Loads all schedules from `ScheduleStore`
  2. Creates cron jobs for all enabled schedules
  3. Starts the token refresh service
  4. Begins watching the schedules file for changes

#### Scenario: 優雅關閉
- **WHEN** SIGINT or SIGTERM is received
- **THEN** the system stops all cron tasks, stops the token refresh service, and exits

### Requirement: Cron 排程執行
The system SHALL create and manage cron tasks based on stored schedules.

#### Scenario: 建立 cron 任務
- **WHEN** a schedule with `enabled: true` is loaded
- **THEN** the system creates a `node-cron` task with the schedule's cron expression in `Asia/Taipei` timezone

#### Scenario: 停止 cron 任務
- **WHEN** a schedule is disabled or deleted
- **THEN** the system destroys the corresponding cron task

#### Scenario: Cron 表達式驗證
- **WHEN** a schedule is loaded with an invalid cron expression
- **THEN** the system skips the schedule and logs a warning

### Requirement: 排程任務執行流程
The system SHALL execute scheduled prompts via Claude CLI with token management.

#### Scenario: 正常執行流程
- **WHEN** a cron job triggers
- **THEN** the system:
  1. Calls `ensureValidToken()` to check token status
  2. Loads conversation history for `schedule:${id}`
  3. Builds augmented prompt with history
  4. Spawns `claude --print --permission-mode bypassPermissions`
  5. Saves exchange to conversation store
  6. Sends result to Slack

#### Scenario: Token 過期需重新登入
- **WHEN** `ensureValidToken()` returns `needsRelogin: true`
- **THEN** the system sends a failure notification to Slack and skips execution

### Requirement: Token 過期重試機制
The system SHALL retry execution once on token-related failures.

#### Scenario: 偵測 Token 錯誤
- **WHEN** Claude CLI execution fails with output containing `401`, `authentication_error`, or `token` + `expired`
- **THEN** the system identifies it as a token error

#### Scenario: Token 錯誤重試
- **WHEN** a token error is detected during execution
- **THEN** the system:
  1. Calls `refreshToken()` to get a new access token
  2. Retries the Claude CLI execution once
  3. If retry succeeds → sends success notification
  4. If retry fails → sends failure notification

#### Scenario: 非 Token 錯誤
- **WHEN** Claude CLI fails with a non-token error
- **THEN** the system sends a failure notification without retrying

### Requirement: Slack 通知
The system SHALL send execution results to Slack.

#### Scenario: 成功通知
- **WHEN** a scheduled task executes successfully
- **THEN** the system sends to `SLACK_DEFAULT_CHANNEL`:
  ```
  📋 *排程任務執行完成*
  *名稱*: {schedule.name}
  *時間*: {timestamp}

  {output}
  ```

#### Scenario: 失敗通知
- **WHEN** a scheduled task fails
- **THEN** the system sends to `SLACK_DEFAULT_CHANNEL`:
  ```
  ❌ *排程任務執行失敗*
  *名稱*: {schedule.name}
  *時間*: {timestamp}
  *錯誤*: {error message}
  ```

### Requirement: 檔案變更即時重載
The system SHALL reload schedules when the JSON file changes.

#### Scenario: 排程檔案變更
- **WHEN** `schedules.json` is modified (with 500ms debounce)
- **THEN** the system stops all current cron tasks, reloads schedules, and starts new cron tasks for enabled schedules

### Requirement: Claude CLI 執行
The system SHALL spawn Claude CLI with appropriate configuration.

#### Scenario: Claude CLI 參數
- **WHEN** executing a scheduled prompt
- **THEN** the system spawns with:
  - Binary: from `env.claudePath`
  - Args: `['--print', '--permission-mode', 'bypassPermissions', prompt]`
  - Timeout: 3 minutes (configurable via `CLAUDE_TIMEOUT_MS`)
  - Environment: includes `CLAUDE_CONFIG_DIR` in Add-on mode
