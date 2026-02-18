## Context

`run.sh` 是 Add-on 容器的啟動腳本，負責建立必要目錄和設定權限。目前只處理了 `claude/` 和 `schedules/`，遺漏了 `conversations/` 和 `event-subscriptions/`。這兩個目錄後來由 Node.js 程式以 root 身份自動建立，導致權限不一致。

現有的目錄初始化邏輯（run.sh 第 32-44 行）：
```bash
mkdir -p "$CLAUDE_CONFIG_DIR"                    # /data/claude
mkdir -p "$(dirname "$SCHEDULE_DATA_PATH")"      # /data/schedules
chown -R claude:claude "$CLAUDE_CONFIG_DIR"
chown -R claude:claude "$(dirname "$SCHEDULE_DATA_PATH")"
```

## Goals / Non-Goals

**Goals:**
- 在 `run.sh` 中統一建立所有 `/data` 子目錄並設定為 `claude:claude`
- 確保 Node.js 程式啟動前目錄已存在且權限正確

**Non-Goals:**
- 不修改 Node.js 程式中的 `mkdir` 邏輯（保留作為 fallback）
- 不改變 Node.js 服務的執行身份（仍以 root 執行）

## Decisions

**統一在現有的目錄初始化區塊中新增**：在 `run.sh` 現有的 `mkdir -p` 和 `chown` 區塊旁邊新增 `conversations` 和 `event-subscriptions` 的處理，保持程式碼結構一致。

路徑定義：
- `/data/conversations`
- `/data/event-subscriptions`

與現有的 `$CLAUDE_CONFIG_DIR` 和 `$(dirname "$SCHEDULE_DATA_PATH")` 採用相同模式。

## Risks / Trade-offs

- [低風險] 已存在的 `root:root` 目錄會被 `chown` 改為 `claude:claude` → 不影響功能，因為 Node.js 服務以 root 執行，root 可讀寫任何擁有者的目錄。
