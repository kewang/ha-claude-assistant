### Requirement: 對話歷史持久化
The system SHALL provide a `ConversationStore` class for persistent conversation history with automatic trimming.

#### Scenario: 初始化對話儲存
- **WHEN** `init()` is called
- **THEN** the system creates the data directory if missing, loads existing conversations, and runs cleanup for expired conversations

### Requirement: 對話記錄操作
The system SHALL support adding, retrieving, and clearing conversation history.

#### Scenario: 新增對話交換
- **WHEN** `addExchange(conversationId, userMessage, assistantResponse)` is called
- **THEN** the system appends a new turn with timestamp, trims history if needed, and saves to file

#### Scenario: 取得對話歷史
- **WHEN** `getHistory(conversationId)` is called
- **THEN** the system returns an array of `ConversationTurn` objects (role, content, timestamp)

#### Scenario: 清除指定對話
- **WHEN** `clear(conversationId)` is called
- **THEN** the system removes all turns for that conversation ID

### Requirement: 自動修剪策略
The system SHALL automatically trim conversation history to stay within configured limits.

#### Scenario: 依回合數修剪
- **WHEN** a conversation exceeds `CONVERSATION_MAX_TURNS` (default: 20)
- **THEN** the system keeps only the most recent N turns

#### Scenario: 依字元數修剪
- **WHEN** a conversation's total character count exceeds `CONVERSATION_MAX_CHARS` (default: 8000)
- **THEN** the system removes oldest turns until under the limit

#### Scenario: 依存活天數清理
- **WHEN** `cleanup()` is called
- **THEN** the system removes conversations older than `CONVERSATION_MAX_AGE_DAYS` (default: 7) days

### Requirement: Prompt 歷史注入
The system SHALL provide a `buildPromptWithHistory()` helper to inject conversation history into Claude prompts.

#### Scenario: 建構帶歷史的 prompt
- **WHEN** `buildPromptWithHistory(history, newPrompt)` is called with existing history
- **THEN** the system returns a string formatted as:
  ```
  <conversation_history>
  [User]: previous message
  [Assistant]: previous response
  </conversation_history>

  {newPrompt}
  ```

#### Scenario: 無歷史時建構 prompt
- **WHEN** `buildPromptWithHistory([], newPrompt)` is called with empty history
- **THEN** the system returns only the `newPrompt` without history tags

### Requirement: 對話 Key 命名規則
The system SHALL use consistent conversation key naming across interfaces.

#### Scenario: Slack 對話 key
- **WHEN** a Slack message is received
- **THEN** the conversation key is `slack:${thread_ts || message_ts}`

#### Scenario: CLI 對話 key
- **WHEN** a CLI session starts
- **THEN** the conversation key is `cli:session-${timestamp}`

#### Scenario: Scheduler 對話 key
- **WHEN** a scheduled task executes
- **THEN** the conversation key is `schedule:${schedule_id}`

### Requirement: 環境感知路徑
The system SHALL use different storage paths based on environment.

#### Scenario: Add-on 環境
- **WHEN** running as HA Add-on
- **THEN** conversations are stored at `/data/conversations/conversations.json`

#### Scenario: 一般環境
- **WHEN** running standalone
- **THEN** conversations are stored at `data/conversations/conversations.json`
