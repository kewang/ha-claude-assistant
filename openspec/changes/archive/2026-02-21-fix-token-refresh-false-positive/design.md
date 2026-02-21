## Context

`ClaudeTokenRefreshService.refreshToken()` 在呼叫 OAuth API 失敗時，用字串比對 error message 判斷是否為 refresh token 過期。目前的判斷條件過於寬鬆：

```typescript
const isRefreshTokenExpired =
  errorMessage.includes('invalid_grant') ||
  errorMessage.includes('refresh_token') ||
  errorMessage.includes('expired');
```

任何包含 `refresh_token` 或 `expired` 的錯誤（如 API 暫時性 5xx、網路 timeout）都會被誤判，觸發「需要重新登入」通知。

## Goals / Non-Goals

**Goals:**
- 精確判斷 refresh token 是否真的失效：只有 OAuth API 回傳 HTTP 400 + `error: "invalid_grant"` 時才判定
- 暫時性錯誤（5xx、網路問題）走現有的 consecutiveFailures 路徑，不會發「重新登入」通知

**Non-Goals:**
- 不改變 token 刷新的頻率或時機
- 不改變 credentials 寫入格式
- 不新增 retry 機制（現有 consecutiveFailures 已足夠）

## Decisions

### 1. 結構化錯誤傳遞

**選擇**: 在 `callRefreshApi()` 拋出的 Error 物件上附加 `statusCode` 和 `oauthError` 屬性。

**替代方案**: 自訂 Error class — 多一個 class 定義但 bug fix 用不到那麼重。

**理由**: 最小改動。在 catch block 中用 `(error as any).statusCode` 和 `(error as any).oauthError` 即可取得，不需新增 class。

### 2. 精確的失效判斷

**選擇**: 僅在 `statusCode === 400 && oauthError === 'invalid_grant'` 時判定 refresh token 失效。

**理由**: OAuth 2.0 RFC 6749 規定 `invalid_grant` 是 refresh token 無效/過期的標準錯誤碼，且 HTTP 400 是明確的 client error。其他狀況（5xx、網路錯誤）不應判定為永久失效。

## Risks / Trade-offs

- **[漏判] API 可能用其他 error code 表示 refresh token 過期** → 目前 Anthropic OAuth 使用 `invalid_grant`，若未來改變可再補充。漏判只會延遲通知（等 consecutiveFailures >= 3 後仍會通知），不會造成靜默失敗
