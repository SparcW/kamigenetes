# フロントエンド Dockerfile
# React + Vite を使用したチーム学習プラットフォーム

# ベースイメージ（マルチステージビルド）
FROM node:18-alpine as builder

# 作業ディレクトリの設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# アプリケーションのビルド
RUN npm run build

# 本番用イメージ
FROM nginx:alpine

# ビルド済みアプリケーションをnginxに配置
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx設定ファイルをコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ポート3000を公開
EXPOSE 3000

# nginxの起動
CMD ["nginx", "-g", "daemon off;"]
