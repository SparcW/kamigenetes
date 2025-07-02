# Node.js 16を使用
FROM node:16-alpine

# セキュリティ: rootユーザーを使わない
RUN addgroup -g 1001 -S nodejs
RUN adduser -S webapp -u 1001

# 作業ディレクトリの作成
WORKDIR /app

# package.jsonとpackage-lock.json（存在する場合）をコピー
COPY package*.json ./

# 依存関係のインストール
# プロダクション環境では開発依存関係を除外
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm ci --only=production && npm cache clean --force

# アプリケーションソースコードをコピー
COPY --chown=webapp:nodejs . .

# webappユーザーに切り替え
USER webapp

# アプリケーションのポートを公開
EXPOSE 3000 9090

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
  const options = { host: 'localhost', port: 3000, path: '/health', timeout: 2000 }; \
  const request = http.request(options, (res) => { \
    if (res.statusCode === 200) process.exit(0); \
    else process.exit(1); \
  }); \
  request.on('error', () => process.exit(1)); \
  request.end();"

# アプリケーション開始
CMD ["node", "server.js"]
