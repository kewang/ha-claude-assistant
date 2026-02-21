## MODIFIED Requirements

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

#### Scenario: 呼叫 manage_memory 工具
- **WHEN** a `CallToolRequest` is received with tool name `manage_memory`
- **THEN** the system calls `executeManageMemory()` with the provided arguments and returns the result

#### Scenario: 工具執行失敗
- **WHEN** a tool executor throws an error
- **THEN** the system returns `{ content: [{ type: "text", text: JSON.stringify({ success: false, error }) }], isError: true }`

#### Scenario: 未知工具名稱
- **WHEN** a `CallToolRequest` is received with an unknown tool name
- **THEN** the system returns `{ success: false, error: "Unknown tool" }`
