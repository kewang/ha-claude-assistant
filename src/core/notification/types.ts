export type ChannelType = 'slack' | 'telegram' | 'discord' | 'line';

export interface NotificationMessage {
  text: string;
  markdown?: string;
  source: 'event' | 'schedule' | 'manual';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  channel: ChannelType;
  success: boolean;
  error?: string;
}

export interface NotificationAdapter {
  readonly type: ChannelType;
  isConfigured(): boolean;
  send(message: NotificationMessage, target?: string): Promise<NotificationResult>;
}
