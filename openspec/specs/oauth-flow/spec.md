### Requirement: OAuth 2.0 PKCE 登入流程
The system SHALL implement OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange) for Claude CLI authentication.

#### Scenario: 啟動登入流程
- **WHEN** `startAuthFlow()` is called
- **THEN** the system generates PKCE parameters (code_verifier, code_challenge) and state
- **AND** creates an in-memory session (10-minute TTL)
- **AND** returns the authorization URL with query parameters:
  - `response_type: code`
  - `client_id`: from `getOAuthConfig()`
  - `redirect_uri: https://platform.claude.com/oauth/code/callback`
  - `scope: org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers`
  - `code_challenge`: SHA-256 hash of code_verifier (base64url)
  - `code_challenge_method: S256`
  - `state`: random state value

### Requirement: PKCE 參數生成
The system SHALL generate cryptographically secure PKCE parameters.

#### Scenario: 生成 code_verifier
- **WHEN** `generatePKCE()` is called
- **THEN** the system generates 32 random bytes encoded as base64url string

#### Scenario: 生成 code_challenge
- **WHEN** `generatePKCE()` is called
- **THEN** the system computes SHA-256 of code_verifier and encodes as base64url

#### Scenario: 生成 state
- **WHEN** `generateState()` is called
- **THEN** the system generates 32 random bytes as base64url for CSRF protection

### Requirement: Authorization Code 交換
The system SHALL exchange the authorization code for tokens.

#### Scenario: 交換 code 成功
- **WHEN** `exchangeCodeForTokens(code, state)` is called with valid code and state
- **THEN** the system validates the session exists and hasn't expired
- **AND** sends POST to token endpoint with `application/json`:
  - `grant_type: authorization_code`
  - `client_id`, `code`, `redirect_uri`, `code_verifier`
- **AND** returns the token response

#### Scenario: Session 已過期
- **WHEN** `exchangeCodeForTokens()` is called after 10 minutes
- **THEN** the system returns an error indicating session expired

#### Scenario: State 不匹配
- **WHEN** `exchangeCodeForTokens()` is called with an unknown state
- **THEN** the system returns an error indicating invalid state

#### Scenario: Code 格式處理
- **WHEN** the authorization code contains `#state` suffix (e.g., `code#state`)
- **THEN** the system strips the `#` and everything after it before exchanging

### Requirement: Credentials 儲存
The system SHALL save tokens in CLI-compatible format.

#### Scenario: 儲存 credentials
- **WHEN** `saveCredentials(tokenResponse)` is called
- **THEN** the system writes to `.credentials.json` with format:
  - `claudeAiOauth.accessToken`: access_token value
  - `claudeAiOauth.refreshToken`: refresh_token value
  - `claudeAiOauth.expiresAt`: `Date.now() + expires_in * 1000` (Unix ms number)
  - `claudeAiOauth.scopes`: scope string split into array
  - No nested objects (`organization`, `account` filtered out)

#### Scenario: Add-on 權限修正
- **WHEN** credentials are saved in Add-on environment
- **THEN** the system runs `chown claude:claude` on the credentials file so non-root user can read it

### Requirement: Session 管理
The system SHALL manage PKCE sessions in memory with automatic expiration.

#### Scenario: Session 存活期
- **WHEN** a PKCE session is created
- **THEN** the session is valid for 10 minutes from creation time

#### Scenario: Session 清理
- **WHEN** a session is used or expires
- **THEN** the session is removed from memory
