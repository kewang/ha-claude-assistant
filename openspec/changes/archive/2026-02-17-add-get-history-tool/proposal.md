## Why

目前系統只能查詢實體的「當前狀態」，無法回答「過去 24 小時客廳溫度變化」、「昨天冷氣開了幾次」等歷史相關的問題。歷史查詢是使用者最常問到的功能之一，HA 已有完整的 History API 可直接使用。

## What Changes

- 新增 `get_history` MCP Tool，讓 Claude 可以查詢 HA 實體的歷史狀態資料
- 在 HAClient 新增 `getHistory()` 方法，封裝 HA History API (`GET /api/history/period/<timestamp>`)
- 支援指定時間範圍、多實體查詢、以及 `minimal_response` / `significant_changes_only` 等效能優化參數

## Capabilities

### New Capabilities
- `history-query`: 查詢 Home Assistant 實體歷史狀態資料的能力，包含時間範圍篩選與效能優化選項

### Modified Capabilities
（無）

## Impact

- **新增檔案**: `src/tools/get-history.ts`
- **修改檔案**: `src/core/ha-client.ts`（新增 `getHistory()` 方法）、`src/tools/index.ts`（註冊新 tool）
- **測試**: 新增 `tests/get-history.test.ts`
- **API 依賴**: HA History API (`GET /api/history/period/<timestamp>`)，HA 核心內建，無需額外安裝
