import { config } from 'dotenv';
config();

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HAService {
  domain: string;
  services: Record<string, {
    name?: string;
    description?: string;
    fields?: Record<string, unknown>;
  }>;
}

export interface HAServiceCallResult {
  success: boolean;
  changed_states?: HAState[];
  error?: string;
}

export interface HAClientConfig {
  url: string;
  token: string;
  timeout?: number;
  retryAttempts?: number;
}

export class HAClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(config?: Partial<HAClientConfig>) {
    this.baseUrl = (config?.url || process.env.HA_URL || '').replace(/\/$/, '');
    this.token = config?.token || process.env.HA_TOKEN || '';
    this.timeout = config?.timeout || 10000;
    this.retryAttempts = config?.retryAttempts || 3;

    if (!this.baseUrl) {
      throw new Error('Home Assistant URL is required. Set HA_URL environment variable.');
    }
    if (!this.token) {
      throw new Error('Home Assistant token is required. Set HA_TOKEN environment variable.');
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HA API error (${response.status}): ${errorText}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError;
  }

  /**
   * 驗證 API 連線
   */
  async checkConnection(): Promise<{ message: string }> {
    return this.request<{ message: string }>('GET', '/');
  }

  /**
   * 取得所有實體狀態
   */
  async getStates(): Promise<HAState[]> {
    return this.request<HAState[]>('GET', '/states');
  }

  /**
   * 取得單一實體狀態
   */
  async getState(entityId: string): Promise<HAState> {
    return this.request<HAState>('GET', `/states/${entityId}`);
  }

  /**
   * 依照 domain 過濾實體
   */
  async getStatesByDomain(domain: string): Promise<HAState[]> {
    const states = await this.getStates();
    return states.filter(s => s.entity_id.startsWith(`${domain}.`));
  }

  /**
   * 取得所有可用服務
   */
  async getServices(): Promise<HAService[]> {
    return this.request<HAService[]>('GET', '/services');
  }

  /**
   * 呼叫服務
   */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<HAState[]> {
    return this.request<HAState[]>('POST', `/services/${domain}/${service}`, data || {});
  }

  /**
   * 觸發事件
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>('POST', `/events/${eventType}`, eventData || {});
  }

  /**
   * 取得設定資訊
   */
  async getConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/config');
  }

  /**
   * 常用操作：開關燈
   */
  async toggleLight(entityId: string): Promise<HAState[]> {
    return this.callService('light', 'toggle', { entity_id: entityId });
  }

  async turnOnLight(entityId: string, options?: { brightness?: number; color_temp?: number; rgb_color?: [number, number, number] }): Promise<HAState[]> {
    return this.callService('light', 'turn_on', { entity_id: entityId, ...options });
  }

  async turnOffLight(entityId: string): Promise<HAState[]> {
    return this.callService('light', 'turn_off', { entity_id: entityId });
  }

  /**
   * 常用操作：開關開關
   */
  async toggleSwitch(entityId: string): Promise<HAState[]> {
    return this.callService('switch', 'toggle', { entity_id: entityId });
  }

  async turnOnSwitch(entityId: string): Promise<HAState[]> {
    return this.callService('switch', 'turn_on', { entity_id: entityId });
  }

  async turnOffSwitch(entityId: string): Promise<HAState[]> {
    return this.callService('switch', 'turn_off', { entity_id: entityId });
  }

  /**
   * 常用操作：場景
   */
  async activateScene(entityId: string): Promise<HAState[]> {
    return this.callService('scene', 'turn_on', { entity_id: entityId });
  }

  /**
   * 常用操作：自動化
   */
  async triggerAutomation(entityId: string): Promise<HAState[]> {
    return this.callService('automation', 'trigger', { entity_id: entityId });
  }

  /**
   * 常用操作：腳本
   */
  async runScript(entityId: string, variables?: Record<string, unknown>): Promise<HAState[]> {
    return this.callService('script', 'turn_on', { entity_id: entityId, variables });
  }

  /**
   * 常用操作：氣候控制
   */
  async setClimateTemperature(entityId: string, temperature: number): Promise<HAState[]> {
    return this.callService('climate', 'set_temperature', { entity_id: entityId, temperature });
  }

  async setClimateMode(entityId: string, hvacMode: string): Promise<HAState[]> {
    return this.callService('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: hvacMode });
  }

  /**
   * 常用操作：媒體播放器
   */
  async mediaPlayPause(entityId: string): Promise<HAState[]> {
    return this.callService('media_player', 'media_play_pause', { entity_id: entityId });
  }

  async setMediaVolume(entityId: string, volumeLevel: number): Promise<HAState[]> {
    return this.callService('media_player', 'volume_set', { entity_id: entityId, volume_level: volumeLevel });
  }

  /**
   * 列出特定類型的實體
   */
  async listEntitiesByType(type: string): Promise<Array<{ entity_id: string; friendly_name: string; state: string }>> {
    const states = await this.getStatesByDomain(type);
    return states.map(s => ({
      entity_id: s.entity_id,
      friendly_name: (s.attributes.friendly_name as string) || s.entity_id,
      state: s.state,
    }));
  }

  /**
   * 搜尋實體（依名稱）
   */
  async searchEntities(query: string): Promise<HAState[]> {
    const states = await this.getStates();
    const lowerQuery = query.toLowerCase();
    return states.filter(s =>
      s.entity_id.toLowerCase().includes(lowerQuery) ||
      (s.attributes.friendly_name as string || '').toLowerCase().includes(lowerQuery)
    );
  }
}

export default HAClient;
