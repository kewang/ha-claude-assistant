/**
 * Web UI HTML Template
 *
 * 單一 HTML 頁面，inline CSS + JS，無外部依賴。
 * 支援 HA 深色/淺色主題。
 */

export function getHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Assistant</title>
  <style>
    :root {
      --primary: #d97706;
      --primary-hover: #b45309;
      --success: #16a34a;
      --error: #dc2626;
      --warning: #d97706;
      --bg: #ffffff;
      --bg-card: #f9fafb;
      --bg-input: #ffffff;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: rgba(0, 0, 0, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1f2937;
        --bg-card: #374151;
        --bg-input: #4b5563;
        --text: #f9fafb;
        --text-secondary: #9ca3af;
        --border: #4b5563;
        --shadow: rgba(0, 0, 0, 0.3);
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px var(--shadow);
    }

    .card h2 {
      font-size: 1rem;
      margin-bottom: 12px;
      color: var(--text-secondary);
      font-weight: 600;
    }

    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot.green { background: var(--success); }
    .status-dot.red { background: var(--error); }
    .status-dot.yellow { background: var(--warning); }

    .status-text {
      font-size: 1rem;
      font-weight: 500;
    }

    .status-detail {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-left: 18px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      color: #fff;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    .btn-secondary {
      background: var(--text-secondary);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #4b5563;
    }

    .btn-sm {
      padding: 6px 14px;
      font-size: 0.85rem;
    }

    .input-group {
      margin-top: 16px;
    }

    .input-group label {
      display: block;
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    .input-row input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.95rem;
      background: var(--bg-input);
      color: var(--text);
      font-family: monospace;
    }

    .input-row input:focus {
      outline: 2px solid var(--primary);
      border-color: transparent;
    }

    .message {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-top: 12px;
      display: none;
    }

    .message.show { display: block; }
    .message.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .message.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

    @media (prefers-color-scheme: dark) {
      .message.success { background: #14532d; color: #bbf7d0; border-color: #166534; }
      .message.error { background: #7f1d1d; color: #fecaca; border-color: #991b1b; }
    }

    .hidden { display: none !important; }

    .steps {
      margin-top: 12px;
      padding-left: 0;
      list-style: none;
      counter-reset: step;
    }

    .steps li {
      counter-increment: step;
      padding: 6px 0 6px 28px;
      position: relative;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }

    .steps li::before {
      content: counter(step);
      position: absolute;
      left: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--border);
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .steps li.active {
      color: var(--text);
      font-weight: 500;
    }

    .steps li.active::before {
      background: var(--primary);
      color: #fff;
    }

    .steps li.done {
      color: var(--success);
    }

    .steps li.done::before {
      content: '\\2713';
      background: var(--success);
      color: #fff;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <h1>Claude Assistant</h1>

  <!-- 狀態卡片 -->
  <div class="card">
    <h2>Login Status</h2>
    <div class="status-row">
      <div id="statusDot" class="status-dot red"></div>
      <span id="statusText" class="status-text">Checking...</span>
    </div>
    <div id="statusDetail" class="status-detail"></div>
  </div>

  <!-- 登入區塊（未登入時顯示） -->
  <div id="loginSection" class="card hidden">
    <h2>Login to Claude</h2>
    <ol class="steps" id="loginSteps">
      <li id="step1" class="active">Click the login button to open Claude authorization page</li>
      <li id="step2">Complete authorization on the Claude page</li>
      <li id="step3">Copy the authorization code and paste it below</li>
    </ol>

    <div style="margin-top: 16px;">
      <button id="startLoginBtn" class="btn btn-primary" onclick="startLogin()">
        Login to Claude
      </button>
    </div>

    <div id="codeInput" class="input-group hidden">
      <label for="authCode">Authorization Code</label>
      <div class="input-row">
        <input type="text" id="authCode" placeholder="Paste the authorization code here..." />
        <button class="btn btn-primary" onclick="submitCode()">Submit</button>
      </div>
    </div>

    <div id="loginMessage" class="message"></div>
  </div>

  <!-- 管理區塊（已登入時顯示） -->
  <div id="managementSection" class="card hidden">
    <h2>Token Management</h2>
    <div id="tokenInfo" style="margin-bottom: 12px; font-size: 0.9rem;"></div>
    <button class="btn btn-secondary btn-sm" onclick="refreshToken()">
      Refresh Token
    </button>
    <div id="refreshMessage" class="message"></div>
  </div>

  <div class="footer">
    Claude HA Assistant
  </div>

  <script>
    // 從 base tag 或 X-Ingress-Path 取得 base path
    const basePath = (function() {
      // HA ingress 會注入 X-Ingress-Path header，但前端拿不到
      // 改用 document.baseURI 或 window.location.pathname 推算
      const path = window.location.pathname;
      // 移除結尾的 / 和可能的 index.html
      return path.replace(/\\/$/, '').replace(/\\/index\\.html$/, '');
    })();

    let currentState = null;
    let statusInterval = null;

    function apiUrl(endpoint) {
      return basePath + endpoint;
    }

    async function checkStatus() {
      try {
        const res = await fetch(apiUrl('/api/status'));
        const data = await res.json();
        updateStatusUI(data);
      } catch (e) {
        updateStatusUI({ hasCredentials: false, error: e.message });
      }
    }

    function updateStatusUI(data) {
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      const detail = document.getElementById('statusDetail');
      const loginSection = document.getElementById('loginSection');
      const mgmtSection = document.getElementById('managementSection');

      if (data.hasCredentials && !data.isExpired) {
        // 已登入且有效
        dot.className = 'status-dot green';
        text.textContent = 'Logged in';
        if (data.remainingMinutes !== undefined) {
          const hours = Math.floor(data.remainingMinutes / 60);
          const mins = data.remainingMinutes % 60;
          if (hours > 0) {
            detail.textContent = 'Token valid for ' + hours + 'h ' + mins + 'm';
          } else {
            detail.textContent = 'Token valid for ' + mins + ' minutes';
          }
        } else {
          detail.textContent = '';
        }
        loginSection.classList.add('hidden');
        mgmtSection.classList.remove('hidden');

        // 更新 token info
        const tokenInfo = document.getElementById('tokenInfo');
        if (data.expiresAt) {
          const exp = new Date(data.expiresAt);
          tokenInfo.innerHTML = '<strong>Expires at:</strong> ' + exp.toLocaleString();
        }
      } else if (data.hasCredentials && data.isExpired) {
        // 已過期
        dot.className = 'status-dot yellow';
        text.textContent = 'Token expired';
        detail.textContent = 'Token needs refresh or re-login';
        loginSection.classList.remove('hidden');
        mgmtSection.classList.remove('hidden');
      } else {
        // 未登入
        dot.className = 'status-dot red';
        text.textContent = 'Not logged in';
        detail.textContent = 'Please login to start using Claude Assistant';
        loginSection.classList.remove('hidden');
        mgmtSection.classList.add('hidden');
      }
    }

    async function startLogin() {
      const btn = document.getElementById('startLoginBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Starting...';

      try {
        const res = await fetch(apiUrl('/api/auth/start'), { method: 'POST' });
        const data = await res.json();

        if (data.error) {
          showMessage('loginMessage', data.error, 'error');
          btn.disabled = false;
          btn.textContent = 'Login to Claude';
          return;
        }

        currentState = data.state;

        // 開新分頁
        window.open(data.authUrl, '_blank');

        // 更新 UI 步驟
        document.getElementById('step1').className = 'done';
        document.getElementById('step2').className = 'active';
        document.getElementById('codeInput').classList.remove('hidden');

        btn.textContent = 'Login to Claude';
        btn.disabled = false;

        // focus 到輸入框
        document.getElementById('authCode').focus();
      } catch (e) {
        showMessage('loginMessage', 'Failed to start login: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Login to Claude';
      }
    }

    async function submitCode() {
      const code = document.getElementById('authCode').value.trim();
      if (!code) {
        showMessage('loginMessage', 'Please enter the authorization code', 'error');
        return;
      }

      if (!currentState) {
        showMessage('loginMessage', 'Please click "Login to Claude" first', 'error');
        return;
      }

      // 更新步驟
      document.getElementById('step2').className = 'done';
      document.getElementById('step3').className = 'active';

      try {
        const res = await fetch(apiUrl('/api/auth/callback'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state: currentState }),
        });

        const data = await res.json();

        if (data.error) {
          showMessage('loginMessage', data.error, 'error');
          return;
        }

        // 成功
        document.getElementById('step3').className = 'done';
        showMessage('loginMessage', 'Login successful! Token saved.', 'success');
        currentState = null;

        // 刷新狀態
        setTimeout(checkStatus, 500);
      } catch (e) {
        showMessage('loginMessage', 'Failed: ' + e.message, 'error');
      }
    }

    async function refreshToken() {
      try {
        const res = await fetch(apiUrl('/api/auth/refresh'), { method: 'POST' });
        const data = await res.json();

        if (data.success) {
          showMessage('refreshMessage', data.message, 'success');
          setTimeout(checkStatus, 500);
        } else {
          showMessage('refreshMessage', data.message, 'error');
        }
      } catch (e) {
        showMessage('refreshMessage', 'Failed: ' + e.message, 'error');
      }
    }

    function showMessage(elementId, text, type) {
      const el = document.getElementById(elementId);
      el.textContent = text;
      el.className = 'message show ' + type;
      // 10 秒後自動隱藏
      setTimeout(function() {
        el.classList.remove('show');
      }, 10000);
    }

    // 初始化
    checkStatus();
    // 每 30 秒刷新一次
    statusInterval = setInterval(checkStatus, 30000);
  </script>
</body>
</html>`;
}
