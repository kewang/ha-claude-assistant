ARG BUILD_FROM
FROM ${BUILD_FROM}

# 安裝必要的系統套件
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    git \
    xz \
    libstdc++

# 安裝 Node.js 20 (使用官方二進位檔)
ENV NODE_VERSION=20.11.1
RUN ARCH= && dpkgArch="$(apk --print-arch)" && \
    case "${dpkgArch##*-}" in \
        x86_64) ARCH='x64';; \
        aarch64) ARCH='arm64';; \
        armv7l) ARCH='armv7l';; \
        armhf) ARCH='armv7l';; \
        i386) ARCH='x86';; \
        *) echo "unsupported architecture"; exit 1 ;; \
    esac && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o node.tar.xz && \
    tar -xJf node.tar.xz -C /usr/local --strip-components=1 --no-same-owner && \
    rm node.tar.xz && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs && \
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
ENV PATH="/usr/local/bin:$PATH"

# 啟動腳本
CMD ["/run.sh"]
