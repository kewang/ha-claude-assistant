## 1. 新增轉換工具

- [x] 1.1 建立 `src/utils/tool-schema-converter.ts`，實作 `toMcpTool()` 和 `toMcpTools()` 函式

## 2. 重構 MCP Server

- [x] 2.1 修改 `src/interfaces/mcp-server.ts` 的 `ListToolsRequestSchema` handler，移除手動重複的 tool schema，改用 `import { haTools }` + `toMcpTools(haTools)`
- [x] 2.2 修改 `src/interfaces/mcp-server.ts` 的 `CallToolRequestSchema` handler，移除手動 switch routing，改用 `import { executeTool }` + `executeTool(haClient, name, args)`
- [x] 2.3 清理不再需要的 import（個別 execute 函式和 Input type）

## 3. 測試

- [x] 3.1 建立 `tests/tool-schema-converter.test.ts`，測試轉換函式基本功能
- [x] 3.2 新增迴歸測試：確認 `entity_filter` 為 `array` 型別、`get_history` 包含 `minimal_response` 和 `significant_changes_only`
- [x] 3.3 執行 `npm test` 確認所有測試通過
- [x] 3.4 執行 `npm run build` 確認 TypeScript 編譯成功
