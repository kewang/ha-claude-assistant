# 接下來的開發任務

## 優先：環境設定與驗證

### 1. 設定環境變數
```bash
cp .env.example .env
```

編輯 `.env` 填入：
- `HA_URL` - Home Assistant 的 URL（如 `http://192.168.1.100:8123`）
- `HA_TOKEN` - HA 長期存取權杖（在 HA 個人設定頁面建立）
- `ANTHROPIC_API_KEY` - Anthropic API Key

### 2. 測試 Home Assistant 連線
```bash
npm run test:ha
```
確認能成功連線並列出實體。

### 3. 測試 CLI 互動
```bash
npm run cli
```
測試指令：
- 「列出所有燈具」
- 「客廳燈的狀態」
- 「把某個燈打開」（用實際存在的 entity_id）

### 4. 測試 MCP Server（整合 Claude Code）

編輯 `~/.claude/claude_desktop_config.json`，加入：
```json
{
  "mcpServers": {
    "ha-assistant": {
      "command": "node",
      "args": ["/home/kewang/git/ha-claude-assistant/dist/interfaces/mcp-server.js"],
      "env": {
        "HA_URL": "你的 HA URL",
        "HA_TOKEN": "你的 HA Token"
      }
    }
  }
}
```

重啟 Claude Code 後測試：
- 在 Claude Code 問「列出家裡的燈具」
- 測試控制設備

---

## 選用：Slack Bot 設定

### 5. 建立 Slack App
1. 到 https://api.slack.com/apps 建立 App
2. 啟用 Socket Mode
3. 設定 Bot Token Scopes: `app_mentions:read`, `chat:write`, `commands`, `im:history`, `im:read`, `im:write`
4. 建立 Slash Commands: `/ha`, `/ha-schedule`
5. 安裝到 Workspace

### 6. 設定 Slack 環境變數
在 `.env` 加入：
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_DEFAULT_CHANNEL=C...  # 用於排程通知的頻道
```

### 7. 啟動 Slack Bot
```bash
npm run slack
```

---

## 後續開發建議

### 功能增強
- [ ] 新增更多 Claude tools（場景控制、自動化觸發等）
- [ ] 支援更複雜的自然語言（「把所有燈關掉」批次操作）
- [ ] 加入對話記憶持久化（目前重啟就會清除）

### Phase 5: WhatsApp 整合
- [ ] 評估 Twilio vs Meta Cloud API
- [ ] 實作 WhatsApp 介面（需要 webhook endpoint）

### 監控與日誌
- [ ] 加入結構化日誌（pino 或 winston）
- [ ] 錯誤追蹤與告警

### 部署
- [ ] 建立 Dockerfile
- [ ] systemd service 設定（常駐執行）
- [ ] PM2 設定

---

## 快速參考

```bash
# 重新建置
npm run build

# 執行測試
npm test

# 啟動各介面
npm run cli      # CLI
npm run mcp      # MCP Server
npm run slack    # Slack Bot
```
