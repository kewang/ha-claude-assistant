ARG BUILD_FROM

# 第一階段：從 Node.js Alpine 鏡像取得 Node.js
FROM node:20-alpine AS node-base

# 第二階段：HA Add-on
FROM ${BUILD_FROM}

# 從 node-base 複製 Node.js
COPY --from=node-base /usr/local/bin/node /usr/local/bin/
COPY --from=node-base /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# 安裝必要的系統套件
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git \
    libstdc++ \
    su-exec \
    binutils

# 建立非 root 用戶（用於執行 claude CLI）
RUN addgroup -g 1000 claude && \
    adduser -u 1000 -G claude -h /home/claude -s /bin/bash -D claude

# 驗證 Node.js 安裝
RUN node --version && npm --version

# 安裝 Claude Code CLI（全域）
RUN npm install -g @anthropic-ai/claude-code && \
    claude --version

# 設定工作目錄
WORKDIR /app

# 從 GitHub 克隆並建置
# 使用 BUILD_VERSION 破壞快取，確保每次版本更新都重新 clone
ARG BUILD_VERSION
RUN git clone --depth 1 https://github.com/kewang/ha-claude-assistant.git . && \
    npm ci && \
    npm run build && \
    rm -rf .git node_modules && \
    npm ci --omit=dev

# 複製啟動腳本
COPY run.sh /run.sh
RUN chmod +x /run.sh

# 建立資料目錄
RUN mkdir -p /data/schedules /data/claude && \
    chown -R claude:claude /data/claude

# 設定環境變數
ENV NODE_ENV=production
ENV TZ=Asia/Taipei

# 啟動腳本
CMD ["/run.sh"]
