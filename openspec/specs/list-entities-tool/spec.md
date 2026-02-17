### Requirement: 列出實體 MCP Tool
The system SHALL provide a `list_entities` MCP Tool for querying Home Assistant entities with optional filtering.

#### Scenario: 列出所有實體
- **WHEN** `list_entities` is called without parameters
- **THEN** the system returns all entities from `client.getStates()`

#### Scenario: 依 domain 過濾
- **WHEN** `list_entities` is called with `domain: "light"`
- **THEN** the system returns only entities matching the specified domain via `client.getStatesByDomain()`

#### Scenario: 依關鍵字搜尋
- **WHEN** `list_entities` is called with `search: "客廳"`
- **THEN** the system returns entities whose `entity_id` or `friendly_name` matches the search query via `client.searchEntities()`

#### Scenario: 同時使用 domain 和 search
- **WHEN** `list_entities` is called with both `domain: "light"` and `search: "客廳"`
- **THEN** the system first filters by domain, then further filters by search query

### Requirement: 回應格式
The system SHALL return a simplified entity list with essential attributes only.

#### Scenario: 成功回應
- **WHEN** entities are found
- **THEN** the system returns:
  ```json
  {
    "success": true,
    "count": 10,
    "entities": [
      {
        "entity_id": "light.living_room",
        "friendly_name": "客廳燈",
        "state": "on",
        "attributes": {
          "device_class": "light",
          "unit": "lx"
        }
      }
    ]
  }
  ```

#### Scenario: 精簡 attributes
- **WHEN** mapping entity attributes
- **THEN** the system only includes `device_class` and `unit_of_measurement` (renamed to `unit`)
