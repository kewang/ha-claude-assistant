## 1. MemoryStore 核心

- [x] 1.1 建立 `src/core/memory-store.ts`，實作 `MemoryStore` class（init, add, getAll, update, delete, search）和 `buildPromptWithMemory()` 輔助函式
- [x] 1.2 建立 `tests/memory-store.test.ts`，測試 CRUD 操作、關鍵字搜尋、容量上限、環境感知路徑、prompt 注入格式

## 2. MCP Tool

- [x] 2.1 建立 `src/tools/manage-memory.ts`，實作 `manage_memory` tool 定義和 executor（save, list, search, update, delete）
- [x] 2.2 更新 `src/tools/index.ts`，註冊 `manage_memory` tool 到 `haTools` 陣列和 `executeTool` switch

## 3. 介面整合

- [x] 3.1 修改 `src/interfaces/slack-bot.ts`，在訊息處理流程中加入 `MemoryStore` 初始化和 `buildPromptWithMemory()` 記憶注入
- [x] 3.2 修改 `src/interfaces/scheduler-daemon.ts`，在排程執行時注入記憶到 prompt

## 4. 驗證

- [x] 4.1 執行 `npm test` 確認所有測試通過
- [x] 4.2 執行 `npm run build` 確認編譯成功
