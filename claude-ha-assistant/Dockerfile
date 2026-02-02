ARG BUILD_FROM
FROM ${BUILD_FROM}

# 安裝必要的系統套件
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git \
    libstdc++ \
    xz

# 設定 Node.js 版本
ENV NODE_VERSION=20.18.0

# 從 unofficial-builds 下載 Node.js musl 版本
RUN ARCH="$(apk --print-arch)" && \
    case "${ARCH}" in \
        x86_64) NODE_ARCH='x64';; \
        aarch64) NODE_ARCH='arm64';; \
        armv7l|armhf) NODE_ARCH='armv7l';; \
        *) echo "Unsupported architecture: ${ARCH}"; exit 1;; \
    esac && \
    echo "Downloading Node.js ${NODE_VERSION} for ${NODE_ARCH}-musl..." && \
    curl -fsSL "https://unofficial-builds.nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}-musl.tar.xz" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm /tmp/node.tar.xz && \
    node --version && npm --version

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
