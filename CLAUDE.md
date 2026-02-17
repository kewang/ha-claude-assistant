# CLAUDE.md - 專案開發指引

## 專案概述

這是一個 Claude AI 驅動的智慧家庭助理，整合 Home Assistant。使用 TypeScript + ESM 開發。

## 開發流程

所有功能開發、修改、Bug 修復都必須走 OpenSpec 流程。請使用以下 skill 進行操作：

- `/opsx:new` - 開始新的變更
- `/opsx:continue` - 繼續產生下一個 artifact
- `/opsx:ff` - 快速產生所有 artifact
- `/opsx:apply` - 實作變更
- `/opsx:verify` - 驗證實作是否符合 artifact
- `/opsx:archive` - 歸檔已完成的變更

**不要直接修改程式碼，一律先建立 OpenSpec change 再進行實作。**

## 技術棧

- **Runtime**: Node.js 20+
- **Language**: TypeScript (ESM)
- **AI**: Claude CLI (`claude --print`)
- **MCP**: @modelcontextprotocol/sdk
- **Slack**: @slack/bolt (Socket Mode)
- **Scheduler**: node-cron
- **Test**: vitest

## 常用指令

```bash
# 建置
npm run build

# 開發模式（監看編譯）
npm run dev

# 執行測試
npm test

# 測試 HA 連線
npm run test:ha

# 啟動各介面
npm run cli          # CLI 互動模式
npm run mcp          # MCP Server（給 Claude Code）
npm run slack        # Slack Bot
npm run scheduler    # 排程服務（背景執行）
```

## 專案結構

```
src/
├── core/
│   ├── ha-client.ts      # Home Assistant REST API 封裝
│   ├── schedule-store.ts # 排程持久化儲存
│   ├── conversation-store.ts # 對話記憶持久化
│   ├── env-detect.ts     # 環境偵測（Add-on / 一般環境）
│   ├── claude-token-refresh.ts # OAuth Token 自動刷新
│   └── claude-oauth-config.ts  # OAuth 設定動態提取
├── interfaces/
│   ├── cli.ts            # CLI 互動介面（使用 Claude CLI）
│   ├── mcp-server.ts     # MCP Server（stdio）
│   ├── slack-bot.ts      # Slack Bot（使用 Claude CLI）
│   └── scheduler-daemon.ts # 排程服務（使用 Claude CLI）
├── tools/                # MCP Tools 定義
│   ├── list-entities.ts  # 列出實體
│   ├── get-states.ts     # 取得狀態
│   ├── call-service.ts   # 呼叫服務
│   ├── manage-schedule.ts # 管理排程
│   └── index.ts          # Tools 匯出
├── utils/
│   └── logger.ts         # 統一 Logger（含時間戳記）
├── index.ts              # 主程式進入點
└── test-ha.ts            # HA 連線測試腳本

data/
└── schedules.json        # 排程設定檔

repository.yaml           # Home Assistant Add-on 倉庫設定
claude-ha-assistant/      # Home Assistant Add-on
├── config.yaml           # Add-on 設定
├── build.yaml            # 建置設定
├── Dockerfile
├── run.sh                # 啟動腳本
├── DOCS.md               # 使用說明
└── translations/
    └── en.yaml

tests/                    # Vitest 測試
config/default.json       # 預設設定
scripts/
└── sync-version.js       # 版號同步腳本
```

## 架構說明

所有介面統一使用 Claude CLI (`claude --print`) 處理使用者請求：

```
CLI / Slack Bot / Scheduler
         ↓
   claude --print --permission-mode bypassPermissions
         ↓
    MCP Server
         ↓
     HAClient
         ↓
  Home Assistant
```

前置需求：
- `claude` CLI 已安裝並登入（`~/.local/bin/claude`）
- MCP Server 已設定在 Claude Code 的 settings

注意事項：
- 使用 `--permission-mode bypassPermissions` 允許 MCP 工具自動執行（在受控環境如 Add-on 中安全）
- ScheduleStore 有 500ms debounce 機制，避免檔案寫入時頻繁觸發 reload

## 環境變數

必要的環境變數在 `.env`（從 `.env.example` 複製）：

```
HA_URL=http://homeassistant.local:8123
HA_URL_EXTERNAL=https://your-ha.duckdns.org:8123  # 選用，外網 URL
HA_TOKEN=<長期存取權杖>

# Slack（選用）
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_DEFAULT_CHANNEL=C...
```

### 內網/外網自動切換

設定 `HA_URL_EXTERNAL` 後，系統會自動偵測：
1. 先嘗試連接內網 `HA_URL`
2. 若連線失敗，自動切換到外網 `HA_URL_EXTERNAL`

這樣在家或外出時都能正常使用。

## 核心類別

### HAClient (ha-client.ts)
- `getStates()` - 取得所有實體
- `getState(entityId)` - 取得單一實體
- `callService(domain, service, data)` - 呼叫服務
- `searchEntities(query)` - 搜尋實體

### ScheduleStore (schedule-store.ts)
- `getAll()` - 取得所有排程
- `create(schedule)` - 建立排程
- `update(id, updates)` - 更新排程
- `delete(id)` - 刪除排程

### ConversationStore (conversation-store.ts)
- `init()` - 初始化（建立目錄、載入資料）
- `getHistory(id)` - 取得對話歷史
- `addExchange(id, userMessage, assistantResponse)` - 新增一輪對話
- `clear(id)` - 清除指定對話
- `cleanup()` - 移除過期對話
- `buildPromptWithHistory(history, newPrompt)` - 將歷史注入 prompt（輔助函式）

對話 key 規則：
- Slack: `slack:${thread_ts || ts}`
- CLI: `cli:session-${timestamp}`
- Scheduler: `schedule:${schedule.id}`

### ClaudeTokenRefreshService (claude-token-refresh.ts)
- `start()` - 啟動定期檢查（每 5 分鐘）
- `stop()` - 停止定期檢查
- `refreshToken()` - 手動刷新 token
- `ensureValidToken()` - 確保 token 有效（執行 Claude CLI 前呼叫）
- `getTokenStatus()` - 取得目前 token 狀態
- `setNotificationCallback()` - 設定通知回呼（用於 Slack 通知）

### getOAuthConfig (claude-oauth-config.ts)

動態取得 Claude OAuth 設定（CLIENT_ID 和 TOKEN_URL）。

優先順序：
1. **從 Claude CLI binary 提取** - 使用 `strings` 命令搜尋，自動與 CLI 版本同步
2. **Fallback** - 提取失敗時使用預設值

```typescript
import { getOAuthConfig } from './core/claude-oauth-config.js';

const config = getOAuthConfig();
// config.tokenUrl  - OAuth token endpoint
// config.clientId  - OAuth client ID
// config.source    - 'binary' | 'fallback'
```

### Logger (utils/logger.ts)

統一的 log 工具，為所有輸出加入時間戳記，方便 debug 追蹤。

```typescript
import { createLogger } from './utils/logger.js';

const logger = createLogger('MyModule');

logger.info('Starting...');        // [2026-02-04 10:30:15] [MyModule] Starting...
logger.error('Failed:', error);    // [2026-02-04 10:30:15] [MyModule] Failed: ...
logger.warn('Warning message');    // [2026-02-04 10:30:15] [MyModule] Warning message
logger.debug('Debug info');        // 僅在 DEBUG 環境變數啟用時輸出
logger.raw('User message');        // User message（無時間戳，給 user-facing 輸出用）
```

MCP Server 需使用 stderr（stdout 保留給 MCP 協議）：
```typescript
const logger = createLogger('MCP', { useStderr: true });
```

## Claude Tools

四個主要工具供 Claude 使用：

1. **list_entities** - 列出實體，可用 `domain` 或 `search` 過濾
2. **get_state** - 取得實體詳細狀態，需要 `entity_id`
3. **call_service** - 呼叫 HA 服務，需要 `domain` + `service`
4. **manage_schedule** - 管理排程任務，支援 `create`、`list`、`enable`、`disable`、`delete` 操作

## 新增功能指引

### 新增 Claude Tool

1. 在 `src/tools/` 建立新檔案
2. 定義 `Tool` 物件（name, description, input_schema）
3. 實作 `execute*` 函數
4. 在 `src/tools/index.ts` 匯出並加入 `haTools` 陣列和 `executeTool` switch

### 新增排程任務

**方法一：透過 Claude Code（推薦）**

直接用自然語言告訴 Claude：
- 「幫我每天晚上七點報告家裡溫濕度」
- 「列出所有排程」
- 「把溫濕度報告停用」
- 「刪除早晨安全檢查排程」

Claude 會自動呼叫 `manage_schedule` tool 來管理排程。

**方法二：透過程式碼**

```typescript
import { ScheduleStore } from './core/schedule-store.js';

const store = new ScheduleStore();
await store.init();

await store.create({
  name: '溫濕度報告',
  cronExpression: '0 19 * * *', // 每天晚上 7 點
  prompt: '報告目前家裡的溫度和濕度',
  enabled: true,
});
```

**常用 Cron 表達式：**
- `0 7 * * *` - 每天早上 7 點
- `0 19 * * *` - 每天晚上 7 點
- `0 8 * * 1-5` - 週一到週五早上 8 點
- `*/30 * * * *` - 每 30 分鐘
- `0 */2 * * *` - 每 2 小時

## 測試

```bash
# 執行所有測試（自動執行並退出）
npm test

# 監看模式（檔案變更時自動重跑）
npm run test:watch

# 執行單一測試檔
npm test -- tests/ha-client.test.ts
```

## MCP 設定

Claude Code 設定檔 `~/.claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "ha-assistant": {
      "command": "node",
      "args": ["/home/kewang/git/ha-claude-assistant/dist/interfaces/mcp-server.js"],
      "env": {
        "HA_URL": "http://your-ha:8123",
        "HA_TOKEN": "your-token"
      }
    }
  }
}
```

## 排程服務

排程服務 (`scheduler-daemon`) 是獨立的背景程序，負責執行排程任務。

### 啟動方式

```bash
# 直接執行
npm run scheduler

# 使用 PM2 持續運行
pm2 start dist/interfaces/scheduler-daemon.js --name ha-scheduler
```

### 運作流程

1. 使用者透過 Claude Code：「幫我每天晚上七點報告溫濕度」
2. Claude 呼叫 `manage_schedule` tool，寫入 `data/schedules.json`
3. 排程服務偵測到檔案變更，重新載入排程
4. 晚上 7 點時執行：`claude --print "報告溫濕度"`
5. 將結果發送到 Slack

### 前置需求

- `claude` CLI 已安裝並登入
- 設定 `SLACK_BOT_TOKEN` 和 `SLACK_DEFAULT_CHANNEL`（用於發送通知）

## Claude CLI Credentials 格式

Web UI OAuth 登入後儲存的 `.credentials.json` 必須與 CLI 產生的格式完全一致，否則 CLI 會報 "Invalid API key"。

### 正確格式（CLI v2.1.31）

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1770457548204,
    "scopes": ["user:inference", "user:mcp_servers", "user:profile", "user:sessions:claude_code"],
    "subscriptionType": "max",
    "rateLimitTier": "default_claude_max_5x"
  }
}
```

### 格式重點

| 欄位 | 正確 | 常見錯誤 |
|------|------|----------|
| `expiresAt` | Unix timestamp ms **數字** `1770457548204` | ISO 字串 `"2026-02-07T..."` |
| `scopes` | **字串陣列** `["user:inference", ...]` | 空格分隔字串，或 key 用 `scope` |
| `organization`/`account` | **不存** | Token response 有回傳但 CLI 不需要 |
| `subscriptionType`/`rateLimitTier` | CLI login 才有 | Web UI 登入時缺少（不影響功能） |

### OAuth 注意事項

- Token exchange 和 refresh 都用 **`application/json`**（不是 form-urlencoded）
- Callback page 的 code 格式是 `code#state`，需移除 `#` 後面的部分
- `api.anthropic.com` **不支援 OAuth token**，CLI 使用不同的 internal endpoint
- Add-on 中 Web UI 以 root 寫入 credentials，需 `chown claude:claude` 讓 claude-run 可讀

## Token 自動刷新機制

Claude CLI 的 OAuth token 會定期過期：
- **Access token**: 約 8-12 小時過期
- **Refresh token**: 約 7-30 天過期

系統會自動維護 token 有效性，減少手動介入。

### 運作方式

1. **定期檢查**：每 5 分鐘檢查 token 狀態
2. **提前刷新**：在 access token 過期前 30 分鐘自動刷新
3. **執行前檢查**：Slack Bot 和 Scheduler 在執行 Claude CLI 前會確保 token 有效
4. **執行時重試**：Scheduler 偵測到 token 過期錯誤時，會自動刷新並重試一次
5. **失敗通知**：refresh token 過期時發送 Slack 通知

### Scheduler Token 重試機制

排程服務在執行任務時會處理 token 過期問題：

```
排程觸發
    ↓
ensureValidToken() ─ 執行前檢查
    ├─ needsRelogin=true → 發送失敗通知 → 結束
    ↓
執行 Claude CLI
    ├─ 成功 → 發送成功通知 → 結束
    ↓
    └─ 失敗
         ├─ 不是 token 問題 → 發送失敗通知 → 結束
         ↓
         └─ 是 token 問題（401/authentication_error）
              ↓
         refreshToken() → 重試執行
              ├─ 成功 → 發送成功通知 → 結束
              └─ 失敗 → 發送失敗通知 → 結束
```

這個機制確保：
- Token 過期時不會立即發送失敗通知
- 自動嘗試刷新並重試，減少不必要的錯誤通知
- 只在最終確定失敗時才通知用戶

### 用戶體驗

1. **首次設定**：進入容器執行 `claude login`（僅此一次）
2. **日常使用**：系統自動維護 token，用戶無需介入
3. **Refresh token 過期時**：收到 Slack 通知，需重新登入（約 7-30 天一次）

### 手動重新登入

當收到 token 過期通知時：

```bash
# 進入容器
docker exec -it $(docker ps -qf name=claude_ha_assistant) bash

# 重新登入
su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login
```

## Slack Bot 自動重連機制

Slack Bot 使用 Socket Mode 連線，可能因網路問題或 Slack 伺服器斷線而中斷。系統內建自動重連機制來處理這些情況。

### 重連參數

```typescript
const MAX_RECONNECT_ATTEMPTS = 10;        // 最大重連次數
const INITIAL_RECONNECT_DELAY_MS = 1000;  // 初始延遲 1 秒
const MAX_RECONNECT_DELAY_MS = 60000;     // 最大延遲 60 秒
```

### 運作方式

1. **事件監聽**：監聽 SocketModeClient 的 `connected`、`disconnected`、`error` 事件
2. **指數退避**：重連延遲從 1 秒開始，每次翻倍（1s → 2s → 4s → 8s → ... → 60s）
3. **次數限制**：超過 10 次重連失敗後放棄，並發送 Slack 通知
4. **狀態機錯誤處理**：捕捉 `@slack/socket-mode` 套件的狀態機異常，防止程序崩潰

### 狀態機錯誤

`@slack/socket-mode` 套件有已知的狀態機缺陷，在某些情況下會拋出：
```
Error: Unhandled event 'server explicit disconnect' in state 'connecting'.
```

系統會在 process level 捕捉這類錯誤並記錄，而不會導致程序崩潰。

## 版號管理

專案使用單一來源版號管理，`package.json` 為主要版本來源，其他檔案自動同步。

### 同步的檔案

| 檔案 | 用途 |
|------|------|
| `package.json` | Node.js 專案版本（主要來源） |
| `claude-ha-assistant/config.yaml` | HA Add-on 版本 |

### 更新版本

使用 `npm version` 指令更新版本，會自動同步所有檔案：

```bash
# 更新 patch 版本 (1.1.4 → 1.1.5)
npm version patch

# 更新 minor 版本 (1.1.4 → 1.2.0)
npm version minor

# 更新 major 版本 (1.1.4 → 2.0.0)
npm version major

# 指定版本
npm version 1.2.0
```

執行 `npm version` 會自動：
1. 更新 `package.json` 版本
2. 執行同步腳本，更新 `config.yaml`
3. 建立 git commit
4. 建立 git tag (v1.x.x)

### 手動同步

若需要手動同步版號（不建立 commit/tag）：

```bash
node scripts/sync-version.js
```

## 注意事項

- 修改 TypeScript 後需要 `npm run build` 重新編譯
- 所有 log 輸出請使用 `createLogger()` 建立的 logger，確保有時間戳記
- MCP Server 使用 stdio 通訊，logger 需設定 `{ useStderr: true }`
- Slack Bot 使用 Socket Mode，不需要公開 endpoint，內建自動重連機制
- 排程使用 Asia/Taipei 時區
- 排程服務需要 `claude` CLI 可用且已登入

## Home Assistant Add-on

專案支援作為 Home Assistant Add-on 安裝，提供更簡便的部署方式。

### Add-on 架構

```
HA Add-on 容器
├── Claude CLI（預先安裝，需手動登入）
├── claude-run（wrapper，以非 root 用戶執行 claude）
├── MCP Server（stdio，給 Claude CLI 用）
├── Slack Bot（主程式）
├── Scheduler（背景程式）
└── HAClient → http://supervisor/core（Supervisor API）
```

### 非 Root 執行

Claude CLI 的 `--permission-mode bypassPermissions` 不允許在 root 下執行。因此 Add-on 使用 `su-exec` 以 `claude` 用戶身份執行 Claude CLI：

```bash
# claude-run wrapper 等同於：
su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude "$@"
```

### 環境偵測

程式會自動偵測執行環境：

- **Add-on 環境**：偵測到 `SUPERVISOR_TOKEN` 環境變數
  - 使用 `http://supervisor/core` 作為 HA API
  - 排程資料存在 `/data/schedules/schedules.json`
  - Claude 設定存在 `/data/claude/`

- **一般環境**：使用傳統的 `HA_URL` 和 `HA_TOKEN`

### 相關環境變數

| 變數 | Add-on 環境 | 一般環境 |
|------|------------|---------|
| `SUPERVISOR_TOKEN` | 自動提供 | - |
| `SCHEDULE_DATA_PATH` | `/data/schedules/schedules.json` | `data/schedules.json` |
| `CLAUDE_PATH` | `/usr/local/bin/claude-run` | `~/.local/bin/claude` |
| `CLAUDE_CONFIG_DIR` | `/data/claude` | - |
| `CONVERSATION_MAX_TURNS` | 20（預設） | 20（預設） |
| `CONVERSATION_MAX_CHARS` | 8000（預設） | 8000（預設） |
| `CONVERSATION_MAX_AGE_DAYS` | 7（預設） | 7（預設） |

### Add-on 安裝

詳見 `claude-ha-assistant/DOCS.md`。

### Add-on 開發

```bash
# 建置專案
npm run addon:build

# 本地 Docker 測試
npm run addon:docker
docker run -it claude-ha-assistant
```
