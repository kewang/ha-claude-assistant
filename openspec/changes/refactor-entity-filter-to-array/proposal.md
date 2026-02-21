## Why

`entityFilter` 目前是 `string | null`，當需要過濾多個 entity 時，Claude 會自己發明逗號分隔的寫法（如 `"automation.aaa,automation.bbb"`），但 `matchWildcard()` 把整個字串當成一個 pattern 來比對，導致所有事件都無法匹配。改用 `string[] | null` 更清楚、更好維護，不需要自定分隔符號的約定。

## What Changes

- 修改 `StoredEventSubscription.entityFilter` 型別從 `string | null` 改為 `string[] | null`
- 修改 `manage_event_subscription` tool 的 `entity_filter` 參數從 `string` 改為 `string array`
- 修改 `event-listener-daemon` 的 entity filter 比對邏輯，iterate array 逐一 matchWildcard
- 修改 MCP tool definition（`mcp__ha-assistant__manage_event_subscription`）的 `entity_filter` schema

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `event-subscription-store`: `entityFilter` 型別改為 `string[] | null`
- `manage-event-subscription-tool`: `entity_filter` 參數改為 array type
- `event-listener-daemon`: entity filter 比對改為 iterate array

## Impact

- **修改檔案**: `src/core/event-subscription-store.ts`, `src/tools/manage-event-subscription.ts`, `src/interfaces/event-listener-daemon.ts`
- **BREAKING**: 現有 `event-subscriptions.json` 中的字串格式 `entityFilter` 不再相容，需重建訂閱
- **無新增依賴**
