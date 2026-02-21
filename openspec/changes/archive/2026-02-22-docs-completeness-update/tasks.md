## 1. README.md 更新

- [x] 1.1 在 `.env` 設定區段補上 `CLAUDE_MODEL`、`MEMORY_MAX_ITEMS`、`WEB_UI_PORT`、`DEBUG` 環境變數及說明
- [x] 1.2 在使用方式或相關區段補上 `npm run web-ui` 指令
- [x] 1.3 在資料持久化區段補上事件訂閱儲存路徑
- [x] 1.4 在可用 Tools 區段更新 `manage_memory` 描述，補上 search 和 update 操作

## 2. CLAUDE.md 更新

- [x] 2.1 在專案結構區段補上 `claude-agent.ts`、`scheduler.ts`、`claude-oauth-flow.ts`、`web-ui-html.ts`、`tool-schema-converter.ts`
- [x] 2.2 新增 ClaudeAgent 核心類別 API 說明（chat、query、clearHistory、setSystemPrompt 等）
- [x] 2.3 新增 Scheduler 核心類別 API 說明（addJob、removeJob、startAll、stopAll 等）
- [x] 2.4 新增 notification adapter 架構說明（ChannelType 定義、NotificationManager、新增 adapter 方式）
- [x] 2.5 補充 get_history tool 的完整參數說明
- [x] 2.6 新增 tool-schema-converter 工具說明

## 3. .env.example 更新

- [x] 3.1 補上 `CLAUDE_MODEL`、`CLAUDE_TIMEOUT_MS`、`MEMORY_MAX_ITEMS`、`WEB_UI_PORT`、`DEBUG`、`CONVERSATION_*` 等環境變數
