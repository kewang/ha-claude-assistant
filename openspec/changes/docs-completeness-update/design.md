## Context

README.md 面向使用者、CLAUDE.md 面向開發者，兩份文件都有內容與程式碼不同步的情況。主要是新增功能後沒有同步更新文件，導致環境變數、專案結構、工具描述等資訊缺漏。

## Goals / Non-Goals

**Goals:**
- README.md 補齊使用者需要的環境變數、指令、資料持久化路徑、工具描述
- CLAUDE.md 補齊開發者需要的專案結構、核心類別 API、架構說明
- .env.example 同步補齊缺少的環境變數範例

**Non-Goals:**
- 不重寫文件，僅在現有結構上補充缺漏
- 不涉及程式碼變更
- 不新增或修改功能

## Decisions

### 1. README.md 修改範圍

**環境變數區段**：在現有 `.env` 範例中補上以下變數：
- `CLAUDE_MODEL` — 指定 Claude 模型（預設 `sonnet`，由 CLI 解析為最新 Sonnet）
- `MEMORY_MAX_ITEMS` — 長期記憶上限（預設 100）
- `WEB_UI_PORT` — Web UI 埠號（預設 8099）
- `DEBUG` — 啟用 debug 日誌

**使用方式區段**：補上 `npm run web-ui` 指令說明。

**資料持久化區段**：補上事件訂閱的儲存路徑。

**可用 Tools 區段**：`manage_memory` 補上 search、update 操作。

### 2. CLAUDE.md 修改範圍

**專案結構區段**：補上缺漏的檔案：
- `src/core/claude-agent.ts`
- `src/core/scheduler.ts`
- `src/core/claude-oauth-flow.ts`
- `src/interfaces/web-ui-html.ts`
- `src/utils/tool-schema-converter.ts`

**核心類別區段**：新增以下類別的 API 說明：
- `ClaudeAgent` — agentic loop、tool 呼叫
- `Scheduler` — cron 排程執行

**架構區段**：補充 notification adapter 架構說明，包含 ChannelType 定義和如何新增 adapter。

**工具區段**：補充 `get_history` 的完整參數說明。

### 3. .env.example 修改

同步補齊 README 中列出但 .env.example 缺少的環境變數，讓使用者複製後能看到完整選項。

## Risks / Trade-offs

- **風險**：文件修改後若未來新增功能仍可能再度不同步 → 透過 OpenSpec 流程強制文件同步
- **風險**：補充過多細節可能讓 README 對使用者不夠友善 → 只補必要資訊，技術細節留在 CLAUDE.md
