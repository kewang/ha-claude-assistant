## ADDED Requirements

### Requirement: 事件訂閱持久化儲存
The system SHALL provide an `EventSubscriptionStore` class that persists event subscription settings to a JSON file.

#### Scenario: 初始化 store
- **WHEN** `init()` is called
- **THEN** the system creates the data directory if needed and loads existing subscriptions from the JSON file

#### Scenario: 資料路徑（Add-on 環境）
- **WHEN** running in Add-on environment
- **THEN** the system uses `/data/event-subscriptions/event-subscriptions.json` as the data path

#### Scenario: 資料路徑（一般環境）
- **WHEN** running in standalone environment
- **THEN** the system uses `data/event-subscriptions.json` relative to the project root

### Requirement: 訂閱設定 CRUD 操作
The system SHALL support create, read, update, and delete operations on event subscriptions.

#### Scenario: 建立訂閱
- **WHEN** `create({ name, eventType, entityFilter, description, enabled })` is called
- **THEN** the system generates a unique ID, saves the subscription to the JSON file, and returns the created subscription with `id`, `createdAt`, `updatedAt` fields

#### Scenario: 取得所有訂閱
- **WHEN** `getAll()` is called
- **THEN** the system returns an array of all stored subscriptions

#### Scenario: 取得單一訂閱
- **WHEN** `get(id)` is called
- **THEN** the system returns the subscription with the given ID, or `undefined` if not found

#### Scenario: 依名稱搜尋訂閱
- **WHEN** `findByName(name)` is called
- **THEN** the system returns the first subscription whose name contains the search string (case-insensitive)

#### Scenario: 更新訂閱
- **WHEN** `update(id, updates)` is called
- **THEN** the system merges the updates, sets `updatedAt` to current time, and saves to file

#### Scenario: 刪除訂閱
- **WHEN** `delete(id)` is called with an existing ID
- **THEN** the system removes the subscription and saves to file

#### Scenario: 刪除不存在的訂閱
- **WHEN** `delete(id)` is called with a non-existing ID
- **THEN** the system returns `false`

### Requirement: 啟用/停用訂閱
The system SHALL support enabling and disabling individual subscriptions.

#### Scenario: 啟用訂閱
- **WHEN** `enable(id)` is called
- **THEN** the system sets the subscription's `enabled` to `true` and saves

#### Scenario: 停用訂閱
- **WHEN** `disable(id)` is called
- **THEN** the system sets the subscription's `enabled` to `false` and saves

### Requirement: 訂閱資料模型
The system SHALL store subscriptions with the following fields.

#### Scenario: 訂閱欄位定義
- **WHEN** a subscription is created
- **THEN** it SHALL contain the following fields:
  - `id`: string — 唯一識別碼
  - `name`: string — 訂閱名稱（供使用者辨識）
  - `eventType`: string — HA 事件類型（如 `"automation_triggered"`、`"state_changed"`）
  - `entityFilter`: string[] | null — 可選的 entity_id 過濾條件陣列，每個元素為一個 pattern（支援 `*` 萬用字元），`null` 或空陣列表示不過濾
  - `description`: string — 給 Claude 的提示，描述如何生成通知訊息
  - `enabled`: boolean — 是否啟用
  - `createdAt`: string — ISO 8601 建立時間
  - `updatedAt`: string — ISO 8601 更新時間

### Requirement: 檔案變更監控
The system SHALL support watching the JSON file for external changes.

#### Scenario: 檔案變更重載
- **WHEN** the JSON file is modified externally and `startWatching(onChange)` has been called
- **THEN** the system reloads subscriptions from file (with 500ms debounce) and invokes the onChange callback

#### Scenario: 停止監控
- **WHEN** `stopWatching()` is called
- **THEN** the system stops file watching and clears all callbacks
