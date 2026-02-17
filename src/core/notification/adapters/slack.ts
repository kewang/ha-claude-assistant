import { WebClient } from '@slack/web-api';
import { createLogger } from '../../../utils/logger.js';
import type { NotificationAdapter, NotificationMessage, NotificationResult } from '../types.js';

const logger = createLogger('SlackAdapter');

export class SlackAdapter implements NotificationAdapter {
  readonly type = 'slack' as const;
  private client: WebClient | null = null;
  private defaultChannel: string | null = null;

  constructor() {
    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_DEFAULT_CHANNEL;

    if (token) {
      this.client = new WebClient(token);
    }
    this.defaultChannel = channel || null;
  }

  isConfigured(): boolean {
    return this.client !== null && this.defaultChannel !== null;
  }

  async send(message: NotificationMessage, target?: string): Promise<NotificationResult> {
    const channel = target || this.defaultChannel;

    if (!this.client || !channel) {
      return {
        channel: 'slack',
        success: false,
        error: 'Slack not configured (missing SLACK_BOT_TOKEN or SLACK_DEFAULT_CHANNEL)',
      };
    }

    try {
      await this.client.chat.postMessage({
        channel,
        text: message.markdown || message.text,
        mrkdwn: true,
      });
      logger.info('Sent to Slack');
      return { channel: 'slack', success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to send to Slack:', error);
      return { channel: 'slack', success: false, error: errorMsg };
    }
  }
}
