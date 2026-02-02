#!/usr/bin/env bash
set -e

echo "=========================================="
echo "Claude HA Assistant - Starting..."
echo "=========================================="

# 讀取 Add-on 設定
CONFIG_PATH=/data/options.json

if [ -f "$CONFIG_PATH" ]; then
    SLACK_BOT_TOKEN=$(jq -r '.slack_bot_token // empty' "$CONFIG_PATH")
    SLACK_APP_TOKEN=$(jq -r '.slack_app_token // empty' "$CONFIG_PATH")
    SLACK_DEFAULT_CHANNEL=$(jq -r '.slack_default_channel // empty' "$CONFIG_PATH")
    TIMEZONE=$(jq -r '.timezone // "Asia/Taipei"' "$CONFIG_PATH")
    LOG_LEVEL=$(jq -r '.log_level // "info"' "$CONFIG_PATH")
else
    echo "Warning: Config file not found at $CONFIG_PATH"
fi

# 設定環境變數
export SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
export SLACK_APP_TOKEN="$SLACK_APP_TOKEN"
export SLACK_DEFAULT_CHANNEL="$SLACK_DEFAULT_CHANNEL"
export TZ="$TIMEZONE"
export LOG_LEVEL="$LOG_LEVEL"

# Add-on 專用環境變數
export SCHEDULE_DATA_PATH="/data/schedules/schedules.json"
export CLAUDE_CONFIG_DIR="/data/claude"

echo "Timezone: $TIMEZONE"
echo "Log Level: $LOG_LEVEL"
echo "Schedule Data: $SCHEDULE_DATA_PATH"
echo "Claude Config: $CLAUDE_CONFIG_DIR"

# 檢查 Slack 設定
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_APP_TOKEN" ]; then
    echo "Warning: Slack tokens not configured. Please set slack_bot_token and slack_app_token in Add-on configuration."
fi

# 檢查 Claude CLI 是否已安裝
if ! command -v claude &> /dev/null; then
    echo ""
    echo "=========================================="
    echo "Claude CLI 尚未安裝！"
    echo ""
    echo "請執行以下步驟安裝並登入 Claude："
    echo ""
    echo "1. 進入容器："
    echo "   docker exec -it addon_claude_ha_assistant bash"
    echo ""
    echo "2. 安裝 Claude Code："
    echo "   npm install -g @anthropic-ai/claude-code"
    echo ""
    echo "3. 登入 Claude："
    echo "   CLAUDE_CONFIG_DIR=/data/claude claude login"
    echo ""
    echo "=========================================="
    echo ""
    echo "等待 Claude CLI 安裝中...（每 30 秒檢查一次）"

    while ! command -v claude &> /dev/null; do
        sleep 30
    done

    echo "Claude CLI 已偵測到！繼續啟動..."
fi

# 檢查 Claude 是否已登入
echo "檢查 Claude 登入狀態..."
if ! CLAUDE_CONFIG_DIR="$CLAUDE_CONFIG_DIR" claude --version &> /dev/null; then
    echo "Warning: Claude CLI 可能未正確登入"
fi

echo ""
echo "=========================================="
echo "啟動服務..."
echo "=========================================="

# 啟動 Scheduler（背景執行）
echo "Starting Scheduler daemon..."
node /app/dist/interfaces/scheduler-daemon.js &
SCHEDULER_PID=$!
echo "Scheduler started (PID: $SCHEDULER_PID)"

# 啟動 Slack Bot（前景執行）
echo "Starting Slack Bot..."
exec node /app/dist/interfaces/slack-bot.js
