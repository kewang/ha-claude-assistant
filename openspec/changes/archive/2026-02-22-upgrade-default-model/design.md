## Context

`claude-agent.ts` 中的預設模型寫死為 `claude-sonnet-4-20250514`。Claude CLI 的 `--model` 參數支援別名（如 `sonnet`、`opus`），會自動解析為最新版本。改用別名可避免未來手動更新。

## Goals / Non-Goals

**Goals:**
- 預設模型改用 CLI 別名 `sonnet`，由 Claude CLI 自動解析為最新 Sonnet
- 確保 `CLAUDE_MODEL` 環境變數覆寫機制不受影響

**Non-Goals:**
- 不改變模型選擇邏輯（仍為 config > env > default）
- 不新增模型驗證或列表功能

## Decisions

### 使用 CLI 別名取代寫死的 model ID

Claude CLI `--model` 支援別名：`sonnet` → 最新 Sonnet、`opus` → 最新 Opus。
將預設值從 `claude-sonnet-4-20250514` 改為 `sonnet`。

涉及檔案：
1. `src/core/claude-agent.ts` — 程式碼預設值
2. `config/default.json` — 設定檔預設值
3. `README.md` — 使用者文件
4. `CLAUDE.md` — 開發者文件
5. `.env.example` — 環境變數範例

## Risks / Trade-offs

- **風險極低**：Claude CLI 官方支援別名，行為穩定
- 已設定 `CLAUDE_MODEL` 的使用者不受影響
- **好處**：未來 Anthropic 推出新版 Sonnet 時自動跟進，無需改程式碼
