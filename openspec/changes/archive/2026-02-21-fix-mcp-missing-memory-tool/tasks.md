## 1. MCP Server 補上 manage_memory

- [x] 1.1 在 `mcp-server.ts` 加入 `manage_memory` 的 import（`executeManageMemory` 和 `ManageMemoryInput`）
- [x] 1.2 在 `ListToolsRequestSchema` handler 的 tools 陣列中加入 `manage_memory` tool 定義（name, description, inputSchema）
- [x] 1.3 在 `CallToolRequestSchema` handler 的 switch 中加入 `manage_memory` case，呼叫 `executeManageMemory()`

## 2. Add-on run.sh 補上 memories 目錄初始化

- [x] 2.1 在 `run.sh` 的 `mkdir -p` 區段加入 `/data/memories`
- [x] 2.2 在 `run.sh` 的 `chown` 區段加入 `/data/memories`
- [x] 2.3 在 `PERMISSIONS_TO_ADD` 陣列加入 `mcp__ha-assistant__manage_memory`

## 3. 驗證

- [x] 3.1 執行 `npm run build` 確認編譯通過
- [x] 3.2 執行 `npm test` 確認現有測試不受影響
