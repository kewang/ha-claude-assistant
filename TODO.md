# 接下來的開發任務

## ✅ 已完成：環境設定與驗證

### ✅ 1. 設定環境變數
已完成 `.env` 設定。

### ✅ 2. 測試 Home Assistant 連線
`npm run test:ha` 測試通過。

### ✅ 3. 測試 CLI 互動
`npm run cli` 測試通過，可正常控制燈具。

### ✅ 4. 測試 MCP Server（整合 Claude Code）
使用 `claude mcp add` 設定完成：
```bash
claude mcp add --transport stdio ha-assistant \
  --env HA_URL=http://homeassistant.local:8123 \
  --env HA_TOKEN=<your-token> \
  -- node /home/kewang/git/ha-claude-assistant/dist/interfaces/mcp-server.js
```
測試通過，可在 Claude Code 中控制 Home Assistant。

---

## ✅ 已完成：Slack Bot 設定

### ✅ 5. 建立 Slack App
已完成 Slack App 建立，包含：
- Socket Mode 啟用
- Bot Token Scopes 設定
- Event Subscriptions（app_mention, message.im）
- Slash Commands：`/ha`, `/ha-schedule`
- App Home > Messages Tab 啟用

### ✅ 6. 設定 Slack 環境變數
已在 `.env` 設定 `SLACK_BOT_TOKEN` 和 `SLACK_APP_TOKEN`。

### ✅ 7. 測試 Slack Bot
`npm run slack` 啟動成功，以下功能測試通過：
- DM 私訊對話
- @mention 在頻道中呼叫
- `/ha` Slash 指令

---

## ✅ 已完成：內網/外網自動切換

### ✅ 8. 內網/外網 URL 自動偵測
新增 `HA_URL_EXTERNAL` 環境變數支援：
- 啟動時自動偵測連線，優先使用內網
- 內網失敗時自動切換到外網
- CLI、Slack Bot、MCP Server 都支援此功能
- `/ha status` 指令顯示目前連線類型

---

## 後續開發建議

### 功能增強
- [ ] 新增更多 Claude tools（場景控制、自動化觸發等）
- [ ] 支援更複雜的自然語言（「把所有燈關掉」批次操作）
- [ ] 加入對話記憶持久化（目前重啟就會清除）

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
