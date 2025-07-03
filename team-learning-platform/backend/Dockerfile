# バックエンド Dockerfile
# Node.js + TypeScript + Prismaを使用したAPIサーバー

FROM node:18-alpine

# 作業ディレクトリの設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci

# Prismaクライアントの生成
COPY prisma ./prisma/
RUN npx prisma generate

# ソースコードをコピー
COPY . .

# TypeScriptビルド
RUN npm run build

# ポート3001を公開
EXPOSE 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# アプリケーションの起動
CMD ["npm", "run", "start"]
