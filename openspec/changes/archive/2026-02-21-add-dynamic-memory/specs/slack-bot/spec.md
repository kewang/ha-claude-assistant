## MODIFIED Requirements

### Requirement: 訊息處理流程
The system SHALL follow a consistent pattern for processing messages.

#### Scenario: 處理使用者訊息
- **WHEN** a message is received for processing
- **THEN** the system:
  1. Sends a "🔄 處理中..." thinking message
  2. Loads conversation history from `ConversationStore`
  3. Loads all memories from `MemoryStore`
  4. Builds augmented prompt: first applies `buildPromptWithMemory()` to inject long-term memory, then applies `buildPromptWithHistory()` to inject conversation history
  5. Calls `ensureValidToken()` to verify Claude CLI token
  6. Spawns `claude --print --permission-mode bypassPermissions`
  7. Updates the thinking message with the actual response
  8. Saves the exchange to conversation store

#### Scenario: Claude 執行逾時
- **WHEN** the Claude CLI process exceeds the timeout (default 3 minutes, configurable via `CLAUDE_TIMEOUT_MS`)
- **THEN** the system kills the process and updates the message with a timeout error
