import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHistoryTool, executeGetHistory } from '../src/tools/get-history.js';
import type { HAClient } from '../src/core/ha-client.js';

function createMockClient(overrides: Partial<HAClient> = {}): HAClient {
  return {
    getHistory: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as HAClient;
}

describe('get-history tool', () => {
  describe('getHistoryTool definition', () => {
    it('should have correct name', () => {
      expect(getHistoryTool.name).toBe('get_history');
    });

    it('should have description', () => {
      expect(getHistoryTool.description).toBeDefined();
      expect(getHistoryTool.description.length).toBeGreaterThan(0);
    });

    it('should require entity_id', () => {
      expect(getHistoryTool.input_schema.required).toContain('entity_id');
    });

    it('should have optional time parameters', () => {
      const properties = getHistoryTool.input_schema.properties as Record<string, unknown>;
      expect(properties.start_time).toBeDefined();
      expect(properties.end_time).toBeDefined();
      expect(properties.minimal_response).toBeDefined();
      expect(properties.significant_changes_only).toBeDefined();
    });
  });

  describe('executeGetHistory', () => {
    let mockClient: HAClient;

    beforeEach(() => {
      mockClient = createMockClient();
    });

    it('should query history with entity_id only (default 24h)', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
        [
          { entity_id: 'sensor.temp', state: '25.5', last_changed: '2026-02-16T10:00:00+08:00', attributes: {} },
          { entity_id: 'sensor.temp', state: '26.0', last_changed: '2026-02-16T12:00:00+08:00', attributes: {} },
        ],
      ]);

      const result = JSON.parse(await executeGetHistory(mockClient, { entity_id: 'sensor.temp' }));

      expect(result.success).toBe(true);
      expect(result.total_records).toBe(2);
      expect(result.records).toHaveLength(2);
      expect(result.records[0].entity_id).toBe('sensor.temp');
      expect(result.records[0].state).toBe('25.5');
      expect(mockClient.getHistory).toHaveBeenCalledWith(
        'sensor.temp',
        undefined,
        undefined,
        { minimalResponse: true, significantChangesOnly: false }
      );
    });

    it('should query history with custom time range', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([[]]);

      const result = JSON.parse(await executeGetHistory(mockClient, {
        entity_id: 'sensor.temp',
        start_time: '2026-02-16T00:00:00+08:00',
        end_time: '2026-02-17T00:00:00+08:00',
      }));

      expect(result.success).toBe(true);
      expect(mockClient.getHistory).toHaveBeenCalledWith(
        'sensor.temp',
        '2026-02-16T00:00:00+08:00',
        '2026-02-17T00:00:00+08:00',
        { minimalResponse: true, significantChangesOnly: false }
      );
    });

    it('should query multiple entities', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ entity_id: 'sensor.temp', state: '25', last_changed: '2026-02-16T10:00:00+08:00', attributes: {} }],
        [{ entity_id: 'sensor.humidity', state: '60', last_changed: '2026-02-16T10:00:00+08:00', attributes: {} }],
      ]);

      const result = JSON.parse(await executeGetHistory(mockClient, {
        entity_id: 'sensor.temp,sensor.humidity',
      }));

      expect(result.success).toBe(true);
      expect(result.total_records).toBe(2);
      expect(result.records[0].entity_id).toBe('sensor.temp');
      expect(result.records[1].entity_id).toBe('sensor.humidity');
    });

    it('should pass significant_changes_only option', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([[]]);

      await executeGetHistory(mockClient, {
        entity_id: 'sensor.temp',
        significant_changes_only: true,
      });

      expect(mockClient.getHistory).toHaveBeenCalledWith(
        'sensor.temp',
        undefined,
        undefined,
        { minimalResponse: true, significantChangesOnly: true }
      );
    });

    it('should allow disabling minimal_response', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([[]]);

      await executeGetHistory(mockClient, {
        entity_id: 'sensor.temp',
        minimal_response: false,
      });

      expect(mockClient.getHistory).toHaveBeenCalledWith(
        'sensor.temp',
        undefined,
        undefined,
        { minimalResponse: false, significantChangesOnly: false }
      );
    });

    it('should omit empty attributes from records', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ entity_id: 'sensor.temp', state: '25', last_changed: '2026-02-16T10:00:00+08:00', attributes: {} }],
      ]);

      const result = JSON.parse(await executeGetHistory(mockClient, { entity_id: 'sensor.temp' }));

      expect(result.records[0]).not.toHaveProperty('attributes');
    });

    it('should include non-empty attributes in records', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ entity_id: 'sensor.temp', state: '25', last_changed: '2026-02-16T10:00:00+08:00', attributes: { unit_of_measurement: '°C' } }],
      ]);

      const result = JSON.parse(await executeGetHistory(mockClient, { entity_id: 'sensor.temp' }));

      expect(result.records[0].attributes).toEqual({ unit_of_measurement: '°C' });
    });

    it('should return error on failure', async () => {
      (mockClient.getHistory as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('HA API error (404): Entity not found'));

      const result = JSON.parse(await executeGetHistory(mockClient, { entity_id: 'sensor.nonexistent' }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Entity not found');
    });
  });
});
