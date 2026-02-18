## Why

在 HA Add-on 環境中，`/data` 下的目錄權限不一致。`claude/` 和 `schedules/` 由 `run.sh` 明確建立並設定為 `claude:claude`，但 `conversations/` 和 `event-subscriptions/` 是由 Node.js 程式以 root 身份執行時自動建立的，導致擁有者為 `root:root`。應統一處理以確保一致性。

## What Changes

- 在 `run.sh` 中新增 `conversations/` 和 `event-subscriptions/` 目錄的建立（`mkdir -p`）和權限設定（`chown`）
- 統一所有 `/data` 子目錄的擁有者為 `claude:claude`

## Capabilities

### New Capabilities

（無新增功能）

### Modified Capabilities

（無 spec 層級的行為變更，僅為基礎設施層面的權限修正）

## Impact

- `claude-ha-assistant/run.sh`：新增目錄建立和權限設定指令
