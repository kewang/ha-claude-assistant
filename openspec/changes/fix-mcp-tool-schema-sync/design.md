## Context

MCP Server (`src/interfaces/mcp-server.ts`) 手動重複定義了所有 7 個 tool 的 schema（約 230 行），與 `src/tools/*.ts` 中的定義維持雙份。最近 `entityFilter` 從 `string` 重構為 `string[]` 時，只更新了 `src/tools/` 而遺漏了 MCP Server 的副本，導致 Slack Bot 透過 `claude --print` → MCP Server 路徑時，模型看到過時的 `string` 型別 schema。

兩種格式的唯一差異：
- Anthropic SDK `Tool`: 使用 `input_schema`（snake_case）
- MCP SDK: 使用 `inputSchema`（camelCase）

內部 JSON Schema 結構完全相同。

## Goals / Non-Goals

**Goals:**
- 消除 MCP Server 中的重複 tool schema 定義
- 確保 MCP Server 永遠使用 `src/tools/` 中的最新 schema
- 簡化 MCP Server 的 tool call routing
- 統一 Add-on `/data` 目錄權限設定，避免新增資料目錄時遺漏

**Non-Goals:**
- 修改任何 tool 的功能行為
- 修改 Anthropic SDK `Tool` 型別定義
- 統一兩種 SDK 的型別系統

## Decisions

### 1. 新增轉換函式而非直接改 tool 定義格式

**選擇**: 新增 `toMcpTool()` 轉換函式
**理由**: `src/tools/*.ts` 使用 Anthropic SDK 的 `Tool` type（`input_schema`），這是其他介面（CLI、Slack Bot）也在使用的格式。改變它會影響更多地方。轉換函式只做 key rename，簡單且無風險。

### 2. 同時簡化 CallTool handler

**選擇**: 用 `executeTool(haClient, name, args)` 取代手動 switch routing
**理由**: `src/tools/index.ts` 已有 `executeTool()` 函式做完全相同的路由。MCP Server 的 switch 是另一份重複，同樣有新增 tool 時遺漏的風險（如 `manage_memory` 就曾遺漏）。

### 3. `/data` 權限統一設定

**選擇**: `chown -R claude:claude /data` 取代逐一 `chown` 個別子目錄
**理由**: 原本每新增一個資料目錄就要在 `run.sh` 加一行 `chown`，遺漏時就會出現權限問題。統一對 `/data` 做 recursive chown 可一勞永逸。`/data/options.json` 由 HA Supervisor 管理，但因為只讀取不寫入，改變其 ownership 無影響。

## Risks / Trade-offs

- **[MCP SDK 型別相容性]** → `inputSchema` 可能需要 `as` 斷言。MCP SDK 的 Zod schema 用 `.catchall(z.unknown())` 接受額外欄位，風險低。
- **[Anthropic SDK `as const` 轉換]** → `input_schema` 中的 `type: 'object' as const` 需確保轉換後 MCP SDK 仍接受。由於 MCP SDK 期望 `type: string`，literal type 是相容的。
