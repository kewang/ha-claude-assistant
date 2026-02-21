## Context

目前系統透過 `ConversationStore` 提供短期對話記憶（per-thread，最多 20 輪 / 8000 字元 / 7 天），但缺乏跨對話的長期記憶。使用者每次開新 thread 或 session，助理都不記得之前的互動。

現有架構中，所有介面（Slack Bot、CLI、Scheduler）透過 `claude --print` 呼叫 Claude CLI，並以 `buildPromptWithHistory()` 注入短期對話歷史。長期記憶需要在這個流程中額外注入。

## Goals / Non-Goals

**Goals:**
- 讓助理能跨對話記住使用者偏好、設備暱稱、生活習慣等資訊
- Claude 能自主判斷什麼值得記住，透過 `manage_memory` tool 操作
- 使用者能主動要求「記住」或「忘掉」某件事
- 記憶在所有介面（Slack、CLI、Scheduler）間共享
- 每次對話自動注入所有記憶作為上下文

**Non-Goals:**
- 語義搜尋 / 向量資料庫 — JSON 全文搜尋即可滿足需求
- 記憶分類/標籤系統 — 保持簡單，用純文字內容
- 記憶權重/優先級 — 初期不做排序，全部注入
- 自動遺忘機制 — 記憶不會自動過期，需手動刪除
- 多用戶記憶隔離 — 目前為單用戶系統

## Decisions

### 1. 儲存格式：JSON 陣列

**選擇**: 使用 JSON 檔儲存記憶陣列，與 `ScheduleStore` 相同模式。

**替代方案**: SQLite — 過度複雜，目前規模不需要；純文字檔 — 缺乏結構化查詢能力。

**理由**: 與現有 `ScheduleStore`、`ConversationStore` 一致的模式，降低維護成本。記憶數量預估在數十到數百筆，JSON 完全能勝任。

### 2. 記憶結構：簡單的 content 文字

**選擇**: 每筆記憶包含 `id`、`content`（純文字）、`createdAt`、`updatedAt`。

**替代方案**: 加入 category/tags 欄位 — 增加複雜度但初期收益低。

**理由**: 讓 Claude 自由決定記憶內容的格式和粒度。搜尋用關鍵字比對即可。Claude 自己會在 content 中包含足夠的上下文。

### 3. 記憶注入方式：全量注入到 system prompt 前綴

**選擇**: 在每次 `claude --print` 前，將所有記憶拼接成一段文字，作為 prompt 的一部分注入。使用 `<long_term_memory>` XML tag 包裹。

**替代方案**: 只注入相關記憶（需要搜尋匹配）— 增加複雜度，且 Claude CLI 模式下難以預判哪些記憶相關。

**理由**: 記憶數量預估不多（< 100 筆），全量注入最簡單可靠。未來如果記憶量增長，可以加入搜尋過濾機制。

### 4. 記憶容量上限

**選擇**: 設定最大記憶數量上限（預設 100 筆）和最大總字元數（預設 10000 字元），透過環境變數可調整。

**理由**: 防止記憶無限增長佔用 prompt token。100 筆記憶約 5000-10000 字元，在 Claude 的 context window 中佔比很小。

### 5. 新增 `buildPromptWithMemory()` 輔助函式

**選擇**: 在 `MemoryStore` 中提供 `buildPromptWithMemory()` 函式，將記憶格式化為可注入 prompt 的字串。Slack Bot 和 Scheduler 在呼叫 `buildPromptWithHistory()` 之前，先用此函式組合記憶前綴。

**理由**: 保持與現有 `buildPromptWithHistory()` 相同的模式，各介面只需多一行呼叫。

### 6. MCP Server 同步更新

**選擇**: `manage_memory` tool 不需要 HAClient，與 `manage_schedule` 相同模式，直接操作 store。

**理由**: 記憶管理是獨立於 HA 的功能，不需要 HA 連線。

## Risks / Trade-offs

- **[記憶品質] Claude 可能記住不重要的資訊** → 透過 tool description 引導 Claude 只記住有長期價值的偏好和事實，使用者可隨時刪除
- **[Prompt 膨脹] 記憶量增長後佔用 token** → 設定容量上限，超過時需手動管理。未來可加入摘要壓縮機制
- **[一致性] 多個程序同時寫入同一檔案** → 與 ScheduleStore 相同風險，因為 Slack Bot 和 MCP Server 可能同時操作。目前可接受，因為記憶操作頻率很低
- **[隱私] 記憶可能包含敏感資訊** → 記憶存在本地 JSON 檔，與其他資料（排程、對話歷史）相同安全等級
