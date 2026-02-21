## Context

`ClaudeTokenRefreshService` 是 singleton，被多個元件共用：
- `performCheck()` 每 5 分鐘定期檢查
- `slack-bot.ts` 處理訊息前呼叫 `ensureValidToken()`
- `scheduler-daemon.ts` 執行排程前呼叫 `ensureValidToken()`
- `event-listener-daemon.ts` 處理事件前呼叫 `ensureValidToken()`

當 token 即將過期時，多個元件可能在同一秒內同時呼叫 `refreshToken()`。OAuth refresh token 是一次性的，第一個請求成功後 refresh token 就失效，後續請求會收到 `invalid_grant`，被誤判為需要重新登入。

## Goals / Non-Goals

**Goals:**
- 確保同一時間只有一個 refresh 請求在進行
- 並發的 refresh 呼叫共用同一個結果，避免重複請求
- 零新增依賴，使用 Promise-based mutex

**Non-Goals:**
- 不改變 refresh 策略（仍是過期前 30 分鐘刷新）
- 不改變外部 API 介面
- 不處理跨 process 的並發（各 daemon 是獨立 process，各自有 singleton）

## Decisions

### Decision 1: Promise coalescing（Promise 合併）

在 `refreshToken()` 中維護一個 `refreshPromise` 欄位。當 refresh 正在進行時，後續呼叫直接 `await` 同一個 Promise，而不是發起新的 API 請求。

**替代方案考慮：**
- **Semaphore/Mutex library**: 需要新增依賴，對此場景過於複雜
- **Lock file**: 跨 process 可用但實作複雜，且各 daemon 是獨立 process 各有 singleton，不需要跨 process 鎖

**選擇 Promise coalescing 的原因：** 最簡單、零依賴、完全符合需求（同一 process 內的並發控制）。

## Risks / Trade-offs

- **[Risk] 跨 process 並發** → 各 daemon 是獨立 Node.js process，各有自己的 singleton instance，無法共用 Promise。但實務上各 daemon 分開啟動，不太會同時觸發 refresh。此風險可接受。
- **[Risk] Promise 永久掛起** → 使用 `finally` 確保 `refreshPromise` 一定被清除，即使發生未預期的錯誤。
