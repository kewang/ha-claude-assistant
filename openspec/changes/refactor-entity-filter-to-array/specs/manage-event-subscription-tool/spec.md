## MODIFIED Requirements

### Requirement: MCP Tool 定義
The system SHALL provide a `manage_event_subscription` MCP tool for managing event subscriptions via Claude.

#### Scenario: Tool 定義
- **WHEN** the MCP server registers tools
- **THEN** it SHALL include `manage_event_subscription` with the following input schema:
  - `action`: required — `"create"` | `"list"` | `"enable"` | `"disable"` | `"delete"`
  - `name`: optional — 訂閱名稱（create 時必填）
  - `event_type`: optional — HA 事件類型（create 時必填，如 `"automation_triggered"`、`"state_changed"`）
  - `entity_filter`: optional — entity_id 過濾條件陣列（`{ type: 'array', items: { type: 'string' } }`），每個元素為一個 pattern，支援 `*` 萬用字元
  - `description`: optional — 給 Claude 的通知生成提示
  - `id`: optional — 訂閱 ID（enable/disable/delete 時使用）
