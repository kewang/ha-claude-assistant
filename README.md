# HA Claude Assistant

Claude AI 驅動的智慧家庭助理，整合 Home Assistant。

## 功能

- 🗣️ **自然語言控制** - 用中文自然語言控制 Home Assistant 設備
- 🔌 **多種介面** - CLI、MCP Server（Claude Code）、Slack Bot
- ⏰ **排程任務** - 定時執行指令並主動通知
- 🏠 **完整 HA 整合** - 支援燈光、開關、感測器、空調等設備

## 快速開始

### 1. 安裝

```bash
cd ~/git/ha-claude-assistant
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env` 檔案：

```env
# Home Assistant 設定
HA_URL=http://your-ha-ip:8123
HA_TOKEN=your_long_lived_access_token

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Slack（選用）
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_DEFAULT_CHANNEL=C0123456789
```

### 3. 建置

```bash
npm run build
```

### 4. 測試 Home Assistant 連線

```bash
npm run test:ha
```

## 使用方式

### CLI 互動模式

```bash
npm run cli
```

或直接執行指令：

```bash
npm run cli "列出所有燈具"
npm run cli "把客廳的燈打開"
```

### MCP Server（Claude Code 整合）

1. 編輯 Claude Code 設定檔 `~/.claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "ha-assistant": {
      "command": "node",
      "args": ["/home/你的帳號/git/ha-claude-assistant/dist/interfaces/mcp-server.js"],
      "env": {
        "HA_URL": "http://your-ha-ip:8123",
        "HA_TOKEN": "your_token"
      }
    }
  }
}
```

2. 重啟 Claude Code

3. 在 Claude Code 中使用：
   - "列出家中所有燈具"
   - "把臥室的燈關掉"
   - "現在室內溫度幾度？"

### Slack Bot

```bash
npm run slack
```

在 Slack 中：
- 私訊 Bot：直接對話
- 在頻道中 @mention：`@HA助理 把燈關掉`
- 使用指令：`/ha 列出所有燈具`
- 排程指令：`/ha-schedule list`

## 專案結構

```
ha-claude-assistant/
├── src/
│   ├── core/
│   │   ├── ha-client.ts      # Home Assistant API 封裝
│   │   ├── claude-agent.ts   # Claude AI Agent
│   │   └── scheduler.ts      # 排程器
│   ├── interfaces/
│   │   ├── mcp-server.ts     # MCP Server
│   │   ├── cli.ts            # CLI 介面
│   │   └── slack-bot.ts      # Slack Bot
│   ├── tools/                # Claude tools 定義
│   │   ├── list-entities.ts
│   │   ├── get-states.ts
│   │   ├── call-service.ts
│   │   └── index.ts
│   └── index.ts
├── tests/                    # 測試檔案
├── config/
│   └── default.json          # 預設設定
├── .env.example              # 環境變數範例
└── package.json
```

## 可用 Tools

### list_entities
列出 Home Assistant 中的實體，可依 domain 或關鍵字過濾。

### get_state
取得單一實體的詳細狀態和屬性。

### call_service
呼叫 HA 服務控制設備（開關燈、調溫度等）。

## 開發

```bash
# 開發模式（自動重新編譯）
npm run dev

# 執行測試
npm test

# 執行測試（監看模式）
npm test -- --watch
```

## 取得 Home Assistant Token

1. 登入 Home Assistant
2. 點擊左下角個人頭像
3. 往下捲到「Long-lived access tokens」
4. 點擊「CREATE TOKEN」
5. 輸入名稱（如 "Claude Assistant"）
6. 複製產生的 token

## 建立 Slack App

1. 前往 https://api.slack.com/apps
2. 建立新 App（From scratch）
3. 啟用 Socket Mode（Settings > Socket Mode）
4. 建立 App-Level Token（xapp-）
5. 設定 Bot Token Scopes：
   - `app_mentions:read`
   - `chat:write`
   - `commands`
   - `im:history`
   - `im:read`
   - `im:write`
6. 建立 Slash Commands：
   - `/ha` - 智慧家庭控制
   - `/ha-schedule` - 排程管理
7. 安裝到 Workspace
8. 複製 Bot Token（xoxb-）和 App Token（xapp-）

## License

MIT
