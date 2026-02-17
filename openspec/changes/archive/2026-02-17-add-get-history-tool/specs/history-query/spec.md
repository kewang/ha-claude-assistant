## ADDED Requirements

### Requirement: Query entity history via MCP Tool
The system SHALL provide a `get_history` MCP Tool that allows Claude to query historical state data for Home Assistant entities via the HA History API.

#### Scenario: Query history with entity_id only
- **WHEN** `get_history` is called with `entity_id: "sensor.living_room_temperature"`
- **THEN** the system returns state history for the past 24 hours for that entity

#### Scenario: Query history with custom time range
- **WHEN** `get_history` is called with `entity_id: "sensor.living_room_temperature"`, `start_time: "2026-02-16T00:00:00+08:00"`, `end_time: "2026-02-17T00:00:00+08:00"`
- **THEN** the system returns state history within the specified time range

### Requirement: Support multiple entity query
The system SHALL accept a comma-separated `entity_id` string to query multiple entities in a single request.

#### Scenario: Query multiple entities
- **WHEN** `get_history` is called with `entity_id: "sensor.temperature,sensor.humidity"`
- **THEN** the system returns state history for both entities

### Requirement: Support performance optimization options
The system SHALL support `minimal_response` and `significant_changes_only` options to reduce response size.

#### Scenario: Minimal response enabled by default
- **WHEN** `get_history` is called without specifying `minimal_response`
- **THEN** the system sends `minimal_response` flag to HA API, returning only `state` and `last_changed` for intermediate states

#### Scenario: Significant changes only
- **WHEN** `get_history` is called with `significant_changes_only: true`
- **THEN** the system sends `significant_changes_only` flag to HA API, filtering out minor state changes

### Requirement: HAClient getHistory method
The system SHALL add a `getHistory()` method to HAClient that wraps the HA `GET /api/history/period/<timestamp>` endpoint.

#### Scenario: Call HA History API with correct parameters
- **WHEN** `getHistory("sensor.temp", "2026-02-16T00:00:00+08:00", "2026-02-17T00:00:00+08:00", { minimalResponse: true })` is called
- **THEN** the system sends `GET /api/history/period/2026-02-16T00:00:00+08:00?filter_entity_id=sensor.temp&end_time=2026-02-17T00:00:00+08:00&minimal_response` to HA

### Requirement: Register tool in tools index
The system SHALL register the `get_history` tool in `src/tools/index.ts` so it is available as an MCP tool.

#### Scenario: Tool is available in haTools array
- **WHEN** the MCP server starts
- **THEN** `get_history` is included in the `haTools` array and routed correctly in `executeTool`

### Requirement: Error handling
The system SHALL return a structured error response when the HA History API call fails.

#### Scenario: HA API returns error
- **WHEN** `get_history` is called and the HA API returns an error (e.g., invalid entity_id)
- **THEN** the system returns `{ success: false, error: "<error message>" }`
