## Why

Add-on 環境中，scheduler-daemon、event-listener-daemon、slack-bot 三個獨立 Node.js process 各自持有 `ClaudeTokenRefreshService` singleton。當 token 即將過期時，多個 process 同時用相同的舊 refresh token 呼叫 OAuth API，第一個成功後舊 token 被作廢，後續 process 收到 `invalid_grant` 並誤發「需要重新登入」通知。此外，所有 process 的 log 都顯示 `[TokenRefresh]`，無法區分來源，增加 debug 困難。

## What Changes

- 在 `invalid_grant` 錯誤處理中，發送通知前重新讀取 credentials 檔案，若已被其他 process 更新則視為成功
- `ClaudeTokenRefreshService` constructor 接受可選的 `processLabel` 參數，用於 logger 標記
- 各 daemon 啟動時傳入各自的 label（如 `Scheduler`、`EventListener`）

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `token-refresh`: 新增跨 process 容錯邏輯與 process label 支援

## Impact

- `src/core/claude-token-refresh.ts` — 核心修改
- `src/interfaces/scheduler-daemon.ts` — 傳入 process label
- `src/interfaces/event-listener-daemon.ts` — 傳入 process label
- `src/interfaces/slack-bot.ts` — 傳入 process label
- `src/interfaces/web-ui.ts` — 傳入 process label（如有呼叫）
