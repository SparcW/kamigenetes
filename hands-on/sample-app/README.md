# サンプルWebアプリケーション - Kubernetes完全デプロイガイド 🚀

## プロジェクト概要

このハンズオン演習では、AWS ECS管理者が実際にKubernetesでWebアプリケーションをデプロイする体験を提供します。シンプルなNode.js Webアプリケーションを例に、以下を学習します：

- コンテナイメージの作成
- Kubernetesマニフェストの作成
- サービスの公開
- 設定管理とシークレット
- モニタリングとログ

## 🏗️ アプリケーション構成

```text
┌─────────────────────────────────────┐
│           フロントエンド             │
│      (Node.js + Express)           │
├─────────────────────────────────────┤
│              Redis                  │
│          (セッション管理)            │
├─────────────────────────────────────┤
│           PostgreSQL                │
│          (データベース)              │
└─────────────────────────────────────┘
```

## 📁 プロジェクト構造

```text
sample-app/
├── app/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── public/
│       └── index.html
├── kubernetes/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres/
│   │   ├── postgres-deployment.yaml
│   │   ├── postgres-service.yaml
│   │   └── postgres-pvc.yaml
│   ├── redis/
│   │   ├── redis-deployment.yaml
│   │   └── redis-service.yaml
│   └── web/
│       ├── web-deployment.yaml
│       ├── web-service.yaml
│       └── web-ingress.yaml
└── docker-compose.yml  # 開発用（比較参考）
```

## 🛠️ Step 1: アプリケーションの作成

### Node.js Webアプリケーション

**package.json**:
```json
{
  "name": "k8s-sample-app",
  "version": "1.0.0",
  "description": "Kubernetes学習用サンプルアプリケーション",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.0",
    "pg": "^8.11.0",
    "ejs": "^3.1.9"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

**server.js**:
```javascript
const express = require('express');
const redis = require('redis');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// 環境変数の取得
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 5432;
const dbName = process.env.DB_NAME || 'sampledb';
const dbUser = process.env.DB_USER || 'user';
const dbPassword = process.env.DB_PASSWORD || 'password';

// Redis接続
const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort
});

// PostgreSQL接続
const pool = new Pool({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
});

// 静的ファイル配信
app.use(express.static('public'));
app.use(express.json());
app.set('view engine', 'ejs');

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness probe（依存サービスの確認）
app.get('/ready', async (req, res) => {
  try {
    // Redis接続確認
    await redisClient.ping();
    
    // PostgreSQL接続確認
    await pool.query('SELECT 1');
    
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// メインページ
app.get('/', async (req, res) => {
  try {
    // 訪問回数をRedisで管理
    const visits = await redisClient.get('page:visits') || 0;
    await redisClient.set('page:visits', parseInt(visits) + 1);
    
    // データベースから最新の訪問者情報を取得
    const result = await pool.query('SELECT COUNT(*) as count FROM visitors');
    const visitorCount = result.rows[0].count;
    
    res.render('index', { 
      visits: parseInt(visits) + 1, 
      visitorCount: visitorCount,
      hostname: require('os').hostname(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新規訪問者の登録
app.post('/visitors', async (req, res) => {
  try {
    const { name } = req.body;
    await pool.query('INSERT INTO visitors (name, visit_time) VALUES ($1, $2)', 
                    [name, new Date()]);
    res.status(201).json({ message: 'Visitor added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 訪問者一覧
app.get('/visitors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM visitors ORDER BY visit_time DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`✅ Ready check: http://localhost:${port}/ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  redisClient.quit();
  pool.end();
  process.exit(0);
});
```

**public/index.html** (EJSテンプレート):
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kubernetes学習アプリ</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stats { display: flex; justify-content: space-between; }
        .stat-box { background: white; padding: 15px; border-radius: 5px; text-align: center; }
        .visitor-form { margin: 20px 0; }
        .visitor-form input { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
        .visitor-form button { padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .visitor-list { background: white; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>🎯 Kubernetes学習アプリケーション</h1>
    
    <div class="container">
        <h2>📊 アプリケーション統計</h2>
        <div class="stats">
            <div class="stat-box">
                <h3>ページビュー</h3>
                <p><%= visits %></p>
            </div>
            <div class="stat-box">
                <h3>登録訪問者</h3>
                <p><%= visitorCount %></p>
            </div>
            <div class="stat-box">
                <h3>Pod名</h3>
                <p><%= hostname %></p>
            </div>
        </div>
    </div>

    <div class="container">
        <h2>👤 訪問者登録</h2>
        <div class="visitor-form">
            <input type="text" id="visitorName" placeholder="お名前を入力してください">
            <button onclick="addVisitor()">登録</button>
        </div>
    </div>

    <div class="visitor-list">
        <h3>📝 最近の訪問者</h3>
        <div id="visitorsList">読み込み中...</div>
    </div>

    <div class="container">
        <h2>ℹ️ システム情報</h2>
        <p><strong>タイムスタンプ:</strong> <%= timestamp %></p>
        <p><strong>Pod名:</strong> <%= hostname %></p>
        <p><strong>AWS ECS vs Kubernetes:</strong> このアプリケーションはKubernetes上で動作しています！</p>
    </div>

    <script>
        // 訪問者の追加
        function addVisitor() {
            const name = document.getElementById('visitorName').value;
            if (!name) return;

            fetch('/visitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            })
            .then(response => response.json())
            .then(() => {
                document.getElementById('visitorName').value = '';
                loadVisitors();
            });
        }

        // 訪問者一覧の読み込み
        function loadVisitors() {
            fetch('/visitors')
                .then(response => response.json())
                .then(visitors => {
                    const list = visitors.map(v => 
                        `<p>👤 ${v.name} - ${new Date(v.visit_time).toLocaleString('ja-JP')}</p>`
                    ).join('');
                    document.getElementById('visitorsList').innerHTML = list || 'まだ訪問者はいません';
                });
        }

        // ページ読み込み時に訪問者一覧を取得
        loadVisitors();
    </script>
</body>
</html>
```

**Dockerfile**:
```dockerfile
# マルチステージビルド（本番環境最適化）
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app

# セキュリティ: 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# アプリケーションファイルのコピー
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# ファイルの所有者変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3000
CMD ["npm", "start"]
```

## 🐳 Step 2: Dockerイメージの作成

```powershell
# アプリケーションディレクトリに移動
cd c:\dev\k8s\hands-on\sample-app\app

# Dockerイメージのビルド
docker build -t k8s-sample-app:v1.0.0 .

# ローカルテスト（オプション）
docker run -p 3000:3000 k8s-sample-app:v1.0.0

# DockerHubまたはECRにプッシュ（実際のデプロイ用）
# docker tag k8s-sample-app:v1.0.0 your-registry/k8s-sample-app:v1.0.0
# docker push your-registry/k8s-sample-app:v1.0.0
```

## ☸️ Step 3: Kubernetesマニフェストの作成

### 名前空間の作成

**kubernetes/namespace.yaml**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sample-app
  labels:
    name: sample-app
    purpose: learning
```

### 設定管理

**kubernetes/configmap.yaml**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: sample-app
data:
  # アプリケーション設定
  NODE_ENV: "production"
  PORT: "3000"
  
  # Redis設定
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  
  # PostgreSQL設定
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "sampledb"
  DB_USER: "sampleuser"
  
  # PostgreSQL初期化スクリプト
  init.sql: |
    CREATE TABLE IF NOT EXISTS visitors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    INSERT INTO visitors (name) VALUES ('システム管理者') ON CONFLICT DO NOTHING;
```

**kubernetes/secrets.yaml**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: sample-app
type: Opaque
data:
  # パスワードをBase64エンコード（実際の値に置き換えてください）
  DB_PASSWORD: c2FtcGxlcGFzcw==  # samplepass
  POSTGRES_PASSWORD: c2FtcGxlcGFzcw==  # samplepass
```

### PostgreSQLのデプロイ

**kubernetes/postgres/postgres-pvc.yaml**:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: sample-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: gp2  # AWS EBS
```

**kubernetes/postgres/postgres-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: sample-app
  labels:
    app: postgres
spec:
  replicas: 1  # データベースは通常1つ
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: POSTGRES_PASSWORD
        - name: PGDATA
          value: "/var/lib/postgresql/data/pgdata"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-sql
          mountPath: /docker-entrypoint-initdb.d
        livenessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - sampleuser
              - -d
              - sampledb
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - sampleuser
              - -d
              - sampledb
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: init-sql
        configMap:
          name: app-config
          items:
          - key: init.sql
            path: init.sql
```

**kubernetes/postgres/postgres-service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: sample-app
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

### Redisのデプロイ

**kubernetes/redis/redis-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: sample-app
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        livenessProbe:
          exec:
            command:
              - redis-cli
              - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
              - redis-cli
              - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

**kubernetes/redis/redis-service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: sample-app
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

### Webアプリケーションのデプロイ

**kubernetes/web/web-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: sample-app
  labels:
    app: web-app
    version: v1.0.0
spec:
  replicas: 3  # 高可用性のため
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
        version: v1.0.0
    spec:
      containers:
      - name: web
        image: k8s-sample-app:v1.0.0  # 実際のレジストリURLに変更
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DB_PASSWORD
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      # 依存サービスの起動を待つ初期化コンテナ
      initContainers:
      - name: wait-for-db
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z postgres-service 5432; do echo waiting for postgres; sleep 2; done;']
      - name: wait-for-redis
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z redis-service 6379; do echo waiting for redis; sleep 2; done;']
```

**kubernetes/web/web-service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
  namespace: sample-app
  labels:
    app: web-app
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

**kubernetes/web/web-ingress.yaml**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app-ingress
  namespace: sample-app
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
spec:
  rules:
  - host: k8s-sample.yourdomain.com  # 実際のドメインに変更
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app-service
            port:
              number: 80
```

## 🚀 Step 4: デプロイの実行

### 段階的なデプロイ

```powershell
# 1. 名前空間の作成
kubectl apply -f kubernetes/namespace.yaml

# 2. 設定とシークレットの作成
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml

# 3. データベースレイヤーのデプロイ
kubectl apply -f kubernetes/postgres/
kubectl wait --for=condition=ready pod -l app=postgres -n sample-app --timeout=300s

# 4. キャッシュレイヤーのデプロイ
kubectl apply -f kubernetes/redis/
kubectl wait --for=condition=ready pod -l app=redis -n sample-app --timeout=120s

# 5. アプリケーションレイヤーのデプロイ
kubectl apply -f kubernetes/web/
kubectl wait --for=condition=ready pod -l app=web-app -n sample-app --timeout=300s

# 6. デプロイ状況の確認
kubectl get all -n sample-app
```

### 動作確認

```powershell
# Podの状態確認
kubectl get pods -n sample-app

# ログの確認
kubectl logs -l app=web-app -n sample-app --tail=50

# サービスの確認
kubectl get services -n sample-app

# ポートフォワードでローカルアクセス
kubectl port-forward service/web-app-service 8080:80 -n sample-app

# ブラウザで http://localhost:8080 にアクセス
```

## 📊 Step 5: 監視とトラブルシューティング

### 基本的な監視コマンド

```powershell
# リソースの使用状況
kubectl top pods -n sample-app
kubectl top nodes

# イベントの確認
kubectl get events -n sample-app --sort-by='.lastTimestamp'

# Deployment状況の詳細
kubectl describe deployment web-app -n sample-app

# サービスのエンドポイント確認
kubectl get endpoints -n sample-app
```

### よくある問題と対処法

1. **Pod起動エラー**
```powershell
kubectl describe pod <pod-name> -n sample-app
kubectl logs <pod-name> -n sample-app
```

2. **データベース接続エラー**
```powershell
# PostgreSQL接続テスト
kubectl exec -it postgres-pod-name -n sample-app -- psql -U sampleuser -d sampledb -c "SELECT 1;"
```

3. **Ingress設定確認**
```powershell
kubectl describe ingress web-app-ingress -n sample-app
```

## 🔄 Step 6: スケーリングとアップデート

### 手動スケーリング

```powershell
# Webアプリケーションのスケールアウト
kubectl scale deployment web-app --replicas=5 -n sample-app

# スケーリング確認
kubectl get pods -l app=web-app -n sample-app
```

### アプリケーションの更新

```powershell
# 新しいイメージでの更新
kubectl set image deployment/web-app web=k8s-sample-app:v1.1.0 -n sample-app

# ロールアウト状況の確認
kubectl rollout status deployment/web-app -n sample-app

# ロールバック（必要に応じて）
kubectl rollout undo deployment/web-app -n sample-app
```

## 🧹 Step 7: クリーンアップ

```powershell
# アプリケーション全体の削除
kubectl delete namespace sample-app

# または個別削除
kubectl delete -f kubernetes/web/
kubectl delete -f kubernetes/redis/
kubectl delete -f kubernetes/postgres/
kubectl delete -f kubernetes/configmap.yaml
kubectl delete -f kubernetes/secrets.yaml
kubectl delete -f kubernetes/namespace.yaml
```

## 📝 まとめと学習ポイント

このハンズオン演習を通じて学習できたこと：

✅ **マルチティア アーキテクチャ**: Web + Cache + Database  
✅ **設定管理**: ConfigMap と Secret の使い分け  
✅ **永続化**: PersistentVolume によるデータ保持  
✅ **ヘルスチェック**: Liveness と Readiness Probe  
✅ **サービス間通信**: DNS ベースの内部通信  
✅ **Ingress**: 外部からのアクセス制御  
✅ **依存関係管理**: InitContainer による起動順序制御  

### AWS ECSとの比較ポイント

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **設定ファイル** | JSON形式 | YAML形式（より読みやすい） |
| **サービス間通信** | Service Connect | DNS自動解決 |
| **設定管理** | Parameter Store | ConfigMap/Secret |
| **永続化** | EFS統合 | PV/PVC抽象化 |
| **ヘルスチェック** | ALB統合 | Pod単位制御 |
| **スケーリング** | Service設定 | HPA/VPA |

---

**次へ**: [設定管理とSecret](../guides/05-config-management.md)
