## 1. 核心實作

- [x] 1.1 在 `ClaudeTokenRefreshService` 新增 `refreshPromise: Promise<RefreshResult> | null` 欄位
- [x] 1.2 修改 `refreshToken()` 方法：進入時檢查 `refreshPromise`，若已有則直接 await 並返回；否則建立新的 refresh Promise 並存入欄位，完成後在 `finally` 中清除

## 2. 測試

- [x] 2.1 新增測試：並發呼叫 `refreshToken()` 時只發送一次 API 請求，所有呼叫者收到相同結果
- [x] 2.2 新增測試：refresh 完成後（成功或失敗），`refreshPromise` 被清除，後續呼叫可發起新的 refresh
