## Why

`ClaudeTokenRefreshService` 的 `refreshToken()` 缺少並發控制，當多個元件（定期檢查、Slack Bot、Scheduler、Event Listener）同時偵測到 token 即將過期並發起 refresh 時，第一個成功但第二個會因 refresh token 已被消耗而收到 `invalid_grant`，導致誤判為「需要重新登入」並發送錯誤通知。

## What Changes

- 為 `refreshToken()` 加入 mutex 機制，當一個 refresh 正在進行時，後續呼叫等待並共用同一個結果
- 避免同一個 refresh token 被重複使用導致誤報

## Capabilities

### New Capabilities

（無新增能力）

### Modified Capabilities

- `token-refresh`: 新增並發控制需求，確保同一時間只有一個 refresh 請求在進行

## Impact

- 修改 `src/core/claude-token-refresh.ts`
- 不影響外部 API，不影響其他模組
- 不需要新增依賴套件（純 Promise-based mutex）
