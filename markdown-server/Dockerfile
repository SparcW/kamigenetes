# Markdown & Mermaid サーバー用 Dockerfile
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.json をコピーして依存関係をインストール
COPY package*.json ./
RUN npm install --omit=dev

# アプリケーションコードをコピー
COPY . .

# ポート3000を公開
EXPOSE 3000

# 非特権ユーザーで実行
USER node

# アプリケーションを起動
CMD ["node", "server.js"]
