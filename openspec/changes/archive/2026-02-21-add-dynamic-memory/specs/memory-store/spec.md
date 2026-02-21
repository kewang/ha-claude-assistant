## ADDED Requirements

### Requirement: 記憶持久化儲存
The system SHALL provide a `MemoryStore` class for persistent long-term memory storage using JSON file.

#### Scenario: 初始化記憶儲存
- **WHEN** `init()` is called
- **THEN** the system creates the data directory if missing and loads existing memories from file

#### Scenario: 檔案不存在時初始化
- **WHEN** `init()` is called and the data file does not exist
- **THEN** the system creates an empty JSON file

### Requirement: 記憶 CRUD 操作
The system SHALL support creating, reading, updating, and deleting memories.

#### Scenario: 新增記憶
- **WHEN** `add(content)` is called with a non-empty string
- **THEN** the system creates a new memory with auto-generated ID, the given content, and timestamps (`createdAt`, `updatedAt`), then saves to file

#### Scenario: 取得所有記憶
- **WHEN** `getAll()` is called
- **THEN** the system returns an array of all stored `Memory` objects

#### Scenario: 更新記憶內容
- **WHEN** `update(id, content)` is called with an existing memory ID
- **THEN** the system updates the memory's content and `updatedAt` timestamp, then saves to file

#### Scenario: 更新不存在的記憶
- **WHEN** `update(id, content)` is called with a non-existing ID
- **THEN** the system returns `undefined`

#### Scenario: 刪除記憶
- **WHEN** `delete(id)` is called with an existing memory ID
- **THEN** the system removes the memory and saves to file, returning `true`

#### Scenario: 刪除不存在的記憶
- **WHEN** `delete(id)` is called with a non-existing ID
- **THEN** the system returns `false`

### Requirement: 關鍵字搜尋
The system SHALL support searching memories by keyword.

#### Scenario: 關鍵字搜尋
- **WHEN** `search(keyword)` is called
- **THEN** the system returns all memories whose `content` contains the keyword (case-insensitive)

#### Scenario: 搜尋無結果
- **WHEN** `search(keyword)` is called and no memories match
- **THEN** the system returns an empty array

### Requirement: 容量上限管理
The system SHALL enforce maximum memory capacity to prevent unbounded growth.

#### Scenario: 超過最大記憶數量
- **WHEN** `add()` is called and the current memory count equals `MEMORY_MAX_ITEMS` (default: 100)
- **THEN** the system returns an error indicating the memory is full

#### Scenario: 環境變數配置
- **WHEN** the store is initialized
- **THEN** the system reads `MEMORY_MAX_ITEMS` from environment variables (default: 100)

### Requirement: 環境感知路徑
The system SHALL use different storage paths based on environment.

#### Scenario: Add-on 環境
- **WHEN** running as HA Add-on
- **THEN** memories are stored at `/data/memories/memories.json`

#### Scenario: 一般環境
- **WHEN** running standalone
- **THEN** memories are stored at `data/memories.json`

### Requirement: Prompt 記憶注入
The system SHALL provide a `buildPromptWithMemory()` helper to format memories for prompt injection.

#### Scenario: 建構帶記憶的 prompt
- **WHEN** `buildPromptWithMemory(memories, prompt)` is called with existing memories
- **THEN** the system returns a string formatted as:
  ```
  <long_term_memory>
  - memory content 1
  - memory content 2
  </long_term_memory>

  {prompt}
  ```

#### Scenario: 無記憶時建構 prompt
- **WHEN** `buildPromptWithMemory([], prompt)` is called with empty memories
- **THEN** the system returns only the `prompt` without memory tags
