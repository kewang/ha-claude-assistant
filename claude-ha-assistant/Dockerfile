ARG BUILD_FROM
FROM ${BUILD_FROM}

# 安裝必要的系統套件和 Node.js
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git \
    nodejs \
    npm

# 驗證 Node.js 和 npm 安裝
RUN node --version && npm --version

# 設定工作目錄
WORKDIR /app

# 從 GitHub 克隆並建置
RUN git clone --depth 1 https://github.com/kewang/ha-claude-assistant.git . && \
    npm ci && \
    npm run build && \
    rm -rf .git node_modules && \
    npm ci --omit=dev

# 複製啟動腳本
COPY run.sh /run.sh
RUN chmod +x /run.sh

# 建立資料目錄
RUN mkdir -p /data/schedules /data/claude

# 設定環境變數
ENV NODE_ENV=production
ENV TZ=Asia/Taipei

# 啟動腳本
CMD ["/run.sh"]
