### Requirement: 動態提取 OAuth 設定
The system SHALL provide a `getOAuthConfig()` function that dynamically extracts OAuth configuration (CLIENT_ID, TOKEN_URL) from the Claude CLI binary.

#### Scenario: 從 binary 成功提取
- **WHEN** `getOAuthConfig()` is called and the Claude CLI binary is accessible
- **THEN** the system uses `strings` command to extract TOKEN_URL and CLIENT_ID patterns from the binary
- **AND** returns `{ tokenUrl, clientId, source: "binary" }`

#### Scenario: Binary 提取失敗，使用 fallback
- **WHEN** `getOAuthConfig()` is called but extraction from binary fails
- **THEN** the system returns fallback values:
  - `tokenUrl: "https://platform.claude.com/v1/oauth/token"`
  - `clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e"`
  - `source: "fallback"`

### Requirement: 提取策略
The system SHALL search for specific patterns in the binary output.

#### Scenario: 提取 TOKEN_URL
- **WHEN** parsing `strings` output
- **THEN** the system looks for `TOKEN_URL:"https://..."` pattern or direct URL matching `platform.claude.com`

#### Scenario: 提取 CLIENT_ID
- **WHEN** parsing `strings` output
- **THEN** the system looks for `CLIENT_ID:"uuid"` pattern or UUID near OAuth context

### Requirement: 結果快取
The system SHALL cache the extracted config for performance.

#### Scenario: 首次呼叫
- **WHEN** `getOAuthConfig()` is called for the first time
- **THEN** the system performs binary extraction and caches the result

#### Scenario: 後續呼叫
- **WHEN** `getOAuthConfig()` is called after caching
- **THEN** the system returns the cached result without re-extraction

#### Scenario: 清除快取
- **WHEN** `clearOAuthConfigCache()` is called
- **THEN** the next `getOAuthConfig()` call will re-extract from the binary

### Requirement: Claude CLI 路徑解析
The system SHALL resolve the actual Claude CLI binary path, handling symlinks.

#### Scenario: 解析 symlink
- **WHEN** the Claude CLI path is a symbolic link
- **THEN** the system follows the link to find the actual binary for `strings` extraction
