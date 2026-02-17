### Requirement: 呼叫服務 MCP Tool
The system SHALL provide a `call_service` MCP Tool for controlling Home Assistant devices by invoking HA services.

#### Scenario: 呼叫服務
- **WHEN** `call_service` is called with `domain: "light"`, `service: "turn_on"`, `entity_id: "light.bedroom"`, `data: { brightness: 255 }`
- **THEN** the system merges `entity_id` and `data` into service data and calls `client.callService()`

#### Scenario: 無 entity_id 的服務呼叫
- **WHEN** `call_service` is called with only `domain` and `service` (no `entity_id`)
- **THEN** the system calls the service with only the `data` parameter

#### Scenario: 無額外 data 的服務呼叫
- **WHEN** `call_service` is called with `domain`, `service`, and `entity_id` but no `data`
- **THEN** the system calls the service with only `{ entity_id }`

### Requirement: 回應格式
The system SHALL return the changed states after service execution.

#### Scenario: 成功回應
- **WHEN** the service call succeeds
- **THEN** the system returns:
  ```json
  {
    "success": true,
    "message": "成功呼叫 light.turn_on",
    "changed_states": [
      {
        "entity_id": "light.bedroom",
        "new_state": "on",
        "friendly_name": "臥室燈"
      }
    ]
  }
  ```

#### Scenario: 服務呼叫失敗
- **WHEN** the service call fails
- **THEN** the system returns `{ success: false, error: "<error message>" }`
