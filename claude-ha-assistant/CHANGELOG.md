# Changelog

所有重大變更都會記錄在這個檔案中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，
版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [1.1.2] - 2026-02-04

### 修復
- **Slack Bot 連線穩定性**：修復 `@slack/socket-mode` 狀態機錯誤導致程序崩潰的問題
  - 新增自動重連機制，使用指數退避策略（1s → 2s → 4s → ... → 60s）
  - 最多嘗試 10 次重連，超過後發送 Slack 通知
  - 捕捉 `Unhandled event 'server explicit disconnect' in state 'connecting'` 錯誤

### 改進
- **測試指令優化**：`npm test` 現在會自動執行並退出，不再需要按 `q` 結束
  - 新增 `npm run test:watch` 供 watch 模式使用

## [1.1.1] - 2026-02-04

### 改進
- **動態 OAuth 設定提取**：自動從 Claude CLI binary 提取 CLIENT_ID 和 TOKEN_URL
  - 使用 `strings` 命令從 binary 搜尋，自動與 CLI 版本同步
  - 提取失敗時使用 fallback 值確保穩定性
- **修正 TOKEN_URL**：更新為正確的 `platform.claude.com` endpoint

### 技術變更
- 新增 `binutils` 套件（提供 `strings` 命令）
- 新增 `claude-oauth-config.ts` 模組處理動態設定提取

## [1.1.0] - 2025-02-03

### 新增
- **自動 Token 刷新機制**：系統會自動維護 Claude OAuth token 有效性
  - 每 5 分鐘檢查 token 狀態
  - 在 access token 過期前 30 分鐘自動刷新
  - Refresh token 過期時發送 Slack 通知提醒重新登入

### 改進
- 移除啟動時的阻塞式登入等待，改為非阻塞警告訊息
- 服務可在未登入狀態下啟動，登入後自動生效

### 用戶體驗
- 首次登入後，系統自動維護 token，無需手動介入
- Refresh token 過期（約 7-30 天）時會收到 Slack 通知

## [1.0.0] - 2025-01-15

### 新增
- 初始版本發布
- Slack Bot 整合，支援自然語言控制智慧家庭
- 排程服務，支援定時任務
- MCP Server 整合 Home Assistant API
- 支援 amd64、aarch64、armv7、armhf、i386 架構
