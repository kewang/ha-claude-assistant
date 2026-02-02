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

# 確保必要的目錄存在
mkdir -p "$CLAUDE_CONFIG_DIR"
mkdir -p "$(dirname "$SCHEDULE_DATA_PATH")"

# 自動建立 Claude MCP 設定檔
MCP_SETTINGS_FILE="$CLAUDE_CONFIG_DIR/settings.json"
if [ ! -f "$MCP_SETTINGS_FILE" ]; then
    echo "建立 Claude MCP 設定檔..."
    cat > "$MCP_SETTINGS_FILE" << 'EOF'
{
  "mcpServers": {
    "ha-assistant": {
      "command": "node",
      "args": ["/app/dist/interfaces/mcp-server.js"]
    }
  }
}
EOF
    echo "MCP 設定檔已建立: $MCP_SETTINGS_FILE"
else
    echo "MCP 設定檔已存在: $MCP_SETTINGS_FILE"
fi

echo "Timezone: $TIMEZONE"
echo "Log Level: $LOG_LEVEL"
echo "Schedule Data: $SCHEDULE_DATA_PATH"
echo "Claude Config: $CLAUDE_CONFIG_DIR"

# 檢查 SUPERVISOR_TOKEN（由 HA 自動注入）
# 嘗試多種方式取得 token
if [ -z "$SUPERVISOR_TOKEN" ]; then
    # 方法 1: s6-overlay 環境檔案
    if [ -f /var/run/s6/container_environment/SUPERVISOR_TOKEN ]; then
        echo "從 s6 環境檔案載入 SUPERVISOR_TOKEN..."
        SUPERVISOR_TOKEN=$(cat /var/run/s6/container_environment/SUPERVISOR_TOKEN)
    # 方法 2: bashio（HA Add-on 標準工具）
    elif command -v bashio &> /dev/null; then
        echo "嘗試從 bashio 取得 SUPERVISOR_TOKEN..."
        SUPERVISOR_TOKEN=$(bashio::supervisor.token 2>/dev/null) || true
    fi

    if [ -n "$SUPERVISOR_TOKEN" ]; then
        export SUPERVISOR_TOKEN
    fi
fi

if [ -n "$SUPERVISOR_TOKEN" ]; then
    echo "SUPERVISOR_TOKEN: (已設定，長度 ${#SUPERVISOR_TOKEN})"
else
    echo "Warning: SUPERVISOR_TOKEN 未設定"
    echo ""
    echo "Debug: 檢查可能的 token 來源..."

    # 檢查 s6 環境目錄
    if [ -d /var/run/s6/container_environment ]; then
        echo "  /var/run/s6/container_environment 存在，內容："
        ls -1 /var/run/s6/container_environment/ 2>/dev/null | head -20 || echo "  無法列出"
    else
        echo "  /var/run/s6/container_environment 不存在"
    fi

    # 檢查 bashio
    echo ""
    if command -v bashio &> /dev/null; then
        echo "  bashio 可用"
    else
        echo "  bashio 不可用"
    fi

    # 列出所有 SUPERVISOR 相關的環境變數
    echo ""
    echo "  SUPERVISOR 相關環境變數："
    env | grep -i supervisor || echo "  （無）"

    echo ""
    echo "請確認 config.yaml 中有 homeassistant_api: true"
fi

# Debug: 列出相關環境變數
echo ""
echo "環境變數狀態："
echo "  SUPERVISOR_TOKEN: ${SUPERVISOR_TOKEN:+(已設定)}"
echo "  HA_URL: ${HA_URL:-未設定}"
echo "  HA_TOKEN: ${HA_TOKEN:+(已設定)}"

# 檢查 Slack 設定
if [ -z "$SLACK_BOT_TOKEN" ] || [ -z "$SLACK_APP_TOKEN" ]; then
    echo "Warning: Slack tokens not configured. Please set slack_bot_token and slack_app_token in Add-on configuration."
fi

# 顯示 Claude CLI 版本
echo ""
echo "Claude CLI 版本："
claude --version || echo "Warning: 無法取得 Claude CLI 版本"

# 檢查 Claude 是否已登入
echo ""
echo "檢查 Claude 登入狀態..."
if [ ! -f "$CLAUDE_CONFIG_DIR/.credentials.json" ]; then
    echo ""
    echo "=========================================="
    echo "Claude CLI 尚未登入！"
    echo ""
    echo "請進入容器執行登入："
    echo ""
    echo "1. 進入容器："
    echo "   docker exec -it \$(docker ps -qf name=claude_ha_assistant) bash"
    echo ""
    echo "2. 登入 Claude："
    echo "   CLAUDE_CONFIG_DIR=/data/claude claude login"
    echo ""
    echo "登入完成後，Add-on 會自動繼續啟動。"
    echo "=========================================="
    echo ""
    echo "等待登入中...（每 30 秒檢查一次）"

    while [ ! -f "$CLAUDE_CONFIG_DIR/.credentials.json" ]; do
        sleep 30
    done

    echo "Claude 登入完成！繼續啟動..."
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
