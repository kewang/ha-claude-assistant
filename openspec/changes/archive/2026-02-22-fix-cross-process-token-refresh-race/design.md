## Context

`ClaudeTokenRefreshService` 使用 Promise coalescing 防止同 process 內的並發 refresh（前次 change `fix-token-refresh-race-condition` 實作）。但 Add-on 的 `run.sh` 幾乎同時啟動三個獨立 process（scheduler-daemon、event-listener-daemon、slack-bot），各自有獨立 singleton，5 分鐘定時器幾乎同步。OAuth token rotation 機制下，第一個 process refresh 成功後舊 refresh token 即失效，第二個 process 用同一個舊 token 呼叫 API 會收到 `invalid_grant`，被誤判為需要重新登入。

另外，所有 process 的 `[TokenRefresh]` log 完全相同，無法區分來自哪個 process，debug 時只能靠推理。

## Goals / Non-Goals

**Goals:**
- `invalid_grant` 錯誤時，先確認是否已被其他 process 成功 refresh，避免誤發通知
- 各 process 的 token refresh log 能清楚標示來源

**Non-Goals:**
- 不使用 file lock 或 IPC 做跨 process 鎖（過度設計）
- 不改變 refresh 頻率、時機或 credentials 格式
- 不修改 logger 核心（`createLogger` 本身已支援自訂 module name）

## Decisions

### Decision 1: invalid_grant 後重新讀取 credentials

**選擇**: 在 `doRefreshToken()` 的 `isRefreshTokenExpired` 判定區塊中，發送通知前重新呼叫 `readCredentials()`。若 `expiresAt` 與先前讀到的值不同，且新值不在即將過期範圍內，視為另一個 process 已成功 refresh，直接回傳成功。

**替代方案考慮：**
- **File lock（flock / lockfile）**: 能真正防止並發，但增加複雜度和依賴，且 lock 未釋放時會造成死鎖風險
- **啟動時加入隨機延遲**: 降低同時觸發機率，但無法根除問題
- **只在一個 process 啟動 token refresh**: 需要指定 master process，增加架構耦合

**選擇理由**: 最小改動，不改變任何外部行為，只是讓 `invalid_grant` 的判斷更準確。時序上安全：Process A 成功後先 `writeCredentials()`，Process B 的 catch block 在之後才執行 `readCredentials()`，一定能看到更新。

### Decision 2: constructor 接受 processLabel 參數

**選擇**: `ClaudeTokenRefreshService` constructor 新增可選參數 `processLabel?: string`。有 label 時 logger 建立為 `createLogger('TokenRefresh:Scheduler')`，無 label 時維持 `createLogger('TokenRefresh')`（向下相容）。

**替代方案考慮：**
- **`getTokenRefreshService()` 加參數**: singleton factory 加參數有語意問題（第二次呼叫帶不同參數怎麼辦），但實務上各 process 只會呼叫一次。直接改 constructor 更清楚。

**選擇理由**: 不動 `createLogger` API，只是用不同的 module name 建立 logger。各 daemon 改為 `new ClaudeTokenRefreshService('Scheduler')` 即可。

### Decision 3: getTokenRefreshService 改為接受 label

**選擇**: `getTokenRefreshService(label?: string)` — 第一次呼叫時用 label 建立 instance，之後呼叫忽略 label（因為 singleton 已存在）。

**理由**: 各 daemon 的 `main()` 裡第一次取得 singleton 時傳 label，後續 `executeSchedule()` 等函式呼叫 `getTokenRefreshService()` 不帶 label 直接取得已建立的 instance。

## Risks / Trade-offs

- **[Risk] 兩個 process 都失敗** → 如果兩個 process 的 refresh 都真的失敗（refresh token 真的過期），重新讀取 credentials 也不會看到更新，仍會正確發送通知。不會漏報。
- **[Risk] 短暫時間窗口** → Process B 讀取 credentials 時 Process A 可能還沒寫完。但 `writeFile` 在 Node.js 中是原子性的（寫到 temp 再 rename），且從 log 看 Process A 的 `Credentials updated successfully` 一定在 Process B 的 `invalid_grant` 之前。
