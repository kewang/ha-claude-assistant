### Requirement: README 環境變數完整性

README.md 的環境變數設定區段 SHALL 包含所有程式碼中實際使用的可設定環境變數，包含說明和預設值。

#### Scenario: 使用者查閱環境變數設定
- **WHEN** 使用者閱讀 README.md 的 `.env` 設定區段
- **THEN** 能看到 `CLAUDE_MODEL`、`MEMORY_MAX_ITEMS`、`WEB_UI_PORT`、`DEBUG` 等所有可設定的環境變數及其預設值

### Requirement: README 資料持久化完整性

README.md 的資料持久化區段 SHALL 列出所有持久化資料的儲存路徑，包含事件訂閱。

#### Scenario: 使用者查閱資料持久化路徑
- **WHEN** 使用者閱讀 README.md 的資料持久化區段
- **THEN** 能看到事件訂閱的儲存路徑 `/data/event-subscriptions/event-subscriptions.json`

### Requirement: README 工具描述完整性

README.md 的可用 Tools 區段中，每個 tool 的描述 SHALL 包含所有支援的操作。

#### Scenario: 使用者查閱 manage_memory 工具
- **WHEN** 使用者閱讀 README.md 的 manage_memory 工具描述
- **THEN** 能看到 save、list、search、update、delete 五種操作

### Requirement: README 指令完整性

README.md SHALL 列出所有可用的 npm 指令。

#### Scenario: 使用者查閱可用指令
- **WHEN** 使用者閱讀 README.md
- **THEN** 能看到 `npm run web-ui` 指令及其說明

### Requirement: CLAUDE.md 專案結構完整性

CLAUDE.md 的專案結構 SHALL 列出 `src/` 下所有實際存在的 TypeScript 檔案。

#### Scenario: 開發者查閱專案結構
- **WHEN** 開發者閱讀 CLAUDE.md 的專案結構
- **THEN** 能看到 `claude-agent.ts`、`scheduler.ts`、`claude-oauth-flow.ts`、`web-ui-html.ts`、`tool-schema-converter.ts` 等檔案

### Requirement: CLAUDE.md 核心類別完整性

CLAUDE.md SHALL 包含所有核心類別的 API 說明，包含 ClaudeAgent 和 Scheduler。

#### Scenario: 開發者查閱 ClaudeAgent 類別
- **WHEN** 開發者閱讀 CLAUDE.md 的核心類別區段
- **THEN** 能看到 ClaudeAgent 的方法：`chat()`、`query()`、`clearHistory()`、`setSystemPrompt()` 等

#### Scenario: 開發者查閱 Scheduler 類別
- **WHEN** 開發者閱讀 CLAUDE.md 的核心類別區段
- **THEN** 能看到 Scheduler 的方法：`addJob()`、`removeJob()`、`startAll()`、`stopAll()` 等

### Requirement: CLAUDE.md 通知架構說明

CLAUDE.md SHALL 說明 notification adapter 架構，包含支援的通道類型和擴展方式。

#### Scenario: 開發者查閱通知架構
- **WHEN** 開發者閱讀 CLAUDE.md
- **THEN** 能看到 ChannelType（slack、telegram、discord、line）定義和新增 adapter 的方式

### Requirement: .env.example 同步完整性

.env.example SHALL 包含所有可設定的環境變數，與 README.md 保持一致。

#### Scenario: 使用者從 .env.example 複製設定
- **WHEN** 使用者執行 `cp .env.example .env`
- **THEN** .env 檔案包含所有可設定的環境變數（含註解說明和預設值）
