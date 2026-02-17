## Context

目前 HAClient 提供 `getStates()` / `getState()` 等即時查詢方法，MCP Tools 也只有 `list_entities`、`get_state`、`call_service`、`manage_schedule`。使用者無法透過 Claude 查詢歷史資料。

HA 提供 `GET /api/history/period/<timestamp>` REST API，回傳指定時間範圍內實體的狀態變化陣列。

## Goals / Non-Goals

**Goals:**
- 讓 Claude 能查詢任意實體的歷史狀態資料
- 支援時間範圍篩選（開始/結束時間）
- 支援多實體同時查詢
- 提供效能優化選項（minimal_response、significant_changes_only）

**Non-Goals:**
- 不做歷史資料的統計/聚合運算（交由 Claude 自行分析回傳的原始資料）
- 不做歷史資料的圖表視覺化
- 不做長時間範圍的分頁查詢

## Decisions

### 1. Tool 參數設計

**選擇**: `entity_id`（必填）、`start_time`（選填，預設過去 24 小時）、`end_time`（選填）、`minimal_response`（選填，預設 true）、`significant_changes_only`（選填，預設 false）

**理由**: `entity_id` 為必填以避免回傳過多資料。`minimal_response` 預設開啟以減少回傳量，大多數查詢不需要完整 attributes。時間格式使用 ISO 8601 字串，Claude 能自然理解。

**替代方案**: 讓 `entity_id` 也是選填 — 但不指定會回傳所有實體歷史，資料量過大且用途不明確。

### 2. 回傳格式

**選擇**: 將 HA API 回傳的巢狀陣列攤平為統一格式，每筆紀錄包含 `entity_id`、`state`、`last_changed`、`attributes`（若有）。

**理由**: HA API 回傳 `HAState[][]`（每個實體一個子陣列），直接攤平後 Claude 更容易理解和分析。

### 3. HAClient 方法設計

**選擇**: 在 HAClient 新增 `getHistory(entityId, startTime?, endTime?, options?)` 方法。

**理由**: 遵循現有模式，所有 HA API 呼叫都封裝在 HAClient 中。

## Risks / Trade-offs

- **[大量資料回傳]** → 預設 `minimal_response=true` 減少資料量；`entity_id` 為必填避免全量查詢
- **[時間範圍過長]** → 不做限制，由 Claude 自行判斷合理的時間範圍；HA 本身有效能保護
- **[HA 版本相容性]** → History API 是 HA 核心功能，所有版本都支援
