# Webhook + 多通訊渠道通知系統

## 目標
新增 webhook 功能，接收 Home Assistant automation 的執行通知，透過 Claude 生成友善訊息後，發送到各通訊渠道（Slack、Telegram、Discord、Line 等）。

## 架構設計

```
HA Automation
    ↓ HTTP POST
Webhook Server (獨立服務)
    ↓
Claude CLI (生成友善訊息)
    ↓
NotificationManager (通知管理器)
    ├→ SlackAdapter
    ├→ TelegramAdapter (未來)
    ├→ DiscordAdapter (未來)
    └→ LineAdapter (未來)
```

## 新增檔案

```
src/
├── core/
│   └── notification/
│       ├── index.ts              # 匯出
│       ├── types.ts              # 介面定義
│       ├── manager.ts            # NotificationManager
│       └── adapters/
│           ├── index.ts          # 匯出所有 adapters
│           └── slack.ts          # Slack adapter
└── interfaces/
    └── webhook-server.ts         # Webhook HTTP Server
```

## 實作細節

### 1. 通知介面 (`src/core/notification/types.ts`)

```typescript
export type ChannelType = 'slack' | 'telegram' | 'discord' | 'line';

export interface NotificationMessage {
  text: string;
  markdown?: string;
  source: 'webhook' | 'schedule' | 'manual';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  channel: ChannelType;
  success: boolean;
  error?: string;
}

export interface NotificationAdapter {
  readonly type: ChannelType;
  isConfigured(): boolean;
  send(message: NotificationMessage, target?: string): Promise<NotificationResult>;
}
```

### 2. NotificationManager (`src/core/notification/manager.ts`)

- 管理多個 adapter
- 支援設定預設頻道
- 提供統一的 `send()` 方法

### 3. Slack Adapter (`src/core/notification/adapters/slack.ts`)

- 重構現有 `sendToSlack()` 函數
- 使用 `@slack/web-api` 的 `WebClient`
- 讀取 `SLACK_BOT_TOKEN` 和 `SLACK_DEFAULT_CHANNEL`

### 4. Webhook Server (`src/interfaces/webhook-server.ts`)

**Endpoint:** `POST /webhook/automation`

**認證:** Bearer token (`WEBHOOK_SECRET` 環境變數)

**Payload 格式:**
```typescript
interface WebhookPayload {
  automation_id: string;          // "automation.morning_routine"
  automation_name: string;        // "早晨例行公事"
  trigger: {
    platform: string;             // "time", "state", "sun"
    entity_id?: string;
    from_state?: string;
    to_state?: string;
  };
  message?: string;               // 自訂訊息
  context?: Record<string, unknown>;
  channels?: string[];            // ["slack", "telegram"]
}
```

**流程:**
1. 驗證 Authorization header
2. 解析 payload
3. 呼叫 Claude CLI 生成友善訊息
4. 透過 NotificationManager 發送到指定頻道
5. 回傳 202 Accepted（非阻塞處理）

## 環境變數 (新增)

```bash
# Webhook 設定
WEBHOOK_PORT=8080
WEBHOOK_SECRET=your-random-secret-here

# 未來擴展
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## package.json 新增 script

```json
{
  "webhook": "node dist/interfaces/webhook-server.js"
}
```

## Home Assistant 設定範例

**rest_command (configuration.yaml):**
```yaml
rest_command:
  claude_webhook:
    url: "http://localhost:8080/webhook/automation"
    method: POST
    headers:
      Authorization: "Bearer YOUR_WEBHOOK_SECRET"
      Content-Type: "application/json"
    payload: >-
      {
        "automation_id": "{{ automation_id }}",
        "automation_name": "{{ automation_name }}",
        "trigger": {
          "platform": "{{ trigger_platform }}",
          "entity_id": "{{ trigger_entity | default('') }}",
          "from_state": "{{ from_state | default('') }}",
          "to_state": "{{ to_state | default('') }}"
        }
      }
```

**automation 使用範例:**
```yaml
- id: 'door_opened_notification'
  alias: 門打開通知
  trigger:
    - platform: state
      entity_id: binary_sensor.front_door
      to: 'on'
  action:
    - service: rest_command.claude_webhook
      data:
        automation_id: "{{ this.entity_id }}"
        automation_name: "{{ state_attr(this.entity_id, 'friendly_name') }}"
        trigger_platform: state
        trigger_entity: "{{ trigger.entity_id }}"
        to_state: "{{ trigger.to_state.state }}"
```

## Add-on 整合 (後續)

- `config.yaml` 新增 `webhook_port` 和 `webhook_secret` 選項
- `run.sh` 新增啟動 webhook server
- 需要開放 port 8080

## 實作順序

### Phase 1: 核心實作
1. `src/core/notification/types.ts` - 介面定義
2. `src/core/notification/manager.ts` - NotificationManager
3. `src/core/notification/adapters/slack.ts` - Slack adapter
4. `src/core/notification/adapters/index.ts` - 匯出
5. `src/core/notification/index.ts` - 匯出
6. `src/interfaces/webhook-server.ts` - Webhook server
7. `package.json` - 新增 `webhook` script

### Phase 2: 重構 (選擇性)
- 修改 `scheduler-daemon.ts` 使用 NotificationManager

### Phase 3: 擴展 (未來)
- 新增 Telegram、Discord、Line adapters

## 關鍵檔案參考

| 用途 | 檔案路徑 |
|------|---------|
| 現有 sendToSlack | `src/interfaces/scheduler-daemon.ts:75` |
| Claude CLI 執行 | `src/interfaces/scheduler-daemon.ts:97` |
| 環境偵測 | `src/core/env-detect.ts` |
| Logger | `src/utils/logger.ts` |
| Add-on 設定 | `claude-ha-assistant/config.yaml` |

## 驗證方式

1. **啟動 webhook server:**
   ```bash
   npm run build
   WEBHOOK_SECRET=test123 npm run webhook
   ```

2. **測試 webhook:**
   ```bash
   curl -X POST http://localhost:8080/webhook/automation \
     -H "Authorization: Bearer test123" \
     -H "Content-Type: application/json" \
     -d '{
       "automation_id": "automation.test",
       "automation_name": "測試自動化",
       "trigger": {"platform": "manual"}
     }'
   ```

3. **預期結果:**
   - 回傳 202 Accepted
   - Slack 頻道收到 Claude 生成的通知訊息
