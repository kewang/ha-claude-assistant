## 1. HAClient 擴充

- [x] 1.1 在 `src/core/ha-client.ts` 新增 `getHistory(entityId, startTime?, endTime?, options?)` 方法，呼叫 `GET /api/history/period/<timestamp>` 並正確組裝 query parameters

## 2. MCP Tool 實作

- [x] 2.1 建立 `src/tools/get-history.ts`，定義 `getHistoryTool` Tool 物件（name、description、input_schema）、`GetHistoryInput` 介面、`executeGetHistory()` 函數
- [x] 2.2 在 `src/tools/index.ts` 註冊新 tool：匯入、加入 `haTools` 陣列、加入 `executeTool` switch case、匯出型別

## 3. 測試

- [x] 3.1 建立 `tests/get-history.test.ts`，測試 `executeGetHistory()` 的各種情境（預設時間範圍、自訂時間範圍、多實體查詢、錯誤處理）
- [x] 3.2 執行 `npm test` 確認所有測試通過

## 4. 建置驗證

- [x] 4.1 執行 `npm run build` 確認 TypeScript 編譯無錯誤
