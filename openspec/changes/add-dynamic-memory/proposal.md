## Why

目前的 `ConversationStore` 只提供短期對話記憶（每個 thread/session 獨立，最多 7 天過期），助理無法跨對話記住使用者偏好、設備暱稱、生活習慣等資訊。每次新對話都像第一次互動，缺乏人性化體驗。需要一個長期記憶機制，讓助理能從日常對話中自動學習並累積知識。

## What Changes

- 新增 `MemoryStore` 類別，提供記憶的持久化儲存（JSON 檔），支援 CRUD 操作和關鍵字搜尋
- 新增 `manage_memory` MCP Tool，讓 Claude 自主管理記憶（儲存、列出、搜尋、刪除）
- 修改 Slack Bot 和 Scheduler 的 prompt 注入流程，在每次呼叫 Claude CLI 前自動注入相關記憶
- 修改 MCP Server 工具註冊，加入新的 `manage_memory` tool

## Capabilities

### New Capabilities
- `memory-store`: 記憶持久化儲存引擎，提供 CRUD 操作、關鍵字搜尋、容量上限管理
- `manage-memory-tool`: MCP Tool，讓 Claude 自主儲存、列出、搜尋、刪除記憶

### Modified Capabilities
- `slack-bot`: prompt 注入流程需加入記憶上下文，在 `buildPromptWithHistory()` 之外額外注入長期記憶
- `mcp-server`: 工具註冊列表需加入 `manage_memory` tool
- `scheduler-daemon`: 排程執行時的 prompt 需注入相關記憶

## Impact

- **新增檔案**: `src/core/memory-store.ts`, `src/tools/manage-memory.ts`, `tests/memory-store.test.ts`
- **修改檔案**: `src/tools/index.ts`, `src/interfaces/slack-bot.ts`, `src/interfaces/mcp-server.ts`, `src/interfaces/scheduler-daemon.ts`
- **資料檔案**: `data/memories.json`（一般環境）、`/data/memories/memories.json`（Add-on 環境）
- **無破壞性變更**: 純新增功能，不影響現有行為
- **無新增依賴**: 使用現有的 fs API 和 JSON 儲存模式
