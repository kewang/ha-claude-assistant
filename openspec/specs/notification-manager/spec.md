## ADDED Requirements

### Requirement: 通知介面定義
The system SHALL define a `NotificationAdapter` interface for all notification channels.

#### Scenario: Adapter 介面
- **WHEN** a notification adapter is implemented
- **THEN** it SHALL provide:
  - `type`: ChannelType — 頻道類型識別（`"slack"` | `"telegram"` | `"discord"` | `"line"`）
  - `isConfigured()`: boolean — 檢查此頻道是否已設定必要的環境變數
  - `send(message, target?)`: Promise<NotificationResult> — 發送通知訊息

#### Scenario: 通知訊息格式
- **WHEN** a notification is sent
- **THEN** the `NotificationMessage` SHALL contain:
  - `text`: string — 純文字訊息內容
  - `markdown`: string | undefined — Markdown 格式訊息（Slack 用 mrkdwn）
  - `source`: `"event"` | `"schedule"` | `"manual"` — 通知來源
  - `metadata`: Record<string, unknown> | undefined — 額外資訊

### Requirement: NotificationManager 管理器
The system SHALL provide a `NotificationManager` class that manages multiple notification adapters.

#### Scenario: 註冊 adapter
- **WHEN** `registerAdapter(adapter)` is called
- **THEN** the system adds the adapter to the manager, indexed by its `type`

#### Scenario: 發送通知到預設頻道
- **WHEN** `send(message)` is called without specifying channels
- **THEN** the system sends to all configured (registered and `isConfigured() === true`) adapters

#### Scenario: 發送通知到指定頻道
- **WHEN** `send(message, { channels: ["slack"] })` is called
- **THEN** the system only sends to the specified channel adapter(s)

#### Scenario: 發送通知到指定 target
- **WHEN** `send(message, { target: "C12345" })` is called
- **THEN** the system passes the target parameter to each adapter（如 Slack channel ID）

#### Scenario: Adapter 未設定
- **WHEN** `send()` is called but no adapters are configured
- **THEN** the system logs a warning and returns empty results

### Requirement: Slack Adapter
The system SHALL provide a Slack notification adapter.

#### Scenario: Slack adapter 初始化
- **WHEN** the Slack adapter is created
- **THEN** it reads `SLACK_BOT_TOKEN` and `SLACK_DEFAULT_CHANNEL` from environment variables

#### Scenario: Slack adapter isConfigured
- **WHEN** `isConfigured()` is called
- **THEN** it returns `true` only if both `SLACK_BOT_TOKEN` and `SLACK_DEFAULT_CHANNEL` are set

#### Scenario: 發送 Slack 訊息
- **WHEN** `send(message)` is called with the Slack adapter
- **THEN** the system calls `WebClient.chat.postMessage()` with `mrkdwn: true` to the default channel

#### Scenario: 發送 Slack 訊息到指定頻道
- **WHEN** `send(message, "C12345")` is called
- **THEN** the system sends to the specified channel instead of the default

#### Scenario: Slack 發送失敗
- **WHEN** Slack API returns an error
- **THEN** the adapter returns `{ channel: "slack", success: false, error: <error message> }` without throwing

### Requirement: Singleton 存取
The system SHALL provide a singleton factory for NotificationManager.

#### Scenario: 取得 NotificationManager 實例
- **WHEN** `getNotificationManager()` is called
- **THEN** the system returns the same NotificationManager instance, pre-configured with all available adapters (auto-registers adapters whose environment variables are set)
