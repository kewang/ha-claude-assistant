# Claude HA Assistant

Claude AI 驅動的智慧家庭助理，整合 Home Assistant。

## 功能

- **Web UI 登入**：透過 HA 側邊欄完成 Claude 登入，無需進入容器
- **Slack Bot**：透過 Slack 與 Claude 對話，控制智慧家庭設備
- **對話記憶**：支援多輪對話上下文，Slack thread、CLI session、排程任務都能記住前文
- **排程服務**：設定定時任務，例如每天早上報告天氣和設備狀態
- **自然語言控制**：用自然語言控制燈光、開關、空調等設備
- **多種介面**：CLI、MCP Server（Claude Code）、Slack Bot

## 安裝步驟

### 方式一：Home Assistant Add-on（推薦）

#### 1. 安裝 Add-on

1. 在 Home Assistant 中，前往「設定 > 附加元件 > 附加元件商店」
2. 點擊右上角選單，選擇「倉庫」
3. 加入此倉庫：`https://github.com/kewang/ha-claude-assistant`
4. 安裝「Claude HA Assistant」Add-on

#### 2. 設定 Slack

1. 前往 [Slack API](https://api.slack.com/apps) 建立新的 App
2. 啟用以下功能：
   - **Socket Mode**：取得 App Token (xapp-)
   - **Bot Token Scopes**：`chat:write`, `app_mentions:read`, `im:history`, `commands`
3. 安裝 App 到你的 Workspace
4. 在 Add-on 設定中填入：
   - `slack_bot_token`：Bot Token (xoxb-)
   - `slack_app_token`：App Token (xapp-)
   - `slack_default_channel`：預設頻道 ID (C...)

#### 3. 登入 Claude Code

安裝完成後，HA 側邊欄會出現「Claude Assistant」。

**方法一：Web UI 登入（推薦）**

1. 點擊側邊欄的「Claude Assistant」
2. 點擊「Login to Claude」按鈕
3. 在新開的分頁中完成 Claude 授權
4. 複製頁面顯示的授權碼，貼回 Web UI
5. 完成！狀態會顯示綠燈

**方法二：命令列登入**

```bash
# 1. 進入 Add-on 容器
docker exec -it $(docker ps -qf name=claude) bash

# 2. 登入 Claude（會開啟瀏覽器進行 OAuth）
su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login
```

> **注意**：登入後，系統會自動維護 token 有效性，無需手動介入。詳見下方「Token 自動刷新」章節。

### 方式二：手動安裝（開發用）

#### 1. 安裝

```bash
cd ~/git/ha-claude-assistant
npm install
```

#### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env` 檔案：

```env
# Home Assistant 設定
HA_URL=http://your-ha-ip:8123
HA_URL_EXTERNAL=https://your-ha.duckdns.org:8123  # 選用，外網 URL
HA_TOKEN=your_long_lived_access_token

# Slack（選用）
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_DEFAULT_CHANNEL=C0123456789

# Claude CLI 設定（選用）
CLAUDE_TIMEOUT_MS=180000  # Claude CLI 執行 timeout（預設 3 分鐘）

# 對話記憶設定（選用）
CONVERSATION_MAX_TURNS=20       # 每組對話最多保留幾筆 turn（預設 20）
CONVERSATION_MAX_CHARS=8000     # 歷史文字上限（預設 8000）
CONVERSATION_MAX_AGE_DAYS=7     # 過期清除天數（預設 7）
```

> 注意：設定 `HA_URL_EXTERNAL` 後，系統會自動偵測連線，優先使用內網。

#### 3. 建置

```bash
npm run build
```

#### 4. 測試 Home Assistant 連線

```bash
npm run test:ha
```

## 使用方式

### Slack 指令

在 Slack 中，你可以：

- **直接對話**：傳訊息給 Bot，例如「把客廳的燈打開」
- **@mention**：在頻道中 @機器人 並輸入指令
- **斜線指令**：使用 `/ha` 指令，例如 `/ha 現在溫度幾度？`

### 範例

```
/ha 列出所有燈具
/ha 把書房的燈調暗一點
/ha 現在家裡的溫濕度是多少？
/ha 幫我建立一個每天晚上七點報告溫濕度的排程
```

### 排程管理

透過自然語言建立、查詢、修改排程：

```
/ha 幫我每天早上七點報告今天的天氣
/ha 列出所有排程
/ha 把溫濕度報告停用
/ha 刪除早晨天氣排程
```

### CLI 互動模式（手動安裝）

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

## 設定選項

| 選項 | 說明 | 必填 |
|------|------|------|
| `slack_bot_token` | Slack Bot Token (xoxb-) | 是 |
| `slack_app_token` | Slack App Token (xapp-) | 是 |
| `slack_default_channel` | 預設通知頻道 ID (C...) | 建議 |
| `timezone` | 時區（預設 Asia/Taipei） | 否 |
| `log_level` | 日誌等級 (debug/info/warn/error) | 否 |

## Token 自動刷新

Claude CLI 的 OAuth token 會定期過期：
- **Access token**：約 8-12 小時過期
- **Refresh token**：約 7-30 天過期

### 自動維護

系統會自動維護 token 有效性：

1. **定期檢查**：每 5 分鐘檢查 token 狀態
2. **提前刷新**：在 access token 過期前 30 分鐘自動刷新
3. **失敗通知**：refresh token 過期時發送 Slack 通知

### 重新登入

當收到 Slack 通知表示 token 已過期時，需要重新登入：

1. 打開側邊欄的「Claude Assistant」，點擊「Login to Claude」重新授權
2. 或進入容器手動登入：
   ```bash
   docker exec -it $(docker ps -qf name=claude) bash
   su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login
   ```

登入完成後，系統會自動恢復運作。

## 故障排除

### 一般問題

#### Slack 連線失敗

1. 確認 `slack_bot_token` 和 `slack_app_token` 正確
2. 確認 Slack App 已啟用 Socket Mode
3. 確認 Bot 已安裝到 Workspace

#### Slack 連線斷開

系統內建自動重連機制：

- **自動重連**：連線斷開時會自動嘗試重連，使用指數退避策略（1s → 2s → 4s → ... → 60s）
- **重連次數**：最多嘗試 10 次，超過後發送 Slack 通知
- **狀態機錯誤**：系統會捕捉 `@slack/socket-mode` 套件的已知錯誤，防止程序崩潰

如果日誌顯示「已達最大重連次數」，請檢查網路連線並重啟服務。

#### 無法控制設備

1. 確認 Home Assistant API 正常運作
2. 檢查日誌是否有錯誤訊息
3. 確認 Claude 已成功登入

### Add-on 專屬問題

#### Web UI 登入後 Slack Bot 仍顯示 "Invalid API key"

Web UI 儲存的 credentials 格式必須與 CLI 完全一致。如果遇到此問題：

1. 確認 Add-on 版本為 **1.4.13+**
2. 在 Web UI 重新執行一次 Login 流程
3. 如果仍失敗，進入容器手動登入：
   ```bash
   docker exec -it $(docker ps -qf name=claude) bash
   su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login
   ```

#### Claude CLI 未登入

如果日誌顯示「Claude CLI 尚未登入」，請進入容器登入：

```bash
docker exec -it $(docker ps -qf name=claude) bash
su-exec claude env CLAUDE_CONFIG_DIR=/data/claude claude login
```

## 資料持久化

以下資料會在 Add-on 重啟後保留：

- **Claude 登入狀態**：儲存在 `/data/claude/`
- **排程設定**：儲存在 `/data/schedules/schedules.json`
- **對話記憶**：儲存在 `/data/conversations/conversations.json`

## 技術架構

```
Web UI (HA Ingress, 動態 port)
        ↓
  OAuth PKCE Flow → Claude 登入

Slack Bot / Scheduler
        ↓
  claude-run (以非 root 用戶執行)
        ↓
  Claude CLI (--print --permission-mode bypassPermissions)
        ↓
    MCP Server
        ↓
  Supervisor API
        ↓
  Home Assistant
```

> **注意**：Claude CLI 的 `bypassPermissions` 模式不允許在 root 下執行，因此使用 `su-exec` 以 `claude` 用戶身份執行。

## 專案結構

```
ha-claude-assistant/
├── src/
│   ├── core/
│   │   ├── ha-client.ts        # Home Assistant API 封裝
│   │   ├── schedule-store.ts   # 排程持久化儲存
│   │   ├── conversation-store.ts # 對話記憶持久化
│   │   ├── env-detect.ts       # 環境偵測（Add-on / 一般）
│   │   ├── claude-token-refresh.ts # OAuth Token 自動刷新
│   │   └── claude-oauth-config.ts  # OAuth 設定動態提取
│   ├── interfaces/
│   │   ├── mcp-server.ts       # MCP Server
│   │   ├── cli.ts              # CLI 介面
│   │   ├── slack-bot.ts        # Slack Bot
│   │   ├── web-ui.ts           # Web UI HTTP Server
│   │   └── scheduler-daemon.ts # 排程服務
│   ├── tools/                  # Claude tools 定義
│   │   ├── list-entities.ts
│   │   ├── get-states.ts
│   │   ├── call-service.ts
│   │   ├── manage-schedule.ts
│   │   └── index.ts
│   └── index.ts
├── repository.yaml             # HA Add-on 倉庫設定
├── claude-ha-assistant/        # Home Assistant Add-on
│   ├── config.yaml
│   ├── Dockerfile
│   └── ...
├── tests/                      # 測試檔案
├── data/                       # 排程資料
├── .env.example                # 環境變數範例
└── package.json
```

## 可用 Tools

### list_entities
列出 Home Assistant 中的實體，可依 domain 或關鍵字過濾。

### get_state
取得單一實體的詳細狀態和屬性。

### call_service
呼叫 HA 服務控制設備（開關燈、調溫度等）。

### manage_schedule
管理排程任務，支援建立、列出、啟用、停用、刪除排程。

## 開發

```bash
# 開發模式（自動重新編譯）
npm run dev

# 執行測試
npm test

# 執行測試（監看模式）
npm run test:watch
```

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
   - `/ha` - 智慧家庭控制（包含排程管理）
7. 安裝到 Workspace
8. 複製 Bot Token（xoxb-）和 App Token（xapp-）

## 取得 Home Assistant Token

1. 登入 Home Assistant
2. 點擊左下角個人頭像
3. 往下捲到「Long-lived access tokens」
4. 點擊「CREATE TOKEN」
5. 輸入名稱（如 "Claude Assistant"）
6. 複製產生的 token

## 支援

如有問題，請在 [GitHub Issues](https://github.com/kewang/ha-claude-assistant/issues) 回報。

## License

MIT
