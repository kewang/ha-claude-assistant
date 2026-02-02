ARG BUILD_FROM
FROM ${BUILD_FROM}

# 安裝必要的系統套件
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git \
    libstdc++

# 設定 NVM 環境變數
ENV NVM_DIR=/usr/local/nvm
ENV NODE_VERSION=20.11.1

# 安裝 nvm 和 Node.js
RUN mkdir -p $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    . $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    node --version && npm --version

# 設定 PATH
ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# 設定工作目錄
WORKDIR /app

# 從 GitHub 克隆並建置
RUN . $NVM_DIR/nvm.sh && \
    git clone --depth 1 https://github.com/kewang/ha-claude-assistant.git . && \
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
