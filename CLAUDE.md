# CLAUDE.md - 專案開發指引

## 專案概述

這是一個 Claude AI 驅動的智慧家庭助理，整合 Home Assistant。使用 TypeScript + ESM 開發。

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
│   └── env-detect.ts     # 環境偵測（Add-on / 一般環境）
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
# 執行所有測試
npm test

# 執行單一測試檔
npm test -- tests/ha-client.test.ts

# 監看模式
npm test -- --watch
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

## 注意事項

- 修改 TypeScript 後需要 `npm run build` 重新編譯
- MCP Server 使用 stdio 通訊，不要在裡面用 console.log（用 console.error）
- Slack Bot 使用 Socket Mode，不需要公開 endpoint
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
