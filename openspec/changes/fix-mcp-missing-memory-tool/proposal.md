## Why

MCP Server 的 `ListToolsRequestSchema` handler 和 `CallToolRequestSchema` handler 都漏掉了 `manage_memory` tool 的註冊。導致 Claude CLI 透過 MCP 取得工具清單時看不到記憶管理功能，使用者在 Slack 說「記住 XXX」時 Claude 只會口頭回應但不會實際儲存記憶。這違反了 `mcp-server` spec 中「註冊所有 7 個 tool」的要求。

## What Changes

- 在 MCP Server 的 `ListToolsRequestSchema` handler 中加入 `manage_memory` tool 定義
- 在 MCP Server 的 `CallToolRequestSchema` handler 中加入 `manage_memory` 的 case 路由

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `mcp-server`: 工具註冊需包含 `manage_memory`，工具執行路由需支援 `manage_memory`

## Impact

- 修改 `src/interfaces/mcp-server.ts`
- 不影響 API、不影響其他工具、無 breaking change
