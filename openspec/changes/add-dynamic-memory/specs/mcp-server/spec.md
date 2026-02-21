## MODIFIED Requirements

### Requirement: 工具註冊
The system SHALL register all HA tools and respond to tool listing requests.

#### Scenario: ListTools 請求
- **WHEN** a `ListToolsRequest` is received
- **THEN** the system returns the `haTools` array containing all 7 tool definitions:
  - `list_entities`
  - `get_state`
  - `call_service`
  - `manage_schedule`
  - `get_history`
  - `manage_event_subscription`
  - `manage_memory`
