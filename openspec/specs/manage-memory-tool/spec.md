### Requirement: 管理記憶 MCP Tool
The system SHALL provide a `manage_memory` MCP Tool for Claude to autonomously manage long-term memories.

#### Scenario: Tool 定義
- **WHEN** the tool is registered
- **THEN** the tool name is `manage_memory` with input schema requiring `action` parameter and optional `id`, `content`, `search` parameters

### Requirement: 儲存記憶
The system SHALL support saving new memories.

#### Scenario: 儲存記憶成功
- **WHEN** `manage_memory` is called with `action: "save"` and `content`
- **THEN** the system creates a new memory via `MemoryStore` and returns success with the created memory

#### Scenario: 缺少 content 參數
- **WHEN** `save` action is called without `content`
- **THEN** the system returns an error indicating content is required

#### Scenario: 記憶已滿
- **WHEN** `save` action is called and memory store is at capacity
- **THEN** the system returns an error indicating memory is full with current count

### Requirement: 列出記憶
The system SHALL support listing all memories.

#### Scenario: 列出所有記憶
- **WHEN** `manage_memory` is called with `action: "list"`
- **THEN** the system returns all memories with count

#### Scenario: 無記憶時列出
- **WHEN** `list` action is called and no memories exist
- **THEN** the system returns an empty list with count 0

### Requirement: 搜尋記憶
The system SHALL support searching memories by keyword.

#### Scenario: 搜尋記憶
- **WHEN** `manage_memory` is called with `action: "search"` and `search` keyword
- **THEN** the system returns matching memories via `MemoryStore.search()`

#### Scenario: 缺少搜尋關鍵字
- **WHEN** `search` action is called without `search` parameter
- **THEN** the system returns an error indicating search keyword is required

### Requirement: 刪除記憶
The system SHALL support deleting memories.

#### Scenario: 刪除記憶成功
- **WHEN** `manage_memory` is called with `action: "delete"` and `id`
- **THEN** the system deletes the memory via `MemoryStore` and returns success

#### Scenario: 刪除不存在的記憶
- **WHEN** `delete` action is called with a non-existing `id`
- **THEN** the system returns an error indicating memory not found

#### Scenario: 缺少 id 參數
- **WHEN** `delete` action is called without `id`
- **THEN** the system returns an error indicating id is required

### Requirement: 更新記憶
The system SHALL support updating existing memories.

#### Scenario: 更新記憶成功
- **WHEN** `manage_memory` is called with `action: "update"`, `id`, and `content`
- **THEN** the system updates the memory via `MemoryStore` and returns success with the updated memory

#### Scenario: 更新不存在的記憶
- **WHEN** `update` action is called with a non-existing `id`
- **THEN** the system returns an error indicating memory not found
