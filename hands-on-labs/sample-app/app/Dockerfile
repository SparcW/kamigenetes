# マルチステージビルド - 本番用最適化Dockerfile
# AWS ECSのタスク定義に相当する設定

# ビルドステージ
FROM node:18-alpine AS builder

# アプリケーションディレクトリの作成
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係のインストール（開発依存関係を除く）
RUN npm ci --only=production && npm cache clean --force

# 本番ステージ
FROM node:18-alpine AS production

# セキュリティ強化: 非root ユーザーの作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 必要なパッケージのインストール
RUN apk add --no-cache \
    tini \
    dumb-init

# アプリケーションディレクトリの作成
WORKDIR /app

# 所有者を変更
RUN chown -R nextjs:nodejs /app

# 非root ユーザーに切り替え
USER nextjs

# ビルドステージから本番依存関係をコピー
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# アプリケーションファイルをコピー
COPY --chown=nextjs:nodejs . .

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => { process.exit(1) })"

# ポート公開
EXPOSE 3000

# Kubernetesのシグナル処理用にtiniを使用
ENTRYPOINT ["/sbin/tini", "--"]

# アプリケーション起動
CMD ["node", "server.js"]

# ラベル（メタデータ）
LABEL maintainer="k8s-learning-team" \
      version="1.0.0" \
      description="Kubernetes学習用サンプルWebアプリケーション" \
      target-audience="AWS ECS管理者"
