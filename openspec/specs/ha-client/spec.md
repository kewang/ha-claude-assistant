### Requirement: Home Assistant REST API 封裝
The system SHALL provide an `HAClient` class that wraps the Home Assistant REST API, supporting entity queries, service calls, and history queries.

#### Scenario: 建構 HAClient 並驗證必要參數
- **WHEN** `HAClient` is constructed without URL or token
- **THEN** the system throws an error indicating missing configuration

#### Scenario: 建構 HAClient 使用 Add-on 環境
- **WHEN** `SUPERVISOR_TOKEN` environment variable is present
- **THEN** the system uses `http://supervisor/core` as HA URL and `SUPERVISOR_TOKEN` as bearer token

#### Scenario: 建構 HAClient 使用一般環境
- **WHEN** `HA_URL` and `HA_TOKEN` environment variables are set
- **THEN** the system uses these values for API communication

### Requirement: 內網/外網自動切換
The system SHALL support automatic network switching between internal and external HA URLs via `autoConnect()`.

#### Scenario: 內網連線成功
- **WHEN** `autoConnect()` is called and internal `HA_URL` is reachable
- **THEN** the system uses the internal URL for subsequent requests

#### Scenario: 內網連線失敗，切換外網
- **WHEN** `autoConnect()` is called and internal `HA_URL` is unreachable but `HA_URL_EXTERNAL` is set
- **THEN** the system falls back to the external URL

#### Scenario: 無外網 URL 且內網失敗
- **WHEN** `autoConnect()` is called, internal URL fails, and no external URL is configured
- **THEN** the system logs the failure and continues with the internal URL

### Requirement: 實體狀態查詢
The system SHALL provide methods to query entity states from HA.

#### Scenario: 取得所有實體狀態
- **WHEN** `getStates()` is called
- **THEN** the system returns an array of `HAState` objects from `GET /api/states`

#### Scenario: 取得單一實體狀態
- **WHEN** `getState("sensor.temperature")` is called
- **THEN** the system returns the `HAState` for that entity from `GET /api/states/<entity_id>`

#### Scenario: 依 domain 取得實體
- **WHEN** `getStatesByDomain("light")` is called
- **THEN** the system returns all entities whose `entity_id` starts with `light.`

#### Scenario: 搜尋實體
- **WHEN** `searchEntities("客廳")` is called
- **THEN** the system returns entities whose `entity_id` or `friendly_name` contains the search query (case-insensitive)

### Requirement: 服務呼叫
The system SHALL provide a `callService()` method to invoke HA services.

#### Scenario: 呼叫服務成功
- **WHEN** `callService("light", "turn_on", { entity_id: "light.bedroom", brightness: 255 })` is called
- **THEN** the system sends `POST /api/services/light/turn_on` with the given data and returns changed states

#### Scenario: 呼叫服務失敗
- **WHEN** `callService()` is called and HA returns an error
- **THEN** the system throws an error with the HA error message

### Requirement: 歷史紀錄查詢
The system SHALL provide a `getHistory()` method to query entity history via `GET /api/history/period/<timestamp>`.

#### Scenario: 查詢歷史紀錄含時間範圍
- **WHEN** `getHistory("sensor.temp", startTime, endTime, { minimalResponse: true })` is called
- **THEN** the system sends appropriate query parameters (`filter_entity_id`, `end_time`, `minimal_response`) to the HA History API

### Requirement: 請求重試機制
The system SHALL retry failed HTTP requests with exponential backoff.

#### Scenario: 請求失敗後重試
- **WHEN** an HTTP request fails due to network error
- **THEN** the system retries up to 3 times with increasing delay (default 10s timeout per request)

#### Scenario: 請求逾時
- **WHEN** an HTTP request exceeds the timeout
- **THEN** the system aborts the request via `AbortController` and retries

### Requirement: 便捷方法
The system SHALL provide helper methods for common HA operations.

#### Scenario: 切換燈光
- **WHEN** `toggleLight("light.bedroom")` is called
- **THEN** the system calls `callService("light", "toggle", { entity_id: "light.bedroom" })`

#### Scenario: 設定空調溫度
- **WHEN** `setClimateTemperature("climate.ac", 25)` is called
- **THEN** the system calls `callService("climate", "set_temperature", { entity_id, temperature: 25 })`
