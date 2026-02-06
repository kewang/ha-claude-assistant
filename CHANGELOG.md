# Changelog

## [1.4.0] - 2026-02-06

### Added
- **Web UI 登入介面**：透過 HA 側邊欄即可完成 Claude 登入，不再需要手動進容器操作
  - OAuth PKCE flow 實作，安全地完成授權流程
  - 即時顯示登入狀態與 Token 到期時間
  - 支援手動刷新 Token
  - 支援深色/淺色主題
- HA Ingress 整合，Add-on 安裝後自動出現在側邊欄

## [1.3.1] - 2025-12-20

### Fixed
- Fix Docker build cache causing stale code in Add-on

## [1.3.0] - 2025-12-20

### Added
- Add release skill for automated version publishing

## [1.2.0] - 2025-12-19

### Added
- Add unified version management with auto-sync
