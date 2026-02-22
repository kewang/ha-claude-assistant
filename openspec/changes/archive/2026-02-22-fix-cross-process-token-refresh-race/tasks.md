## 1. Token Refresh 跨 Process 容錯

- [x] 1.1 修改 `ClaudeTokenRefreshService` constructor 接受可選的 `processLabel?: string` 參數，有 label 時建立 `createLogger('TokenRefresh:${label}')`，無 label 時維持 `createLogger('TokenRefresh')`
- [x] 1.2 修改 `getTokenRefreshService(label?: string)` — 第一次呼叫時用 label 建立 instance，後續呼叫回傳既有 instance
- [x] 1.3 在 `doRefreshToken()` 記錄 refresh 前讀到的 `expiresAt` 值
- [x] 1.4 在 `doRefreshToken()` 的 `isRefreshTokenExpired` 區塊中，發送通知前重新呼叫 `readCredentials()` 檢查 `expiresAt` 是否已被其他 process 更新。若已更新且不在 expiring-soon 範圍內，重置 `consecutiveFailures` 並回傳成功

## 2. 各 Daemon 傳入 Process Label

- [x] 2.1 `scheduler-daemon.ts` — `getTokenRefreshService('Scheduler')`
- [x] 2.2 `event-listener-daemon.ts` — `getTokenRefreshService('EventListener')`
- [x] 2.3 `slack-bot.ts` — `getTokenRefreshService('SlackBot')`
- [x] 2.4 `web-ui.ts` — `getTokenRefreshService('WebUI')`（若有呼叫）

## 3. 測試

- [x] 3.1 新增測試：`invalid_grant` 後 credentials 已被更新 → 回傳成功、不發通知
- [x] 3.2 新增測試：`invalid_grant` 後 credentials 未更新 → 回傳失敗、發通知（原行為）
- [x] 3.3 新增測試：帶 label 建立 service 時 logger module name 為 `TokenRefresh:Scheduler`
- [x] 3.4 確認既有測試通過 `npm test`
