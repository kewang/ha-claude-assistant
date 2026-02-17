### Requirement: 取得狀態 MCP Tool
The system SHALL provide a `get_state` MCP Tool for retrieving detailed state information of a single Home Assistant entity.

#### Scenario: 取得實體詳細狀態
- **WHEN** `get_state` is called with `entity_id: "sensor.living_room_temperature"`
- **THEN** the system returns the full state and all attributes from `client.getState()`

### Requirement: 回應格式
The system SHALL return comprehensive entity state information.

#### Scenario: 成功回應
- **WHEN** the entity exists
- **THEN** the system returns:
  ```json
  {
    "success": true,
    "entity_id": "sensor.temperature",
    "state": "22.5",
    "friendly_name": "溫度感測器",
    "attributes": {
      "unit_of_measurement": "°C",
      "device_class": "temperature"
    },
    "last_changed": "2026-02-17T10:30:00+08:00",
    "last_updated": "2026-02-17T10:30:00+08:00"
  }
  ```

#### Scenario: 實體不存在
- **WHEN** the entity does not exist in HA
- **THEN** the system returns `{ success: false, error: "<error message>" }`
