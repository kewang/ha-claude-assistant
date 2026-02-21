## 1. 修改錯誤處理

- [x] 1.1 修改 `src/core/claude-token-refresh.ts` 的 `callRefreshApi()` — 在 `!response.ok` 時解析 JSON 回應，將 `statusCode` 和 `oauthError` 附加到 Error 物件
- [x] 1.2 修改 `src/core/claude-token-refresh.ts` 的 `refreshToken()` catch block — 將 `isRefreshTokenExpired` 判斷改為 `statusCode === 400 && oauthError === 'invalid_grant'`

## 2. 驗證

- [x] 2.1 執行 `npm test` 確認所有測試通過
- [x] 2.2 執行 `npm run build` 確認編譯成功
