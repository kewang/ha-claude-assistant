import WebSocket from 'ws';
import { detectEnvironment } from './env-detect.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('HAWebSocket');

export interface HAWebSocketConfig {
  url?: string;
  token?: string;
}

export interface HAEvent {
  event_type: string;
  data: Record<string, unknown>;
  origin: string;
  time_fired: string;
  context: Record<string, unknown>;
}

type EventCallback = (event: HAEvent) => void;
type LifecycleCallback = () => void;

// Reconnect settings
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 60000;

// Heartbeat settings
const PING_INTERVAL_MS = 30000;
const PONG_TIMEOUT_MS = 10000;

export class HAWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private msgId = 0;
  private authenticated = false;
  private intentionalClose = false;

  // Subscriptions: msgId -> eventType
  private subscriptions = new Map<number, string>();
  // Reverse map: eventType -> msgId (for re-subscribing)
  private subscribedEventTypes = new Set<string>();

  // Callbacks
  private eventCallbacks: EventCallback[] = [];
  private onReconnected: LifecycleCallback[] = [];
  private onConnectionFailed: LifecycleCallback[] = [];
  private onAuthFailed: LifecycleCallback[] = [];

  // Reconnect state
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Heartbeat state
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private awaitingPong = false;

  constructor(config?: HAWebSocketConfig) {
    const env = detectEnvironment();
    const haConfig = this.getHAConfig(env, config);
    this.url = this.buildWebSocketUrl(haConfig.url);
    this.token = haConfig.token;
  }

  private getHAConfig(env: ReturnType<typeof detectEnvironment>, config?: HAWebSocketConfig): { url: string; token: string } {
    if (config?.url && config?.token) {
      return { url: config.url, token: config.token };
    }

    if (env.isAddon && env.supervisorToken) {
      return {
        url: 'http://supervisor/core',
        token: env.supervisorToken,
      };
    }

    const url = process.env.HA_URL;
    const token = process.env.HA_TOKEN;
    if (!url || !token) {
      throw new Error('HA_URL and HA_TOKEN are required');
    }
    return { url, token };
  }

  private buildWebSocketUrl(httpUrl: string): string {
    return httpUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      .replace(/\/$/, '') + '/api/websocket';
  }

  /**
   * Connect to HA WebSocket API
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.intentionalClose = false;

      logger.info(`Connecting to ${this.url}...`);
      this.ws = new WebSocket(this.url);

      let resolved = false;

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg, () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          });
        } catch (error) {
          logger.error('Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        this.handleClose();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error.message);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
    });
  }

  private handleMessage(msg: Record<string, unknown>, onAuthOk: () => void): void {
    const type = msg.type as string;

    switch (type) {
      case 'auth_required':
        this.sendAuth();
        break;

      case 'auth_ok':
        logger.info('Authenticated successfully');
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        onAuthOk();
        break;

      case 'auth_invalid':
        logger.error('Authentication failed:', msg.message);
        this.authenticated = false;
        for (const cb of this.onAuthFailed) cb();
        break;

      case 'event': {
        const event = msg.event as HAEvent;
        if (event) {
          for (const cb of this.eventCallbacks) {
            try {
              cb(event);
            } catch (error) {
              logger.error('Event callback error:', error);
            }
          }
        }
        break;
      }

      case 'pong':
        this.awaitingPong = false;
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        break;

      case 'result':
        // Subscription confirmations etc.
        if (msg.success === false) {
          logger.error('Command failed:', msg.error);
        }
        break;
    }
  }

  private sendAuth(): void {
    this.sendRaw({
      type: 'auth',
      access_token: this.token,
    });
  }

  private sendRaw(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private nextId(): number {
    return ++this.msgId;
  }

  /**
   * Subscribe to an HA event type
   */
  subscribeEvents(eventType: string): number {
    const id = this.nextId();
    this.sendRaw({
      id,
      type: 'subscribe_events',
      event_type: eventType,
    });
    this.subscriptions.set(id, eventType);
    this.subscribedEventTypes.add(eventType);
    logger.info(`Subscribed to ${eventType} (id: ${id})`);
    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribeEvents(subscriptionId: number): void {
    const eventType = this.subscriptions.get(subscriptionId);
    this.sendRaw({
      id: this.nextId(),
      type: 'unsubscribe_events',
      subscription: subscriptionId,
    });
    this.subscriptions.delete(subscriptionId);
    if (eventType) {
      // Only remove from set if no other subscriptions for this type
      const hasOther = Array.from(this.subscriptions.values()).includes(eventType);
      if (!hasOther) {
        this.subscribedEventTypes.delete(eventType);
      }
    }
    logger.info(`Unsubscribed from subscription ${subscriptionId}`);
  }

  /**
   * Register event callback
   */
  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Register reconnected callback
   */
  onReconnectedEvent(callback: LifecycleCallback): void {
    this.onReconnected.push(callback);
  }

  /**
   * Register connection failed callback
   */
  onConnectionFailedEvent(callback: LifecycleCallback): void {
    this.onConnectionFailed.push(callback);
  }

  /**
   * Register auth failed callback
   */
  onAuthFailedEvent(callback: LifecycleCallback): void {
    this.onAuthFailed.push(callback);
  }

  /**
   * Disconnect gracefully
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.cancelReconnect();
    this.subscriptions.clear();
    this.subscribedEventTypes.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.authenticated = false;
    logger.info('Disconnected');
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  // --- Heartbeat ---

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (!this.isConnected()) return;

      if (this.awaitingPong) {
        // Previous pong not received, connection is dead
        logger.warn('Pong timeout, reconnecting...');
        this.ws?.close();
        return;
      }

      this.awaitingPong = true;
      this.sendRaw({ id: this.nextId(), type: 'ping' });

      this.pongTimeout = setTimeout(() => {
        if (this.awaitingPong) {
          logger.warn('Pong not received within timeout, closing connection');
          this.ws?.close();
        }
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    this.awaitingPong = false;
  }

  // --- Reconnection ---

  private handleClose(): void {
    this.authenticated = false;
    this.stopHeartbeat();

    if (this.intentionalClose) {
      return;
    }

    logger.warn('Connection closed unexpectedly');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(`Giving up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`);
      for (const cb of this.onConnectionFailed) cb();
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe all previous event types
        await this.resubscribeAll();
        // Notify listeners
        for (const cb of this.onReconnected) cb();
      } catch (error) {
        logger.error('Reconnect failed:', error instanceof Error ? error.message : error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private async resubscribeAll(): Promise<void> {
    const eventTypes = Array.from(this.subscribedEventTypes);
    this.subscriptions.clear();

    for (const eventType of eventTypes) {
      this.subscribeEvents(eventType);
    }

    if (eventTypes.length > 0) {
      logger.info(`Re-subscribed to ${eventTypes.length} event type(s)`);
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }
}
