import { createLogger } from '../../utils/logger.js';
import { SlackAdapter } from './adapters/slack.js';
import type { ChannelType, NotificationAdapter, NotificationMessage, NotificationResult } from './types.js';

const logger = createLogger('NotificationManager');

export interface SendOptions {
  channels?: ChannelType[];
  target?: string;
}

export class NotificationManager {
  private adapters = new Map<ChannelType, NotificationAdapter>();

  registerAdapter(adapter: NotificationAdapter): void {
    this.adapters.set(adapter.type, adapter);
    logger.info(`Registered adapter: ${adapter.type} (configured: ${adapter.isConfigured()})`);
  }

  async send(message: NotificationMessage, options?: SendOptions): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // Determine which adapters to use
    let adaptersToUse: NotificationAdapter[];
    if (options?.channels) {
      adaptersToUse = options.channels
        .map(ch => this.adapters.get(ch))
        .filter((a): a is NotificationAdapter => a !== undefined && a.isConfigured());
    } else {
      adaptersToUse = Array.from(this.adapters.values()).filter(a => a.isConfigured());
    }

    if (adaptersToUse.length === 0) {
      logger.warn('No configured adapters available to send notification');
      return results;
    }

    for (const adapter of adaptersToUse) {
      const result = await adapter.send(message, options?.target);
      results.push(result);
    }

    return results;
  }
}

// Singleton
let instance: NotificationManager | null = null;

export function getNotificationManager(): NotificationManager {
  if (!instance) {
    instance = new NotificationManager();

    // Auto-register available adapters
    const slackAdapter = new SlackAdapter();
    instance.registerAdapter(slackAdapter);
  }
  return instance;
}
