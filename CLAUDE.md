# CLAUDE.md - 專案開發指引

## 專案概述

這是一個 Claude AI 驅動的智慧家庭助理，整合 Home Assistant。使用 TypeScript + ESM 開發。

## 技術棧

- **Runtime**: Node.js 20+
- **Language**: TypeScript (ESM)
- **AI**: @anthropic-ai/sdk (Claude API with tool-use)
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
```

## 專案結構

```
src/
├── core/
│   ├── ha-client.ts      # Home Assistant REST API 封裝
│   ├── claude-agent.ts   # Claude AI Agent（tool-use 迴圈）
│   └── scheduler.ts      # Cron 排程器
├── interfaces/
│   ├── cli.ts            # CLI 互動介面
│   ├── mcp-server.ts     # MCP Server（stdio）
│   └── slack-bot.ts      # Slack Bot（Socket Mode）
├── tools/                # Claude tools 定義
│   ├── list-entities.ts  # 列出實體
│   ├── get-states.ts     # 取得狀態
│   ├── call-service.ts   # 呼叫服務
│   └── index.ts          # Tools 匯出
├── index.ts              # 主程式進入點
└── test-ha.ts            # HA 連線測試腳本

tests/                    # Vitest 測試
config/default.json       # 預設設定
```

## 環境變數

必要的環境變數在 `.env`（從 `.env.example` 複製）：

```
HA_URL=http://homeassistant.local:8123
HA_URL_EXTERNAL=https://your-ha.duckdns.org:8123  # 選用，外網 URL
HA_TOKEN=<長期存取權杖>
ANTHROPIC_API_KEY=<Anthropic API Key>

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

### ClaudeAgent (claude-agent.ts)
- `chat(message)` - 對話（保留歷史）
- `query(message)` - 單次查詢（不保留歷史）
- `clearHistory()` - 清除對話歷史

### Scheduler (scheduler.ts)
- `addJob(job)` - 新增排程
- `removeJob(id)` - 移除排程
- `executeJob(id)` - 立即執行
- `addNotificationHandler(fn)` - 註冊通知回調

## Claude Tools

三個主要工具供 Claude 使用：

1. **list_entities** - 列出實體，可用 `domain` 或 `search` 過濾
2. **get_state** - 取得實體詳細狀態，需要 `entity_id`
3. **call_service** - 呼叫 HA 服務，需要 `domain` + `service`

## 新增功能指引

### 新增 Claude Tool

1. 在 `src/tools/` 建立新檔案
2. 定義 `Tool` 物件（name, description, input_schema）
3. 實作 `execute*` 函數
4. 在 `src/tools/index.ts` 匯出並加入 `haTools` 陣列和 `executeTool` switch

### 新增排程任務

在 `slack-bot.ts` 的 `loadDefaultSchedules()` 中加入，或透過程式碼：

```typescript
scheduler.addJob({
  id: 'my-job',
  name: '我的任務',
  cronExpression: '0 8 * * *', // 每天早上 8 點
  prompt: '請告訴我今天的天氣',
  enabled: true,
});
```

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

## 注意事項

- 修改 TypeScript 後需要 `npm run build` 重新編譯
- MCP Server 使用 stdio 通訊，不要在裡面用 console.log（用 console.error）
- Slack Bot 使用 Socket Mode，不需要公開 endpoint
- 排程使用 Asia/Taipei 時區
