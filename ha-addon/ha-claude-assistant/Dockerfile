ARG BUILD_FROM
FROM ${BUILD_FROM}

# 安裝必要的系統套件
RUN apk add --no-cache \
    bash \
    curl \
    jq

# 設定工作目錄
WORKDIR /app

# 複製 package.json 並安裝依賴
COPY package*.json ./
RUN npm ci --omit=dev

# 複製編譯後的程式碼
COPY dist/ ./dist/

# 複製啟動腳本
COPY ha-addon/ha-claude-assistant/run.sh /run.sh
RUN chmod +x /run.sh

# 建立資料目錄
RUN mkdir -p /data/schedules /data/claude

# 設定環境變數
ENV NODE_ENV=production
ENV TZ=Asia/Taipei

# 啟動腳本
CMD ["/run.sh"]
