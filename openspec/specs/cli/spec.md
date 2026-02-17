### Requirement: CLI 互動介面
The system SHALL provide an interactive REPL (Read-Eval-Print Loop) interface for direct user interaction with the HA assistant.

#### Scenario: 啟動互動模式
- **WHEN** the CLI is started without arguments
- **THEN** the system displays a welcome message and enters readline-based REPL mode with prompt `> `

#### Scenario: 單一指令模式
- **WHEN** the CLI is started with a command argument (e.g., `ha-claude "turn on bedroom light"`)
- **THEN** the system executes the command once and exits

### Requirement: 內建指令
The system SHALL support built-in slash commands.

#### Scenario: /help 指令
- **WHEN** the user types `/help`
- **THEN** the system displays available commands and usage information

#### Scenario: /status 指令
- **WHEN** the user types `/status`
- **THEN** the system calls `HAClient.autoConnect()` and displays connection status

#### Scenario: /clear 指令
- **WHEN** the user types `/clear`
- **THEN** the system clears the current session's conversation history

#### Scenario: /quit 指令
- **WHEN** the user types `/quit`
- **THEN** the system exits the REPL

### Requirement: Claude CLI 執行
The system SHALL execute user prompts via Claude CLI with conversation history.

#### Scenario: 執行 prompt
- **WHEN** the user enters a message
- **THEN** the system:
  1. Loads conversation history from `ConversationStore`
  2. Builds augmented prompt via `buildPromptWithHistory()`
  3. Spawns `claude --print` with the prompt
  4. Displays the response
  5. Saves the exchange to conversation store

#### Scenario: 執行逾時
- **WHEN** the Claude CLI process exceeds 120 seconds
- **THEN** the system kills the process and displays a timeout error

#### Scenario: 執行失敗
- **WHEN** the Claude CLI returns a non-zero exit code
- **THEN** the system displays stderr output and the exit code

### Requirement: Session 管理
The system SHALL maintain a unique session ID for conversation continuity.

#### Scenario: Session ID 格式
- **WHEN** a CLI session starts
- **THEN** the session ID is `cli:session-${Date.now()}`
