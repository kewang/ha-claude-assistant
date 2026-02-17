### Requirement: 環境偵測
The system SHALL provide utility functions to detect the runtime environment (HA Add-on vs standalone) and return appropriate configuration.

#### Scenario: Add-on 環境偵測
- **WHEN** `SUPERVISOR_TOKEN` environment variable is present
- **THEN** `isAddonEnvironment()` returns `true`

#### Scenario: 一般環境偵測
- **WHEN** `SUPERVISOR_TOKEN` environment variable is absent
- **THEN** `isAddonEnvironment()` returns `false`

### Requirement: 環境資訊物件
The system SHALL provide a `detectEnvironment()` function returning comprehensive environment info.

#### Scenario: Add-on 環境資訊
- **WHEN** `detectEnvironment()` is called in Add-on environment
- **THEN** the system returns:
  - `isAddon: true`
  - `supervisorToken`: value of `SUPERVISOR_TOKEN`
  - `supervisorUrl: "http://supervisor/core"`
  - `dataPath`: `/data/schedules/schedules.json` (or from `SCHEDULE_DATA_PATH`)
  - `claudePath`: `claude` or from `CLAUDE_PATH` env
  - `claudeConfigDir: "/data/claude"`

#### Scenario: 一般環境資訊
- **WHEN** `detectEnvironment()` is called in standalone environment
- **THEN** the system returns:
  - `isAddon: false`
  - `supervisorUrl`: empty string
  - `dataPath`: from `SCHEDULE_DATA_PATH` env or empty
  - `claudePath`: `~/.local/bin/claude` or from `CLAUDE_PATH` env
  - `claudeConfigDir`: from `CLAUDE_CONFIG_DIR` env or empty

### Requirement: HA 連線設定
The system SHALL provide a `getHAConfig()` function returning HA API configuration.

#### Scenario: Add-on HA 設定
- **WHEN** `getHAConfig()` is called in Add-on environment
- **THEN** the system returns `{ url: "http://supervisor/core", token: SUPERVISOR_TOKEN }`

#### Scenario: 一般環境 HA 設定
- **WHEN** `getHAConfig()` is called in standalone environment
- **THEN** the system returns `{ url: HA_URL, token: HA_TOKEN }` from environment variables
