# Claude HA Assistant

Claude AI 驅動的智慧家庭助理，整合 Home Assistant。

## 功能

- **Slack Bot**：透過 Slack 與 Claude 對話，控制智慧家庭設備
- **排程服務**：設定定時任務，例如每天早上報告天氣和設備狀態
- **自然語言控制**：用自然語言控制燈光、開關、空調等設備

## 安裝步驟

### 1. 安裝 Add-on

在 Home Assistant 的「設定 > 附加元件」中搜尋並安裝此 Add-on。

### 2. 設定 Slack

1. 前往 [Slack API](https://api.slack.com/apps) 建立新的 App
2. 啟用以下功能：
   - **Socket Mode**：取得 App Token (xapp-)
   - **Bot Token Scopes**：`chat:write`, `app_mentions:read`, `im:history`, `commands`
3. 安裝 App 到你的 Workspace
4. 在 Add-on 設定中填入：
   - `slack_bot_token`：Bot Token (xoxb-)
   - `slack_app_token`：App Token (xapp-)
   - `slack_default_channel`：預設頻道 ID (C...)

### 3. 安裝並登入 Claude Code

**重要**：你需要手動進入 Add-on 容器安裝 Claude Code 並登入。

```bash
# 1. 進入 Add-on 容器
docker exec -it addon_claude_ha_assistant bash

# 2. 安裝 Claude Code
npm install -g @anthropic-ai/claude-code

# 3. 登入 Claude（會開啟瀏覽器進行 OAuth）
CLAUDE_CONFIG_DIR=/data/claude claude login
```

登入完成後，重啟 Add-on 即可開始使用。

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

## 設定選項

| 選項 | 說明 | 必填 |
|------|------|------|
| `slack_bot_token` | Slack Bot Token (xoxb-) | 是 |
| `slack_app_token` | Slack App Token (xapp-) | 是 |
| `slack_default_channel` | 預設通知頻道 ID (C...) | 建議 |
| `timezone` | 時區（預設 Asia/Taipei） | 否 |
| `log_level` | 日誌等級 (debug/info/warn/error) | 否 |

## 故障排除

### Claude CLI 未安裝

如果日誌顯示「Claude CLI 尚未安裝」，請按照上述步驟進入容器安裝並登入。

### Slack 連線失敗

1. 確認 `slack_bot_token` 和 `slack_app_token` 正確
2. 確認 Slack App 已啟用 Socket Mode
3. 確認 Bot 已安裝到 Workspace

### 無法控制設備

1. 確認 Home Assistant API 正常運作
2. 檢查 Add-on 日誌是否有錯誤訊息
3. 確認 Claude 已成功登入

## 資料持久化

以下資料會在 Add-on 重啟後保留：

- **Claude 登入狀態**：儲存在 `/data/claude/`
- **排程設定**：儲存在 `/data/schedules/schedules.json`

## 技術架構

```
Slack Bot / Scheduler
        ↓
  Claude CLI (--print)
        ↓
    MCP Server
        ↓
  Supervisor API
        ↓
  Home Assistant
```

## 支援

如有問題，請在 [GitHub Issues](https://github.com/kewang/ha-claude-assistant/issues) 回報。
