### Requirement: 統一 Logger 工具
The system SHALL provide a `createLogger()` factory function that creates module-specific loggers with timestamps.

#### Scenario: 建立 Logger
- **WHEN** `createLogger('MyModule')` is called
- **THEN** the system returns a `Logger` instance tagged with "MyModule"

### Requirement: Log 方法
The system SHALL provide standard logging methods with consistent formatting.

#### Scenario: info 日誌
- **WHEN** `logger.info('Starting...')` is called
- **THEN** the system outputs: `[2026-02-17 14:30:15] [MyModule] Starting...` to stdout

#### Scenario: error 日誌
- **WHEN** `logger.error('Failed:', error)` is called
- **THEN** the system outputs the error message to stderr

#### Scenario: warn 日誌
- **WHEN** `logger.warn('Warning')` is called
- **THEN** the system outputs the warning with timestamp to stdout

#### Scenario: debug 日誌
- **WHEN** `logger.debug('Debug info')` is called and `DEBUG` environment variable is set
- **THEN** the system outputs the debug message with timestamp

#### Scenario: debug 日誌 (未啟用)
- **WHEN** `logger.debug('Debug info')` is called and `DEBUG` environment variable is not set
- **THEN** the system suppresses the output

#### Scenario: raw 輸出
- **WHEN** `logger.raw('User message')` is called
- **THEN** the system outputs `User message` without timestamp (for user-facing output)

### Requirement: 時間戳記格式
The system SHALL format timestamps in `Asia/Taipei` timezone.

#### Scenario: 時間戳記格式
- **WHEN** a log message is written
- **THEN** the timestamp format is `YYYY-MM-DD HH:mm:ss` in Asia/Taipei timezone

### Requirement: MCP Server 相容模式
The system SHALL support stderr-only mode for MCP protocol compatibility.

#### Scenario: MCP 模式建立
- **WHEN** `createLogger('MCP', { useStderr: true })` is called
- **THEN** all output (including info, warn) goes to stderr, keeping stdout clean for MCP protocol

### Requirement: Log 格式
The system SHALL use a consistent log format across all modules.

#### Scenario: 標準格式
- **WHEN** any log method (except `raw`) is called
- **THEN** the output format is: `[YYYY-MM-DD HH:mm:ss] [ModuleName] Message`
