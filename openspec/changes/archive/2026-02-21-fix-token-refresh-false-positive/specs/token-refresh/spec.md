## MODIFIED Requirements

### Requirement: Token 刷新 API 呼叫
The system SHALL use the OAuth token endpoint to refresh tokens.

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

#### Scenario: 刷新失敗 - invalid_grant
- **WHEN** the token endpoint returns HTTP 400 with `{"error": "invalid_grant"}`
- **THEN** the system marks the state as needing re-login and triggers notification

#### Scenario: 刷新失敗 - API 錯誤回應
- **WHEN** the token endpoint returns a non-400 HTTP error (e.g., 5xx) or the JSON `error` field is not `invalid_grant`
- **THEN** the system SHALL NOT mark the state as needing re-login, and SHALL increment the consecutive failure counter

#### Scenario: 刷新失敗 - 網路錯誤
- **WHEN** the refresh API call fails due to network error (timeout, DNS failure, connection refused)
- **THEN** the system SHALL NOT mark the state as needing re-login, and SHALL increment the consecutive failure counter
