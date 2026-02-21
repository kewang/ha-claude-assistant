### Requirement: MCP Server
The system SHALL provide a Model Context Protocol (MCP) server that exposes HA tools for Claude Code integration via stdio transport.

#### Scenario: 啟動 MCP Server
- **WHEN** the MCP server module is loaded
- **THEN** the system creates a `StdioServerTransport`, registers all tool handlers, and connects

#### Scenario: MCP 協議隔離
- **WHEN** the server is running
- **THEN** stdout is reserved exclusively for MCP protocol communication
- **AND** all logging uses stderr via `createLogger('MCP', { useStderr: true })`

### Requirement: 工具註冊
The system SHALL register all HA tools and respond to tool listing requests.

#### Scenario: ListTools 請求
- **WHEN** a `ListToolsRequest` is received
- **THEN** the system returns the `haTools` array containing all 7 tool definitions:
  - `list_entities`
  - `get_state`
  - `call_service`
  - `manage_schedule`
  - `get_history`
  - `manage_event_subscription`
  - `manage_memory`

### Requirement: 工具執行路由
The system SHALL route tool calls to the appropriate executor.

#### Scenario: CallTool 請求
- **WHEN** a `CallToolRequest` is received with a valid tool name
- **THEN** the system routes to the corresponding executor via `executeTool()` and returns the result as `{ content: [{ type: "text", text: result }] }`

#### Scenario: 工具執行失敗
- **WHEN** a tool executor throws an error
- **THEN** the system returns `{ content: [{ type: "text", text: JSON.stringify({ success: false, error }) }], isError: true }`

#### Scenario: 未知工具名稱
- **WHEN** a `CallToolRequest` is received with an unknown tool name
- **THEN** the system returns `{ success: false, error: "Unknown tool" }`

### Requirement: HA 連線初始化
The system SHALL initialize the HA client on startup.

#### Scenario: 背景連線
- **WHEN** the MCP server starts
- **THEN** the system creates an `HAClient` and runs `autoConnect()` in background (non-blocking)
- **AND** the server is ready to accept requests immediately (autoConnect does not block)
