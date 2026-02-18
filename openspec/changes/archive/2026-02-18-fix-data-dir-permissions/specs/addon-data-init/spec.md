## ADDED Requirements

### Requirement: Add-on 啟動時建立所有資料目錄
`run.sh` SHALL 在啟動 Node.js 服務之前，建立所有必要的 `/data` 子目錄並設定擁有者為 `claude:claude`。

#### Scenario: conversations 目錄初始化
- **WHEN** Add-on 啟動執行 `run.sh`
- **THEN** `/data/conversations` 目錄存在且擁有者為 `claude:claude`

#### Scenario: event-subscriptions 目錄初始化
- **WHEN** Add-on 啟動執行 `run.sh`
- **THEN** `/data/event-subscriptions` 目錄存在且擁有者為 `claude:claude`

#### Scenario: 目錄已存在時的冪等性
- **WHEN** `/data/conversations` 或 `/data/event-subscriptions` 已存在（任何擁有者）
- **THEN** 目錄擁有者被修正為 `claude:claude`，內容不受影響
