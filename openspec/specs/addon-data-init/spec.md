### Requirement: Add-on 啟動時建立所有資料目錄
`run.sh` SHALL 在啟動 Node.js 服務之前，建立所有必要的 `/data` 子目錄並設定擁有者為 `claude:claude`。

#### Scenario: /data 統一權限設定
- **WHEN** Add-on 啟動執行 `run.sh`
- **THEN** 執行 `chown -R claude:claude /data` 統一設定所有檔案和目錄的擁有者
- **AND** 不再逐一指定個別子目錄的 `chown`

#### Scenario: 目錄已存在時的冪等性
- **WHEN** `/data` 下的任何子目錄或檔案已存在（任何擁有者）
- **THEN** 擁有者被修正為 `claude:claude`，內容不受影響

#### Scenario: 新增資料目錄時的向前相容
- **WHEN** 未來新增新的資料目錄（如 `/data/new-feature/`）
- **THEN** 無需修改 `run.sh` 的權限設定，啟動時自動涵蓋
