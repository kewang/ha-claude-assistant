## MODIFIED Requirements

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
