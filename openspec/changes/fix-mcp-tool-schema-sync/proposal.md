## Why

MCP Server 中 `manage_event_subscription` 的 tool schema 與 `src/tools/manage-event-subscription.ts` 不一致。MCP Server 仍將 `entity_filter` 定義為 `type: 'string'`，但 tool 定義已重構為 `type: 'array'`。這導致透過 Slack Bot（走 `claude --print` → MCP Server）建立事件訂閱時，模型無法正確填入 `entity_filter` 參數，永遠為 `null`。

根本原因是 MCP Server 手動重複定義了所有 tool schema（約 230 行），而非從 `src/tools/` 的 `haTools` 陣列轉換而來，導致更新 tool 定義時遺漏同步 MCP Server 的副本。

## What Changes

- 新增 `toMcpTool` / `toMcpTools` 轉換函式，將 Anthropic SDK `Tool`（`input_schema`）轉為 MCP 格式（`inputSchema`）
- 重構 `mcp-server.ts`，移除手動重複的 tool schema，改用 `haTools` + 轉換函式
- 同時簡化 `CallToolRequestSchema` handler，改用 `executeTool()` 統一路由
- 新增轉換器測試和迴歸測試

## Capabilities

### New Capabilities

- `tool-schema-converter`: 將 Anthropic SDK Tool 定義轉換為 MCP Tool 格式的工具函式

### Modified Capabilities

- `mcp-server`: ListTools handler 改為從 `haTools` 轉換，CallTool handler 改用 `executeTool()` 統一路由，消除重複定義

## Impact

- `src/interfaces/mcp-server.ts` — 移除約 230 行重複 schema，大幅簡化
- `src/utils/tool-schema-converter.ts` — 新增檔案
- 修復 `entity_filter` 和 `get_history` 缺少參數的 schema 不一致問題
- 無 breaking change（對外行為不變，只是 schema 來源統一）
