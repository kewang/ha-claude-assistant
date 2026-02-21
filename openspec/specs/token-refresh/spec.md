### Requirement: OAuth Token 自動刷新
The system SHALL provide a `ClaudeTokenRefreshService` singleton that automatically refreshes Claude CLI OAuth tokens before they expire.

#### Scenario: 啟動定期檢查
- **WHEN** `start()` is called
- **THEN** the system begins checking token status every 5 minutes

#### Scenario: 停止定期檢查
- **WHEN** `stop()` is called
- **THEN** the system stops the periodic check interval

### Requirement: 提前刷新 Token
The system SHALL proactively refresh access tokens before they expire.

#### Scenario: Token 即將過期
- **WHEN** the periodic check detects the access token will expire within 30 minutes
- **THEN** the system automatically refreshes the token using the refresh token

#### Scenario: Token 仍有效
- **WHEN** the periodic check detects the access token has more than 30 minutes remaining
- **THEN** the system takes no action

### Requirement: 執行前 Token 驗證
The system SHALL provide `ensureValidToken()` for pre-execution checks.

#### Scenario: Token 有效
- **WHEN** `ensureValidToken()` is called and the token is valid
- **THEN** the system returns `{ valid: true }`

#### Scenario: Token 過期但可刷新
- **WHEN** `ensureValidToken()` is called and the access token is expired but refresh token is valid
- **THEN** the system refreshes the token and returns `{ valid: true }`

#### Scenario: Refresh Token 過期
- **WHEN** `ensureValidToken()` is called and the refresh token is also expired
- **THEN** the system returns `{ valid: false, needsRelogin: true }`

### Requirement: Token 刷新 API 呼叫
The system SHALL use the OAuth token endpoint to refresh tokens, with concurrency control to prevent duplicate refresh requests.

#### Scenario: 刷新 Token 請求
- **WHEN** `refreshToken()` is called
- **THEN** the system sends a POST request to the token endpoint (from `getOAuthConfig()`) with:
  - `grant_type: "refresh_token"`
  - `refresh_token`: current refresh token
  - `client_id`: from OAuth config
  - Content-Type: `application/json`

#### Scenario: 刷新成功
- **WHEN** the token endpoint returns new tokens
- **THEN** the system updates the credentials file with:
  - New `accessToken` and `refreshToken`
  - `expiresAt` as Unix millisecond timestamp (number)
  - `scopes` as string array
  - No nested objects (filters out `organization`, `account`)

#### Scenario: 並發 refresh 請求合併
- **WHEN** `refreshToken()` is called while another refresh is already in progress
- **THEN** the system SHALL return the same Promise as the in-progress refresh, without sending a second API request

#### Scenario: refresh Promise 清除
- **WHEN** a refresh request completes (success or failure)
- **THEN** the system SHALL clear the in-progress Promise so subsequent calls can initiate a new refresh

#### Scenario: 刷新失敗 - invalid_grant
- **WHEN** the token endpoint returns HTTP 400 with `{"error": "invalid_grant"}`
- **THEN** the system marks the state as needing re-login and triggers notification

#### Scenario: 刷新失敗 - API 錯誤回應
- **WHEN** the token endpoint returns a non-400 HTTP error (e.g., 5xx) or the JSON `error` field is not `invalid_grant`
- **THEN** the system SHALL NOT mark the state as needing re-login, and SHALL increment the consecutive failure counter

#### Scenario: 刷新失敗 - 網路錯誤
- **WHEN** the refresh API call fails due to network error (timeout, DNS failure, connection refused)
- **THEN** the system SHALL NOT mark the state as needing re-login, and SHALL increment the consecutive failure counter

### Requirement: 失敗通知機制
The system SHALL notify users when manual intervention is needed.

#### Scenario: Refresh Token 過期通知
- **WHEN** the refresh token is expired and re-login is required
- **THEN** the system calls the registered notification callback with failure details

#### Scenario: 連續失敗計數
- **WHEN** token refresh fails 3 consecutive times
- **THEN** the system stops retrying and sends a notification

### Requirement: Credentials 檔案格式
The system SHALL maintain CLI-compatible credentials format.

#### Scenario: Credentials 寫入格式
- **WHEN** tokens are saved to `.credentials.json`
- **THEN** the file contains the `claudeAiOauth` object with:
  - `expiresAt`: Unix millisecond timestamp (number, not string)
  - `scopes`: string array (not space-separated string)
  - No `organization` or `account` nested objects

### Requirement: Singleton 模式
The system SHALL provide a singleton via `getTokenRefreshService()`.

#### Scenario: 取得 singleton
- **WHEN** `getTokenRefreshService()` is called multiple times
- **THEN** the system returns the same `ClaudeTokenRefreshService` instance
