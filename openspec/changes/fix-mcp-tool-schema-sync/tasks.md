## 1. 新增轉換工具

- [x] 1.1 建立 `src/utils/tool-schema-converter.ts`，實作 `toMcpTool()` 和 `toMcpTools()` 函式

## 2. 重構 MCP Server

- [x] 2.1 修改 `src/interfaces/mcp-server.ts` 的 `ListToolsRequestSchema` handler，移除手動重複的 tool schema，改用 `import { haTools }` + `toMcpTools(haTools)`
- [x] 2.2 修改 `src/interfaces/mcp-server.ts` 的 `CallToolRequestSchema` handler，移除手動 switch routing，改用 `import { executeTool }` + `executeTool(haClient, name, args)`
- [x] 2.3 清理不再需要的 import（個別 execute 函式和 Input type）

## 3. 修正 Add-on 權限

- [x] 3.1 修改 `claude-ha-assistant/run.sh`，將逐一 `chown` 個別子目錄改為 `chown -R claude:claude /data`

## 4. 修正 File Watcher 和新增 Debug Logging

- [x] 4.1 在 `EventSubscriptionStore.load()` 成功後新增 log，記錄載入的訂閱數量和各訂閱的 entityFilter 狀態
- [x] 4.2 在 `event-listener-daemon.ts` 的 `handleEvent` 新增 debug log，記錄事件的 entity_id、訂閱的 entityFilter、以及過濾決策結果
- [x] 4.3 修正 `EventSubscriptionStore.startWatching()` 移除 `eventType === 'change'` 過濾，接受所有 fs.watch 事件類型
- [x] 4.4 同步修正 `ScheduleStore.startWatching()` 的相同問題

## 5. 改善 entity_filter 使用體驗

- [x] 5.1 更新 `manage_event_subscription` tool 的 `entity_filter` description，指示 Claude 必須先呼叫 `list_entities` 查詢實際 entity_id，不要猜測或自行拼湊

## 6. 測試

- [x] 6.1 建立 `tests/tool-schema-converter.test.ts`，測試轉換函式基本功能
- [x] 6.2 新增迴歸測試：確認 `entity_filter` 為 `array` 型別、`get_history` 包含 `minimal_response` 和 `significant_changes_only`
- [x] 6.3 執行 `npm test` 確認所有測試通過
- [x] 6.4 執行 `npm run build` 確認 TypeScript 編譯成功
