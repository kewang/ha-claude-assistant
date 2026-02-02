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
- Slash Commands：`/ha`
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

## ✅ 已完成：排程管理功能

### ✅ 9. manage_schedule Tool
新增 `manage_schedule` tool，支援：
- `create` - 建立排程
- `list` - 列出所有排程
- `enable` / `disable` - 啟用/停用排程
- `delete` - 刪除排程

可透過自然語言管理排程，例如：
- 「幫我每天早上八點報告溫濕度」
- 「列出所有排程」
- 「把溫濕度報告停用」

### ✅ 10. 獨立排程服務 (scheduler-daemon)
- 背景執行排程任務
- 監控 `data/schedules.json` 自動重載（含 debounce 機制）
- 執行時呼叫 `claude --print` 處理 prompt
- 結果發送到 Slack 通知

啟動方式：
```bash
npm run scheduler          # 前景執行
nohup npm run scheduler &  # 背景執行
pm2 start dist/interfaces/scheduler-daemon.js --name ha-scheduler  # PM2
```

### ✅ 11. Slack Bot / Scheduler 穩定性改進
- 使用 `--permission-mode acceptEdits` 允許 MCP 工具寫入檔案
- 加入工作目錄設定確保 Claude CLI 正確執行
- ScheduleStore 加入 JSON 解析錯誤處理，避免寫入中途崩潰
- ScheduleStore 加入 500ms debounce，避免頻繁觸發 reload
- 改善 timeout 診斷日誌

---

## ✅ 已完成：統一 Claude CLI 架構

### ✅ 12. 所有介面改用 Claude CLI
將所有介面統一改用 `claude --print` 呼叫，不再直接使用 Anthropic API：

- **CLI** (`cli.ts`) - 改用 Claude CLI
- **Slack Bot** (`slack-bot.ts`) - 改用 Claude CLI
- **Scheduler** (`scheduler-daemon.ts`) - 已使用 Claude CLI

架構變更：
```
Before: 介面 → ClaudeAgent → Anthropic API → haTools
After:  介面 → claude CLI → MCP Server → HAClient
```

好處：
- 統一架構，維護更簡單
- 不再需要 `ANTHROPIC_API_KEY` 環境變數
- Claude CLI 自動處理 MCP Server 連線

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
- [x] 建立 Dockerfile
- [x] Home Assistant Add-on 支援
- [ ] systemd service 設定（常駐執行）
- [x] PM2 設定（scheduler-daemon 可用 PM2 管理）

---

## ✅ 已完成：Home Assistant Add-on

### ✅ 13. Add-on 支援
將專案封裝為 Home Assistant Add-on，方便其他用戶安裝：

- **環境偵測** (`env-detect.ts`) - 自動判斷 Add-on 或一般環境
- **Supervisor API 支援** - Add-on 環境自動使用 `http://supervisor/core`
- **資料持久化** - 排程和 Claude 登入狀態存於 `/data/`
- **Add-on 設定檔** - `ha-addon/` 目錄包含完整 Add-on 結構

Add-on 架構：
```
HA Add-on 容器
├── Claude CLI（用戶手動安裝並登入）
├── Slack Bot（主程式）
├── Scheduler（背景程式）
└── HAClient → Supervisor API
```

用戶安裝步驟：
1. 在 HA 安裝 Add-on
2. 設定 Slack tokens
3. 進入容器安裝 Claude Code 並登入
4. 重啟 Add-on

---

## 快速參考

```bash
# 重新建置
npm run build

# 執行測試
npm test

# 啟動各介面
npm run cli        # CLI
npm run mcp        # MCP Server
npm run slack      # Slack Bot
npm run scheduler  # 排程服務
```
