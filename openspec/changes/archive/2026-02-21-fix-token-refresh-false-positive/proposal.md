## Why

Token 刷新服務在 `refreshToken()` 失敗時，用過於寬鬆的字串比對（`includes('refresh_token')` / `includes('expired')`）判斷 refresh token 是否過期，導致暫時性 API 錯誤（網路問題、5xx、timeout）被誤判為 refresh token 失效，發送「需要重新登入」的 Slack 通知。實際上 token 仍然有效。

## What Changes

- 修改 `callRefreshApi()` 的錯誤處理，解析 API 回應的 JSON `error` 欄位和 HTTP status code，提供結構化錯誤資訊
- 修改 `refreshToken()` 的錯誤判斷邏輯，僅在 HTTP 400 + `error === "invalid_grant"` 時才判定 refresh token 失效

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `token-refresh`: 精確化刷新失敗的錯誤判斷條件，區分「refresh token 真正失效」與「暫時性 API 錯誤」

## Impact

- **修改檔案**: `src/core/claude-token-refresh.ts`
- **無破壞性變更**: 縮小誤判範圍，不影響正確判斷 `invalid_grant` 的行為
- **無新增依賴**
