### Requirement: Slack Socket Mode Bot
The system SHALL provide a Slack bot using Socket Mode (no public endpoint needed) that processes user messages via Claude CLI.

#### Scenario: 啟動 Bot
- **WHEN** the Slack bot is started
- **THEN** the system initializes `@slack/bolt` App in Socket Mode with `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN`

### Requirement: Bot User ID 初始化
The system SHALL retrieve the bot's own Slack user ID at startup for message filtering.

#### Scenario: 啟動時取得 bot user ID
- **WHEN** the Slack bot starts
- **THEN** the system calls `auth.test` API to obtain the bot's user ID and stores it as an instance property

### Requirement: 事件處理
The system SHALL handle Slack events and commands.

#### Scenario: DM 訊息
- **WHEN** a direct message is received (not from bots)
- **THEN** the system processes the message through Claude CLI, including thread replies

#### Scenario: @mention 訊息
- **WHEN** the bot is @mentioned in a channel
- **THEN** the system strips the mention prefix and processes the remaining text

#### Scenario: /ha 斜線指令
- **WHEN** the `/ha` slash command is invoked
- **THEN** the system processes the command text through Claude CLI

### Requirement: Thread 自動回覆
The system SHALL automatically respond to thread replies in threads where the bot has previously participated, without requiring @mention.

#### Scenario: Channel thread 回覆（bot 已參與）
- **WHEN** a message is received in a channel thread where the bot has conversation history (`slack:${thread_ts}` key exists in ConversationStore)
- **AND** the message does not contain an @mention of the bot
- **THEN** the system processes the message through Claude CLI and responds in the thread

#### Scenario: Channel thread 回覆（bot 未參與）
- **WHEN** a message is received in a channel thread where the bot has no conversation history
- **AND** the message does not contain an @mention of the bot
- **THEN** the system ignores the message

#### Scenario: Channel 非 thread 訊息（無 @mention）
- **WHEN** a message is received in a channel that is not a thread reply
- **AND** the message does not contain an @mention of the bot
- **THEN** the system ignores the message

#### Scenario: 避免重複處理 @mention 訊息
- **WHEN** a message is received in a channel that contains an @mention of the bot
- **THEN** the `app.message()` handler skips the message (defers to `app_mention` handler)

### Requirement: 訊息處理流程
The system SHALL follow a consistent pattern for processing messages.

#### Scenario: 處理使用者訊息
- **WHEN** a message is received for processing
- **THEN** the system:
  1. Sends a "🔄 處理中..." thinking message
  2. Loads conversation history from `ConversationStore`
  3. Builds augmented prompt via `buildPromptWithHistory()`
  4. Calls `ensureValidToken()` to verify Claude CLI token
  5. Spawns `claude --print --permission-mode bypassPermissions`
  6. Updates the thinking message with the actual response
  7. Saves the exchange to conversation store

#### Scenario: Claude 執行逾時
- **WHEN** the Claude CLI process exceeds the timeout (default 3 minutes, configurable via `CLAUDE_TIMEOUT_MS`)
- **THEN** the system kills the process and updates the message with a timeout error

### Requirement: 對話歷史整合
The system SHALL maintain conversation context across messages.

#### Scenario: Thread 對話
- **WHEN** messages are exchanged in a Slack thread
- **THEN** the system uses `slack:${thread_ts}` as conversation key to maintain history

#### Scenario: 非 Thread 對話
- **WHEN** a DM or mention is received outside a thread
- **THEN** the system uses `slack:${message_ts}` as conversation key

### Requirement: 自動重連機制
The system SHALL automatically reconnect on Socket Mode disconnection with exponential backoff.

#### Scenario: 偵測到斷線
- **WHEN** the SocketModeClient emits a `disconnected` event
- **THEN** the system triggers the reconnection process

#### Scenario: 指數退避重連
- **WHEN** reconnection is triggered
- **THEN** the system waits with exponential backoff:
  - Initial delay: 1 second
  - Subsequent: delay * 2 (capped at 60 seconds)
  - Maximum attempts: 10

#### Scenario: 重連成功
- **WHEN** the SocketModeClient emits a `connected` event after reconnection
- **THEN** the system resets the reconnect counter to 0

#### Scenario: 超過重連上限
- **WHEN** reconnection fails 10 consecutive times
- **THEN** the system gives up and sends a Slack notification about the failure

### Requirement: 狀態機錯誤處理
The system SHALL handle known `@slack/socket-mode` state machine bugs.

#### Scenario: 捕捉狀態機異常
- **WHEN** a process-level `uncaughtException` occurs with message matching Socket Mode state machine pattern
- **THEN** the system logs the error but does not crash

### Requirement: Add-on 環境支援
The system SHALL support running in HA Add-on environment.

#### Scenario: Add-on Claude CLI 執行
- **WHEN** running in Add-on environment
- **THEN** the system uses the Add-on Claude path and sets `CLAUDE_CONFIG_DIR` environment variable
