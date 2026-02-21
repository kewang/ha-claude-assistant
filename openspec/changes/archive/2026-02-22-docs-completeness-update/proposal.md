## Why

README.md 和 CLAUDE.md 的內容與實際程式碼有多處不一致。README 缺少使用者需要的環境變數、指令和功能描述；CLAUDE.md 缺少開發者需要的專案結構、核心類別和架構細節。兩份文件應各自針對目標讀者（使用者 vs 開發者）補齊缺漏。

## What Changes

### README.md（使用者面向）
- 補齊 `.env` 設定區段缺少的環境變數：`CLAUDE_MODEL`、`MEMORY_MAX_ITEMS`、`WEB_UI_PORT`、`DEBUG`
- 補上 `.env.example` 也缺少的環境變數（`CLAUDE_TIMEOUT_MS`、`CONVERSATION_*` 等在 README 有但 .env.example 沒有）
- 使用方式補上 `npm run web-ui` 指令
- 資料持久化區段補上事件訂閱路徑 `/data/event-subscriptions/event-subscriptions.json`
- 可用 Tools 的 `manage_memory` 補上 `search` 和 `update` 操作描述

### CLAUDE.md（開發者面向）
- 專案結構補上缺漏的檔案：`claude-agent.ts`、`scheduler.ts`、`claude-oauth-flow.ts`、`web-ui-html.ts`、`tool-schema-converter.ts`
- 補充 notification adapter 架構說明（ChannelType 定義、如何新增 adapter）
- 補充 ClaudeAgent、Scheduler 核心類別的 API 說明
- 補充 tool-schema-converter 用途說明
- 補充 get_history tool 完整參數說明

### .env.example
- 同步補齊缺少的環境變數（`CLAUDE_MODEL`、`CLAUDE_TIMEOUT_MS`、`MEMORY_MAX_ITEMS`、`WEB_UI_PORT`、`DEBUG`、`CONVERSATION_*`）

## Capabilities

### New Capabilities

（無新增 capability，此變更僅修改文件內容）

### Modified Capabilities

（此變更不涉及程式碼或 spec 層級的行為變更，僅為文件同步更新）

## Impact

- 影響檔案：`README.md`、`CLAUDE.md`、`.env.example`
- 無程式碼變更、無 API 變更、無依賴變更
- 純文件修正，不影響系統行為
