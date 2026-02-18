## ADDED Requirements

### Requirement: Bot User ID 初始化
The system SHALL retrieve the bot's own Slack user ID at startup for message filtering.

#### Scenario: 啟動時取得 bot user ID
- **WHEN** the Slack bot starts
- **THEN** the system calls `auth.test` API to obtain the bot's user ID and stores it as an instance property

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

## MODIFIED Requirements

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
