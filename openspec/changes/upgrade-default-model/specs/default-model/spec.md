## ADDED Requirements

### Requirement: 預設模型使用 CLI 別名

系統 SHALL 使用 `sonnet` 作為預設 Claude 模型別名，由 Claude CLI 自動解析為最新 Sonnet 版本。使用者可透過 `CLAUDE_MODEL` 環境變數覆寫為任意 model ID。

#### Scenario: 未設定 CLAUDE_MODEL 時使用預設別名
- **WHEN** 使用者未設定 `CLAUDE_MODEL` 環境變數
- **THEN** 系統使用 `sonnet` 作為模型參數，由 Claude CLI 解析為最新 Sonnet

#### Scenario: 使用者透過環境變數覆寫模型
- **WHEN** 使用者設定 `CLAUDE_MODEL=claude-haiku-4-5-20251001`
- **THEN** 系統使用 `claude-haiku-4-5-20251001` 作為 Claude 模型
