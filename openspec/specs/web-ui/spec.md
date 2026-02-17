### Requirement: Web UI HTTP Server
The system SHALL provide an HTTP server for OAuth login management, accessible via HA Ingress.

#### Scenario: 啟動伺服器
- **WHEN** the web UI module is loaded
- **THEN** the system starts an HTTP server on port 8099 (configurable via `WEB_UI_PORT`) listening on `0.0.0.0`

#### Scenario: 優雅關閉
- **WHEN** SIGTERM or SIGINT is received
- **THEN** the server closes gracefully

### Requirement: API 路由
The system SHALL handle the following HTTP routes.

#### Scenario: 首頁 (GET /)
- **WHEN** `GET /` is requested
- **THEN** the system returns the HTML template from `getHtmlTemplate()`

#### Scenario: Token 狀態 (GET /api/status)
- **WHEN** `GET /api/status` is requested
- **THEN** the system returns JSON with `hasCredentials`, `expiresAt`, and token status info

#### Scenario: 開始認證 (POST /api/auth/start)
- **WHEN** `POST /api/auth/start` is requested
- **THEN** the system calls `startAuthFlow()` and returns `{ authUrl, state }`

#### Scenario: 認證回呼 (POST /api/auth/callback)
- **WHEN** `POST /api/auth/callback` is requested with `{ code, state }`
- **THEN** the system calls `exchangeCodeForTokens()`, saves credentials, and returns success status

#### Scenario: 手動刷新 (POST /api/auth/refresh)
- **WHEN** `POST /api/auth/refresh` is requested
- **THEN** the system calls the token refresh service and returns the result

### Requirement: HA Ingress 相容性
The system SHALL handle HA Ingress path prefixing.

#### Scenario: Ingress 路徑剝離
- **WHEN** a request includes `X-Ingress-Path` header (e.g., `/api/hassio_ingress/abc123`)
- **THEN** the system strips the ingress prefix from the pathname before routing

#### Scenario: 無 Ingress 直接存取
- **WHEN** a request has no `X-Ingress-Path` header
- **THEN** the system routes normally using the full pathname

### Requirement: Request 處理
The system SHALL parse request bodies and set appropriate headers.

#### Scenario: JSON body 解析
- **WHEN** a POST request has `Content-Type: application/json`
- **THEN** the system parses the body as JSON

#### Scenario: Form-urlencoded body 解析
- **WHEN** a POST request has `Content-Type: application/x-www-form-urlencoded`
- **THEN** the system parses the body as URL-encoded form data

#### Scenario: CORS headers
- **WHEN** any response is sent
- **THEN** the system includes `Access-Control-Allow-Origin: *` and appropriate CORS headers

### Requirement: Web UI 前端
The system SHALL provide a single-page application (SPA) for OAuth login management.

#### Scenario: 登入狀態顯示
- **WHEN** the page loads and credentials exist
- **THEN** the UI shows a green status dot, expiry time, and a refresh button

#### Scenario: 未登入狀態顯示
- **WHEN** the page loads and no credentials exist
- **THEN** the UI shows a red status dot and the 3-step login wizard

#### Scenario: 3-Step 登入流程
- **WHEN** the user clicks "Login to Claude"
- **THEN** Step 1: Start auth → Opens Claude OAuth page in new tab
- **AND** Step 2: User completes OAuth authorization
- **AND** Step 3: User pastes authorization code → System exchanges for tokens

#### Scenario: 狀態自動輪詢
- **WHEN** the page is open
- **THEN** the system polls `/api/status` every 30 seconds to update the display

#### Scenario: Dark Mode 支援
- **WHEN** the user's system preference is dark mode
- **THEN** the UI renders with dark theme colors (via `prefers-color-scheme` media query)

#### Scenario: Ingress Base Path 處理
- **WHEN** the page is served behind HA Ingress
- **THEN** all API calls use the correct base path from the Ingress prefix
