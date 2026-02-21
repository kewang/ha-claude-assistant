## Context

`entityFilter` 是事件訂閱的過濾條件，用來限制只處理特定 entity 的事件。目前型別為 `string | null`，只能放一個 wildcard pattern。使用者需要過濾多個 entity 時沒有標準做法，Claude 自行用逗號分隔但比對邏輯不支援。

## Goals / Non-Goals

**Goals:**
- `entityFilter` 改為 `string[] | null`，每個元素是一個獨立的 wildcard pattern
- MCP tool 的 `entity_filter` 參數改為 array type，讓 Claude 傳入陣列
- event-listener-daemon 的比對邏輯改為 iterate array，任一 pattern 匹配即通過

**Non-Goals:**
- 不處理舊資料遷移（使用者自行重建訂閱）
- 不改變 wildcard 比對邏輯（`matchWildcard` 函式保持不變）

## Decisions

### 1. entityFilter 型別改為 `string[] | null`

**選擇**: 直接改 `StoredEventSubscription` interface 的 `entityFilter` 為 `string[] | null`。`null` 表示不過濾，空陣列 `[]` 也視為不過濾。

**理由**: array 語意清楚，每個元素就是一個 pattern，不需要約定分隔符號。

### 2. Tool 參數改為 array

**選擇**: MCP tool schema 的 `entity_filter` 改為 `{ type: 'array', items: { type: 'string' } }`。

**理由**: 讓 Claude 直接傳入陣列，避免自行拼接字串再拆分。

### 3. 不做舊資料遷移

**選擇**: 不處理舊的字串格式 entityFilter。

**理由**: 使用者選擇直接重建訂閱，減少程式碼複雜度。

## Risks / Trade-offs

- **[Breaking Change] 現有訂閱需重建** → 使用者知情並接受，訂閱數量不多
