/**
 * Web UI Server
 *
 * 提供 Web UI 讓使用者透過 HA Ingress 完成 Claude 登入。
 * 使用 Node.js 內建 http 模組，不需額外依賴。
 *
 * Port: 8099（Add-on ingress_port）
 */

import http from 'http';
import { createLogger } from '../utils/logger.js';
import { getHtmlTemplate } from './web-ui-html.js';
import {
  startAuthFlow,
  exchangeCodeForTokens,
  saveCredentials,
} from '../core/claude-oauth-flow.js';
import { getTokenRefreshService } from '../core/claude-token-refresh.js';

const logger = createLogger('WebUI');
const PORT = parseInt(process.env.WEB_UI_PORT || '8099', 10);

/**
 * 解析 request body（支援 JSON 和 form-urlencoded 格式）
 */
function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      const contentType = req.headers['content-type'] || '';

      // 優先嘗試 JSON
      if (contentType.includes('application/json') || raw.startsWith('{')) {
        try {
          resolve(JSON.parse(raw));
          return;
        } catch {
          // fallthrough to form-urlencoded
        }
      }

      // 嘗試 form-urlencoded
      try {
        const params = new URLSearchParams(raw);
        const result: Record<string, unknown> = {};
        for (const [key, value] of params) {
          result[key] = value;
        }
        resolve(result);
      } catch {
        reject(new Error('Invalid request body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 回傳 JSON
 */
function sendJson(
  res: http.ServerResponse,
  data: Record<string, unknown>,
  status = 200
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * 取得請求的路徑（移除 ingress prefix）
 */
function getRoutePath(req: http.IncomingMessage): string {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  // HA Ingress 會加上 prefix，例如 /api/hassio_ingress/abc123/
  // X-Ingress-Path header 包含這個 prefix
  const ingressPath = req.headers['x-ingress-path'] as string | undefined;
  if (ingressPath && pathname.startsWith(ingressPath)) {
    pathname = pathname.slice(ingressPath.length) || '/';
  }

  return pathname;
}

/**
 * 處理 API 請求
 */
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const method = req.method || 'GET';
  const routePath = getRoutePath(req);

  logger.debug(`${method} ${routePath}`);

  // CORS headers（for ingress）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Routes
    if (routePath === '/' && method === 'GET') {
      // 提供前端 HTML
      const html = getHtmlTemplate();
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (routePath === '/api/status' && method === 'GET') {
      // Token 狀態
      const tokenService = getTokenRefreshService('WebUI');
      const status = await tokenService.getTokenStatus();
      sendJson(res, {
        hasCredentials: status.hasCredentials,
        expiresAt: status.expiresAt?.toISOString(),
        isExpired: status.isExpired,
        isExpiringSoon: status.isExpiringSoon,
        remainingMinutes: status.remainingMinutes,
      });
      return;
    }

    if (routePath === '/api/auth/start' && method === 'POST') {
      // 開始 OAuth 登入流程
      const { authUrl, state } = startAuthFlow();
      sendJson(res, { authUrl, state });
      return;
    }

    if (routePath === '/api/auth/callback' && method === 'POST') {
      // 接收授權碼，交換 Token
      const body = await parseBody(req);
      let code = body.code as string;
      const state = body.state as string;

      if (!code || !state) {
        sendJson(res, { error: 'Missing code or state parameter' }, 400);
        return;
      }

      // Claude callback 頁面顯示的 code 格式為 "code#state"，需要移除 # 後面的部分
      if (code.includes('#')) {
        code = code.split('#')[0];
      }

      const tokens = await exchangeCodeForTokens(code, state);
      await saveCredentials(tokens);

      sendJson(res, { success: true, message: 'Login successful' });
      return;
    }

    if (routePath === '/api/auth/refresh' && method === 'POST') {
      // 手動刷新 Token
      const tokenService = getTokenRefreshService('WebUI');
      const result = await tokenService.refreshToken();
      sendJson(res, {
        success: result.success,
        message: result.message,
        expiresAt: result.expiresAt?.toISOString(),
      });
      return;
    }

    // 404
    sendJson(res, { error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Request error: ${message}`);
    sendJson(res, { error: message }, 500);
  }
}

/**
 * 啟動 Web UI Server
 */
function startServer(): void {
  const server = http.createServer(handleRequest);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Web UI server started on 0.0.0.0:${PORT}`);
  });

  server.on('error', (error) => {
    logger.error(`Server error: ${error.message}`);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// 直接執行時啟動 server
startServer();
