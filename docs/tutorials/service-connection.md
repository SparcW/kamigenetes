# 🔗 サービス接続 - マイクロサービス間の通信

このチュートリアルでは、Kubernetes上でマイクロサービス間の通信を設定し、サービスディスカバリーを実装する方法を学習します。AWS ECS経験者向けに、ALB/NLBやService Discoveryとの比較を交えて解説します。

## 🎯 学習目標

- **Service概念**: ClusterIP、NodePort、LoadBalancerの理解
- **DNS解決**: Kubernetesのサービスディスカバリー
- **ネットワーク通信**: Pod間、Service間の通信パターン
- **ロードバランシング**: トラフィック分散の仕組み

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 移行のポイント |
|------|---------|------------|---------------|
| **サービス検出** | Service Discovery | DNS/Service | 自動DNS解決 |
| **ロードバランサー** | ALB/NLB | Service | タイプ別の使い分け |
| **内部通信** | Task間直接通信 | Service経由 | サービス抽象化 |
| **ヘルスチェック** | ALB Target Health | Readiness Probe | Pod単位での制御 |

## 🏗️ 1. Service の基本概念

### Service の種類と用途

```yaml
# ClusterIP - クラスター内部通信
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  labels:
    app: backend
spec:
  type: ClusterIP  # デフォルト
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
```

```yaml
# NodePort - 外部からのアクセス（開発用）
apiVersion: v1
kind: Service
metadata:
  name: frontend-nodeport
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
    nodePort: 30080  # 30000-32767の範囲
```

```yaml
# LoadBalancer - 本格的な外部公開
apiVersion: v1
kind: Service
metadata:
  name: api-loadbalancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
spec:
  type: LoadBalancer
  selector:
    app: api
  ports:
  - port: 443
    targetPort: 8443
    protocol: TCP
```

## 🌐 2. マイクロサービスアーキテクチャの実装

### フロントエンド（React アプリケーション）

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  labels:
    app: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: my-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: REACT_APP_API_URL
          value: "http://api-service/api/v1"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: ClusterIP
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
```

### API サーバー（Node.js）

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: my-api:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres-service:5432/myapp"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: PORT
          value: "8080"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "400m"
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 8080
```

### データベース（PostgreSQL）

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  labels:
    app: postgres
spec:
  replicas: 1
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
        image: postgres:15
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "myapp"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
spec:
  type: ClusterIP
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

### キャッシュ（Redis）

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
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
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

## 🔧 3. サービスディスカバリーの実装

### DNS ベースの接続

Kubernetesでは、Serviceに対して自動的にDNSエントリが作成されます：

```bash
# サービス名での接続（同一Namespace）
curl http://api-service/health

# FQDN での接続
curl http://api-service.default.svc.cluster.local/health

# 他のNamespaceのサービス
curl http://api-service.production.svc.cluster.local/health
```

### 環境変数による接続

```yaml
# 自動生成される環境変数
spec:
  containers:
  - name: frontend
    image: my-frontend:latest
    # 以下の環境変数が自動的に作成される
    # API_SERVICE_SERVICE_HOST=10.96.0.1
    # API_SERVICE_SERVICE_PORT=80
```

### ConfigMap による設定

```yaml
# service-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: service-config
data:
  api_service_url: "http://api-service"
  database_service_url: "postgresql://postgres-service:5432"
  redis_service_url: "redis://redis-service:6379"
  max_connections: "100"
  timeout: "30s"
---
# ConfigMapを使用したDeployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
      - name: frontend
        image: my-frontend:latest
        envFrom:
        - configMapRef:
            name: service-config
```

## 🎭 4. 高度なサービス制御

### ヘッドレスサービス（Headless Service）

```yaml
# headless-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: database-headless
spec:
  clusterIP: None  # ヘッドレス
  selector:
    app: database
  ports:
  - port: 5432
    targetPort: 5432
```

StatefulSetやカスタムロードバランシングが必要な場合に使用。

### External Service（外部サービス連携）

```yaml
# external-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: external-api
spec:
  type: ExternalName
  externalName: api.external-service.com
  ports:
  - port: 443
    targetPort: 443
```

### Endpoints の手動管理

```yaml
# custom-endpoints.yaml
apiVersion: v1
kind: Service
metadata:
  name: legacy-system
spec:
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: v1
kind: Endpoints
metadata:
  name: legacy-system
subsets:
- addresses:
  - ip: 192.168.1.100
  - ip: 192.168.1.101
  ports:
  - port: 8080
```

## 🌍 5. Ingress による外部公開

### Nginx Ingress Controller

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: tls-secret
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
```

## 🔍 6. デプロイメントと動作確認

### 手順1: 基本リソースの作成

```bash
# Namespace作成
kubectl create namespace microservices

# Secret作成
kubectl create secret generic postgres-secret \
  --from-literal=username=postgres \
  --from-literal=password=mysecretpassword \
  -n microservices

# PVC作成
kubectl apply -f postgres-pvc.yaml -n microservices
```

### 手順2: アプリケーションデプロイ

```bash
# バックエンドサービスから順番にデプロイ
kubectl apply -f postgres-deployment.yaml -n microservices
kubectl apply -f redis-deployment.yaml -n microservices

# APIサービス
kubectl apply -f api-deployment.yaml -n microservices

# フロントエンド
kubectl apply -f frontend-deployment.yaml -n microservices

# Ingress
kubectl apply -f ingress.yaml -n microservices
```

### 手順3: 動作確認

```bash
# Pod状態確認
kubectl get pods -n microservices

# Service確認
kubectl get svc -n microservices

# DNS解決テスト
kubectl exec -it frontend-xxx -n microservices -- nslookup api-service

# 接続テスト
kubectl exec -it frontend-xxx -n microservices -- curl http://api-service/health
```

## 🔄 7. トラフィック管理

### Service での負荷分散

```yaml
# session-affinity.yaml
apiVersion: v1
kind: Service
metadata:
  name: sticky-service
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 8080
  sessionAffinity: ClientIP  # セッション親和性
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

### 複数ポートの公開

```yaml
# multi-port-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: multi-port-service
spec:
  selector:
    app: multi-app
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: https
    port: 443
    targetPort: 8443
  - name: metrics
    port: 9090
    targetPort: 9090
```

## 🧪 実践演習

### 演習1: 基本的なマイクロサービス構築

1. **3層アーキテクチャの構築**
   - フロントエンド（Nginx）
   - API（Node.js/Python）
   - データベース（PostgreSQL）

2. **サービス間通信の確認**
   ```bash
   # フロントエンドからAPIへの接続
   kubectl exec -it frontend-xxx -- curl http://api-service/health
   
   # APIからデータベースへの接続
   kubectl exec -it api-xxx -- nc -zv postgres-service 5432
   ```

### 演習2: サービスディスカバリーのテスト

1. **DNS解決の確認**
   ```bash
   # 各Podから他サービスの名前解決
   kubectl exec -it frontend-xxx -- nslookup api-service
   kubectl exec -it api-xxx -- nslookup postgres-service
   ```

2. **環境変数の確認**
   ```bash
   kubectl exec -it frontend-xxx -- env | grep SERVICE
   ```

### 演習3: 障害対応とフェイルオーバー

1. **Pod削除による自動回復**
   ```bash
   kubectl delete pod api-xxx
   kubectl get pods -w  # 自動再作成を監視
   ```

2. **Serviceエンドポイントの確認**
   ```bash
   kubectl get endpoints api-service
   ```

## 🎯 ベストプラクティス

### パフォーマンス

- **適切なService選択**: 用途に応じたService typeの選択
- **DNS キャッシュ**: アプリケーションレベルでのDNSキャッシュ
- **Keep-Alive**: 長時間接続でのパフォーマンス向上

### セキュリティ

- **NetworkPolicy**: サービス間通信の制限
- **TLS通信**: 内部通信でもTLS使用
- **認証・認可**: サービス間のmTLS実装

### 運用

- **ヘルスチェック**: 適切なreadiness/livenessProbe設定
- **監視**: サービスメッシュによる可視化
- **ログ**: 分散トレーシング対応

## 🚨 トラブルシューティング

### 接続エラーの診断

```bash
# Service確認
kubectl get svc
kubectl describe svc api-service

# Endpoints確認
kubectl get endpoints api-service

# DNS確認
kubectl exec -it test-pod -- nslookup api-service

# ネットワーク接続確認
kubectl exec -it test-pod -- telnet api-service 80
```

### パフォーマンス問題

```bash
# Podリソース使用量
kubectl top pods

# Service負荷分散確認
kubectl get endpoints api-service -o yaml
```

## 📚 参考リソース

- **[Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)**
- **[DNS for Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)**
- **[Ingress Controllers](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/)**
- **[Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)**

---

**次のステップ**: [設定管理](./configuration.md) → [セキュリティ実装](./security.md) → [実践タスク](../tasks/)
