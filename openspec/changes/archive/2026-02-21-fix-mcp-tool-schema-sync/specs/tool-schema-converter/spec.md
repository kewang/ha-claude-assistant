## ADDED Requirements

### Requirement: Anthropic Tool 轉 MCP Tool
The system SHALL provide a conversion function that transforms Anthropic SDK `Tool` definitions to MCP-compatible tool definitions.

#### Scenario: 單一 Tool 轉換
- **WHEN** `toMcpTool()` is called with an Anthropic SDK `Tool` object
- **THEN** the system returns an object with `name`, `description`, and `inputSchema` (camelCase)
- **AND** the `inputSchema` content SHALL be identical to the original `input_schema` content

#### Scenario: 批次 Tool 轉換
- **WHEN** `toMcpTools()` is called with an array of Anthropic SDK `Tool` objects
- **THEN** the system returns an array of MCP-compatible tool objects with the same length and order

#### Scenario: 保留 array 型別屬性
- **WHEN** a Tool 的 `input_schema` 包含 `type: 'array'` 的屬性（如 `entity_filter`）
- **THEN** 轉換後的 `inputSchema` SHALL 保留 `type: 'array'` 和 `items` 定義
