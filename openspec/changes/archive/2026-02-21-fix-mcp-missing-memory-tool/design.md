## Context

MCP Server (`src/interfaces/mcp-server.ts`) 手動定義了 tool 清單和執行路由，但漏掉了 `manage_memory`。雖然 `src/tools/index.ts` 有統一匯出 `haTools` 陣列和 `executeTool()` 函式，MCP Server 卻沒有使用它們，而是各自硬編碼。

## Goals / Non-Goals

**Goals:**
- 在 MCP Server 補上 `manage_memory` tool 的註冊和路由
- 讓 Claude CLI 可以透過 MCP 呼叫 `manage_memory`

**Non-Goals:**
- 不重構 MCP Server 改用 `haTools` / `executeTool()`（避免範圍膨脹，另開 change 處理）
- 不修改 `manage_memory` tool 本身的邏輯

## Decisions

### 1. 沿用現有硬編碼模式新增 tool

**選擇**：在 `ListToolsRequestSchema` handler 加入 `manage_memory` 的 tool 定義，在 `CallToolRequestSchema` handler 加入對應的 case。

**理由**：與現有 6 個 tool 的註冊方式一致，改動最小。重構為使用 `haTools`/`executeTool()` 是另一個獨立的改善項目。

## Risks / Trade-offs

- [風險] MCP Server 繼續硬編碼 tool 清單，未來新增 tool 仍可能遺漏 → 可另開 change 重構為使用 `haTools`/`executeTool()`
