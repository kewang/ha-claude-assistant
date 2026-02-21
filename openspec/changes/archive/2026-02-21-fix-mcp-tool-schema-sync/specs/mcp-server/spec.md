## MODIFIED Requirements

### Requirement: 工具註冊
The system SHALL register all HA tools and respond to tool listing requests.

#### Scenario: ListTools 請求
- **WHEN** a `ListToolsRequest` is received
- **THEN** the system converts the `haTools` array from `src/tools/index.ts` using `toMcpTools()` and returns the result
- **AND** the returned tool schemas SHALL be identical to the source definitions in `src/tools/*.ts`（僅 `input_schema` → `inputSchema` key rename）

### Requirement: 工具執行路由
The system SHALL route tool calls to the appropriate executor.

#### Scenario: CallTool 請求
- **WHEN** a `CallToolRequest` is received with a valid tool name
- **THEN** the system calls `executeTool(haClient, name, args)` from `src/tools/index.ts` and returns the result as `{ content: [{ type: "text", text: result }] }`

#### Scenario: 工具執行失敗
- **WHEN** a tool executor throws an error
- **THEN** the system returns `{ content: [{ type: "text", text: JSON.stringify({ success: false, error }) }], isError: true }`

#### Scenario: 未知工具名稱
- **WHEN** a `CallToolRequest` is received with an unknown tool name
- **THEN** the system returns `{ success: false, error: "Unknown tool" }`
