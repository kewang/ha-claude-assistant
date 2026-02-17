### Requirement: 排程持久化儲存
The system SHALL provide a `ScheduleStore` class for persistent JSON-based schedule storage with CRUD operations.

#### Scenario: 初始化儲存
- **WHEN** `init()` is called
- **THEN** the system creates the data directory if missing and loads existing schedules from JSON file

#### Scenario: 檔案不存在時初始化
- **WHEN** `init()` is called and the JSON file does not exist
- **THEN** the system creates an empty schedules array and continues without error

### Requirement: 排程 CRUD 操作
The system SHALL support create, read, update, and delete operations for schedules.

#### Scenario: 建立排程
- **WHEN** `create({ name, cronExpression, prompt, enabled: true })` is called
- **THEN** the system generates a unique ID (timestamp-random), adds timestamps (`createdAt`, `updatedAt`), saves to file, and returns the new schedule

#### Scenario: 讀取所有排程
- **WHEN** `getAll()` is called
- **THEN** the system returns all stored schedules

#### Scenario: 依 ID 讀取排程
- **WHEN** `get(id)` is called
- **THEN** the system returns the matching schedule or `undefined`

#### Scenario: 依名稱搜尋排程
- **WHEN** `findByName(name)` is called
- **THEN** the system returns the first schedule whose name matches (partial match)

#### Scenario: 更新排程
- **WHEN** `update(id, { name: "新名稱" })` is called
- **THEN** the system merges the updates, refreshes `updatedAt`, saves to file, and returns the updated schedule

#### Scenario: 刪除排程
- **WHEN** `delete(id)` is called
- **THEN** the system removes the schedule from storage and saves to file

### Requirement: 啟用/停用排程
The system SHALL support toggling schedule enabled state.

#### Scenario: 啟用排程
- **WHEN** `enable(id)` is called
- **THEN** the system sets `enabled: true` and saves

#### Scenario: 停用排程
- **WHEN** `disable(id)` is called
- **THEN** the system sets `enabled: false` and saves

### Requirement: 檔案變更監控
The system SHALL watch the schedules JSON file for external changes and reload automatically.

#### Scenario: 外部修改檔案
- **WHEN** the schedules JSON file is modified externally
- **THEN** the system reloads schedules after a 500ms debounce period

#### Scenario: 寫入中偵測到變更
- **WHEN** a file change event fires within 500ms of the last change event
- **THEN** the system ignores the intermediate events and only reloads once (debounce)

### Requirement: 錯誤處理
The system SHALL handle file read/write errors gracefully.

#### Scenario: JSON 解析錯誤
- **WHEN** the JSON file contains invalid JSON
- **THEN** the system logs the error and preserves the in-memory state

### Requirement: 環境感知路徑
The system SHALL use different file paths based on environment.

#### Scenario: Add-on 環境
- **WHEN** running as HA Add-on
- **THEN** the system stores schedules at `/data/schedules/schedules.json`

#### Scenario: 一般環境
- **WHEN** running standalone
- **THEN** the system stores schedules at `data/schedules.json` (project-relative)
