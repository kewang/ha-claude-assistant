import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler, CronPresets } from '../src/core/scheduler.js';
import { ClaudeAgent } from '../src/core/claude-agent.js';
import { HAClient } from '../src/core/ha-client.js';

// Mock ClaudeAgent
vi.mock('../src/core/claude-agent.js', () => ({
  ClaudeAgent: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({ text: 'Mock response' }),
    chat: vi.fn().mockResolvedValue({ text: 'Mock response' }),
    clearHistory: vi.fn(),
  })),
}));

// Mock HAClient
vi.mock('../src/core/ha-client.js', () => ({
  HAClient: vi.fn().mockImplementation(() => ({})),
}));

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let mockAgent: ClaudeAgent;

  beforeEach(() => {
    const mockHaClient = new HAClient({
      url: 'http://localhost:8123',
      token: 'test-token',
    });
    mockAgent = new ClaudeAgent(mockHaClient);
    scheduler = new Scheduler(mockAgent);
  });

  afterEach(() => {
    scheduler.stopAll();
    vi.clearAllMocks();
  });

  describe('CronPresets', () => {
    it('should have everyMinute preset', () => {
      expect(CronPresets.everyMinute).toBe('* * * * *');
    });

    it('should have everyHour preset', () => {
      expect(CronPresets.everyHour).toBe('0 * * * *');
    });

    it('should generate everyDay preset', () => {
      expect(CronPresets.everyDay(7, 30)).toBe('30 7 * * *');
      expect(CronPresets.everyDay(19)).toBe('0 19 * * *');
    });

    it('should generate everyWeekday preset', () => {
      expect(CronPresets.everyWeekday(9, 0)).toBe('0 9 * * 1-5');
    });
  });

  describe('addJob', () => {
    it('should add a job', () => {
      const result = scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: false,
      });

      expect(result).toBe(true);
      expect(scheduler.getJobs()).toHaveLength(1);
    });

    it('should throw error for invalid cron expression', () => {
      expect(() => {
        scheduler.addJob({
          id: 'test-job',
          name: 'Test Job',
          cronExpression: 'invalid',
          prompt: 'Test prompt',
          enabled: false,
        });
      }).toThrow('Invalid cron expression');
    });

    it('should throw error for duplicate job id', () => {
      scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: false,
      });

      expect(() => {
        scheduler.addJob({
          id: 'test-job',
          name: 'Test Job 2',
          cronExpression: '0 * * * *',
          prompt: 'Test prompt 2',
          enabled: false,
        });
      }).toThrow('already exists');
    });
  });

  describe('removeJob', () => {
    it('should remove a job', () => {
      scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: false,
      });

      expect(scheduler.getJobs()).toHaveLength(1);
      const result = scheduler.removeJob('test-job');
      expect(result).toBe(true);
      expect(scheduler.getJobs()).toHaveLength(0);
    });

    it('should return false for non-existent job', () => {
      const result = scheduler.removeJob('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('enableJob / disableJob', () => {
    it('should enable a job', () => {
      scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: false,
      });

      scheduler.enableJob('test-job');
      const job = scheduler.getJob('test-job');
      expect(job?.enabled).toBe(true);
    });

    it('should disable a job', () => {
      scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: true,
      });

      scheduler.disableJob('test-job');
      const job = scheduler.getJob('test-job');
      expect(job?.enabled).toBe(false);
    });
  });

  describe('exportJobs', () => {
    it('should export jobs without runtime fields', () => {
      scheduler.addJob({
        id: 'test-job',
        name: 'Test Job',
        cronExpression: '0 * * * *',
        prompt: 'Test prompt',
        enabled: true,
      });

      const exported = scheduler.exportJobs();
      expect(exported).toHaveLength(1);
      expect(exported[0]).not.toHaveProperty('lastRun');
      expect(exported[0]).not.toHaveProperty('lastResult');
    });
  });
});
