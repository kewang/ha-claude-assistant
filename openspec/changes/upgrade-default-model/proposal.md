## Why

預設 Claude 模型寫死為 `claude-sonnet-4-20250514`，未來 Anthropic 推出新版 Sonnet 時需要手動改程式碼。Claude CLI 支援模型別名（`--model sonnet` 自動解析為最新版），應改用別名讓預設值永遠指向最新 Sonnet。

## What Changes

- 將預設模型從寫死的 `claude-sonnet-4-20250514` 改為 CLI 別名 `sonnet`
- 同步更新所有文件中的預設模型說明（README.md、CLAUDE.md、.env.example、config/default.json）
- 使用者仍可透過 `CLAUDE_MODEL` 環境變數覆寫為任意完整 model ID

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

（此變更不涉及 spec 層級的行為變更，僅更新預設值策略）

## Impact

- 程式碼：`src/core/claude-agent.ts` 預設模型字串
- 設定檔：`config/default.json`
- 文件：`README.md`、`CLAUDE.md`、`.env.example`
- 使用者影響：新安裝或未設定 `CLAUDE_MODEL` 的使用者將自動使用 CLI 解析的最新 Sonnet
