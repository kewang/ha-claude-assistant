# Changelog

## [1.4.14] - 2026-02-07

### Changed
- Claude CLI timeout 從 1 分鐘增加到 3 分鐘（Slack Bot 和 Scheduler）
- 支援 `CLAUDE_TIMEOUT_MS` 環境變數自訂 timeout
- Slack Bot 收到訊息後先回覆「處理中」提示，完成後更新為正式回覆

### Fixed
- 修正文件中 ingress port 寫死 8099 的問題（實際由 Supervisor 動態指派）

## [1.4.13] - 2026-02-07

### Added
- **Web UI 登入介面**：透過 HA 側邊欄即可完成 Claude 登入，不再需要手動進容器操作
  - OAuth PKCE flow 實作，安全地完成授權流程
  - 即時顯示登入狀態與 Token 到期時間
  - 支援手動刷新 Token
  - 支援深色/淺色主題
- HA Ingress 整合，Add-on 安裝後自動出現在側邊欄
- 使用 Supervisor API 動態取得 ingress port

### Fixed
- 修正 credentials 格式與 CLI 一致（`expiresAt` 為 Unix ms 數字、`scopes` 為字串陣列、不存入巢狀物件）
- 修正 OAuth token exchange/refresh 使用 `application/json` 格式
- 修正 authorization code 需移除 `#state` fragment（callback page 回傳 `code#state` 格式）
- 修正 Add-on 中 credentials 檔案權限（`chown claude:claude`）
- 修正 OAuth authorize endpoint、scope、state 參數等多項相容性問題
- Web UI `parseBody()` 同時支援 JSON 和 form-urlencoded 格式

## [1.3.1] - 2026-02-04

### Fixed
- 修正 Docker build cache 導致 Add-on 使用舊版程式碼

## [1.3.0] - 2026-02-04

### Added
- 新增 release skill 自動化版本發佈流程

## [1.2.0] - 2026-02-03

### Added
- 統一版號管理，`npm version` 自動同步 `config.yaml`
- 從 Claude CLI binary 動態提取 OAuth 設定
- 統一 Logger，所有輸出加入時間戳記
- OAuth token 自動刷新機制（每 5 分鐘檢查，過期前 30 分鐘刷新）
- 排程服務 token 過期重試機制
- Slack Bot 自動重連機制（指數退避策略）

### Fixed
- 修正 token refresh 遺失必要欄位
- 降低 token refresh 日誌雜訊
- 修正 vitest 測試完成後無法正常退出
