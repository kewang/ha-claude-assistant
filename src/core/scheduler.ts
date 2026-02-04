import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { ClaudeAgent } from './claude-agent.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Scheduler');

export interface ScheduleJob {
  id: string;
  name: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: string;
}

export interface SchedulerConfig {
  timezone?: string;
}

export type NotificationHandler = (message: string, jobId: string) => Promise<void> | void;

export class Scheduler {
  private agent: ClaudeAgent;
  private jobs: Map<string, ScheduleJob> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private timezone: string;
  private notificationHandlers: NotificationHandler[] = [];

  constructor(agent: ClaudeAgent, config?: SchedulerConfig) {
    this.agent = agent;
    this.timezone = config?.timezone || process.env.TZ || 'Asia/Taipei';
  }

  /**
   * 新增通知處理器（用於 Slack、WhatsApp 等）
   */
  addNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * 移除通知處理器
   */
  removeNotificationHandler(handler: NotificationHandler): void {
    const index = this.notificationHandlers.indexOf(handler);
    if (index > -1) {
      this.notificationHandlers.splice(index, 1);
    }
  }

  /**
   * 發送通知給所有處理器
   */
  private async notify(message: string, jobId: string): Promise<void> {
    for (const handler of this.notificationHandlers) {
      try {
        await handler(message, jobId);
      } catch (error) {
        logger.error(`Notification handler error for job ${jobId}:`, error);
      }
    }
  }

  /**
   * 新增排程任務
   */
  addJob(job: Omit<ScheduleJob, 'lastRun' | 'lastResult'>): boolean {
    if (!cron.validate(job.cronExpression)) {
      throw new Error(`Invalid cron expression: ${job.cronExpression}`);
    }

    if (this.jobs.has(job.id)) {
      throw new Error(`Job with id ${job.id} already exists`);
    }

    const newJob: ScheduleJob = {
      ...job,
      lastRun: undefined,
      lastResult: undefined,
    };

    this.jobs.set(job.id, newJob);

    if (job.enabled) {
      this.startJob(job.id);
    }

    return true;
  }

  /**
   * 啟動排程任務
   */
  private startJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (this.tasks.has(jobId)) {
      this.tasks.get(jobId)?.stop();
    }

    const task = cron.schedule(
      job.cronExpression,
      async () => {
        await this.executeJob(jobId);
      },
      {
        timezone: this.timezone,
      }
    );

    this.tasks.set(jobId, task);
  }

  /**
   * 執行排程任務
   */
  async executeJob(jobId: string): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    logger.info(`Executing job: ${job.name} (${jobId})`);

    try {
      const response = await this.agent.query(job.prompt);
      const result = response.text;

      job.lastRun = new Date();
      job.lastResult = result;

      // 發送通知
      const notificationMessage = `📋 排程任務：${job.name}\n\n${result}`;
      await this.notify(notificationMessage, jobId);

      logger.info(`Job completed: ${job.name}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.lastResult = `Error: ${errorMessage}`;
      logger.error(`Job failed: ${job.name}`, error);
      throw error;
    }
  }

  /**
   * 移除排程任務
   */
  removeJob(jobId: string): boolean {
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
      this.tasks.delete(jobId);
    }

    return this.jobs.delete(jobId);
  }

  /**
   * 啟用任務
   */
  enableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = true;
    this.startJob(jobId);
    return true;
  }

  /**
   * 停用任務
   */
  disableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = false;
    const task = this.tasks.get(jobId);
    if (task) {
      task.stop();
    }
    return true;
  }

  /**
   * 取得所有任務
   */
  getJobs(): ScheduleJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * 取得單一任務
   */
  getJob(jobId: string): ScheduleJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * 更新任務
   */
  updateJob(jobId: string, updates: Partial<Omit<ScheduleJob, 'id'>>): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }

    Object.assign(job, updates);

    // 如果 cron 表達式或啟用狀態改變，重新啟動任務
    if (updates.cronExpression !== undefined || updates.enabled !== undefined) {
      if (job.enabled) {
        this.startJob(jobId);
      } else {
        const task = this.tasks.get(jobId);
        if (task) {
          task.stop();
        }
      }
    }

    return true;
  }

  /**
   * 停止所有任務
   */
  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
  }

  /**
   * 啟動所有已啟用的任務
   */
  startAll(): void {
    for (const job of this.jobs.values()) {
      if (job.enabled) {
        this.startJob(job.id);
      }
    }
  }

  /**
   * 從設定載入任務
   */
  loadJobs(jobs: Array<Omit<ScheduleJob, 'lastRun' | 'lastResult'>>): void {
    for (const job of jobs) {
      try {
        this.addJob(job);
      } catch (error) {
        logger.error(`Failed to load job ${job.id}:`, error);
      }
    }
  }

  /**
   * 匯出任務設定
   */
  exportJobs(): Array<Omit<ScheduleJob, 'lastRun' | 'lastResult'>> {
    return this.getJobs().map(({ lastRun, lastResult, ...job }) => job);
  }
}

/**
 * 常用 cron 表達式輔助
 */
export const CronPresets = {
  everyMinute: '* * * * *',
  every5Minutes: '*/5 * * * *',
  every15Minutes: '*/15 * * * *',
  everyHour: '0 * * * *',
  everyDay: (hour: number, minute = 0) => `${minute} ${hour} * * *`,
  everyWeekday: (hour: number, minute = 0) => `${minute} ${hour} * * 1-5`,
  everyWeekend: (hour: number, minute = 0) => `${minute} ${hour} * * 0,6`,
  everyMonday: (hour: number, minute = 0) => `${minute} ${hour} * * 1`,
  everyMonth: (day: number, hour: number, minute = 0) => `${minute} ${hour} ${day} * *`,
};

export default Scheduler;
