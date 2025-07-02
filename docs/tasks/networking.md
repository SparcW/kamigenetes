# 🌐 Kubernetesネットワーキング実践ガイド

このガイドでは、Kubernetesにおけるネットワーキングの実装と管理について、AWS ECS経験者向けに詳しく解説します。Service、Ingress、NetworkPolicyなどの設定を通じて、マイクロサービス間通信やセキュリティ境界の実装を学習します。

## 📋 目次

1. [AWS ECSとの対応関係](#aws-ecsとの対応関係)
2. [Kubernetesネットワークモデル](#kubernetesネットワークモデル)
3. [Service設定](#service設定)
4. [Ingress設定](#ingress設定)
5. [NetworkPolicy実装](#networkpolicy実装)
6. [DNS・サービスディスカバリ](#dnsサービスディスカバリ)
7. [実践演習](#実践演習)

## 🔄 AWS ECSとの対応関係

### ネットワーキング概念マッピング

| AWS ECS/AWS | Kubernetes | 説明 |
|-------------|------------|------|
| **ALB/NLB** | **Ingress Controller** | 外部からの HTTP/HTTPS ロードバランシング |
| **Target Group** | **Service** | アプリケーションへのトラフィック分散 |
| **Service Discovery** | **Service + DNS** | サービス間通信とエンドポイント発見 |
| **VPC** | **Cluster Network** | ネットワーク境界の定義 |
| **Security Group** | **NetworkPolicy** | ネットワークレベルアクセス制御 |
| **ECS Service Connect** | **Service Mesh (Istio)** | サービス間通信の管理・監視 |
| **Route 53** | **ExternalDNS** | 外部DNSとの統合 |
| **VPC Endpoint** | **Service (ExternalName)** | 外部サービスへの接続 |

### 通信パターンの違い

```yaml
# AWS ECS: Task間通信（Service Connect）
version: '3'
services:
  frontend:
    # ...
    depends_on:
      - backend
    environment:
      - BACKEND_URL=http://backend:8080
  backend:
    # ...
```

```yaml
# Kubernetes: Pod間通信（Service経由）
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
  - port: 8080
    targetPort: 8080
---
# frontendからは http://backend-service:8080 でアクセス
```

## 🌐 Kubernetesネットワークモデル

### 基本原則

1. **すべてのPodは一意のIPアドレスを持つ**
2. **Pod間はNATなしで直接通信可能**
3. **ノード上のエージェントはそのノードのすべてのPodと通信可能**
4. **HostNetworkモードのPodはノードIPを使用**

### ネットワーク構成図

```
┌─────────────────────────────────────────────┐
│               Cluster Network               │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │      Node 1     │  │      Node 2     │   │
│  │  ┌───┐  ┌───┐   │  │  ┌───┐  ┌───┐   │   │
│  │  │Pod│  │Pod│   │  │  │Pod│  │Pod│   │   │
│  │  │IP │  │IP │   │  │  │IP │  │IP │   │   │
│  │  └───┘  └───┘   │  │  └───┘  └───┘   │   │
│  │    CNI Plugin    │  │    CNI Plugin    │   │
│  └─────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────┘
          │                      │
          └──────── Service ──────┘
                     │
               ┌─────────────┐
               │   Ingress   │
               └─────────────┘
                     │
              ┌─────────────────┐
              │ Load Balancer   │
              │   (External)    │
              └─────────────────┘
```

## 🎯 Service設定

### Service種別と使用用途

#### 1. ClusterIP (デフォルト)

```yaml
# 内部通信専用Service
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: backend
    version: v1
  ports:
  - name: http
    port: 8080
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
```

**AWS ECS比較**: Service Discovery + Target Groupの内部通信機能に相当。

#### 2. NodePort

```yaml
# ノードのポートを使用した外部公開
apiVersion: v1
kind: Service
metadata:
  name: debug-service
spec:
  type: NodePort
  selector:
    app: debug-app
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080  # 30000-32767の範囲
    protocol: TCP
```

**使用例**: 開発環境でのデバッグアクセス、管理ツールへの一時的なアクセス。

#### 3. LoadBalancer

```yaml
# 外部ロードバランサーとの統合
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "tcp"
spec:
  type: LoadBalancer
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
  loadBalancerSourceRanges:
  - 203.0.113.0/24  # 許可するIPレンジ
```

**AWS ECS比較**: ALB/NLBの直接統合に相当。

#### 4. ExternalName

```yaml
# 外部サービスへのエイリアス
apiVersion: v1
kind: Service
metadata:
  name: external-database
spec:
  type: ExternalName
  externalName: rds.us-west-2.amazonaws.com
  ports:
  - port: 5432
    targetPort: 5432
```

**AWS ECS比較**: VPC Endpointやクロスサービス通信に相当。

### Service詳細設定

#### セッションアフィニティ

```yaml
apiVersion: v1
kind: Service
metadata:
  name: stateful-service
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3時間
  selector:
    app: stateful-app
  ports:
  - port: 80
    targetPort: 8080
```

#### ヘルスチェック設定

```yaml
# Serviceと連動するPodのヘルスチェック
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: nginx:1.21
        ports:
        - containerPort: 80
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 15
          periodSeconds: 20
```

## 🚪 Ingress設定

### 基本的なIngress

```yaml
# HTTP/HTTPSトラフィックのルーティング
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
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
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### AWS ALB Controller使用例

```yaml
# AWS Application Load Balancerとの統合
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: alb-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '5'
    alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=60
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
```

### 複数環境でのIngress設定

```yaml
# 開発環境用
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dev-ingress
  namespace: development
  annotations:
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
spec:
  rules:
  - host: dev.myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
---
# 本番環境用
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: prod-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: prod-tls-secret
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
```

## 🔒 NetworkPolicy実装

### デフォルト拒否ポリシー

```yaml
# すべての通信を拒否（セキュリティの基本）
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

### アプリケーション層の通信制御

```yaml
# フロントエンド → バックエンド通信のみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
---
# バックエンド → データベース通信のみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-to-database
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

### 名前空間間通信制御

```yaml
# 監視システムからの通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
  namespace: production
spec:
  podSelector:
    matchLabels:
      monitoring: "true"
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090  # Prometheusメトリクス
```

### 外部通信制御

```yaml
# 外部APIへの通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-client
  policyTypes:
  - Egress
  egress:
  - to: []  # すべての外部IPを許可
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 80   # HTTP
  - to:
    - namespaceSelector: {}  # クラスター内名前空間
  - to: []  # DNS解決用
    ports:
    - protocol: UDP
      port: 53
```

## 🔍 DNS・サービスディスカバリ

### DNS レコードパターン

```bash
# Service DNS名
<service-name>.<namespace>.svc.cluster.local

# 実例
backend-service.production.svc.cluster.local
database.production.svc.cluster.local
frontend.development.svc.cluster.local
```

### 同一名前空間内の簡略記法

```yaml
# 同一名前空間内では短縮形が使用可能
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  database_url: "postgresql://database:5432/myapp"  # database.production.svc.cluster.localの短縮形
  redis_url: "redis://redis:6379"
  api_endpoint: "http://backend-service:8080/api"
```

### カスタムDNS設定

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns-pod
spec:
  dnsPolicy: "None"
  dnsConfig:
    nameservers:
    - 8.8.8.8
    - 1.1.1.1
    searches:
    - production.svc.cluster.local
    - svc.cluster.local
    - cluster.local
    options:
    - name: ndots
      value: "2"
  containers:
  - name: app
    image: nginx
```

### ヘッドレスService

```yaml
# ヘッドレスService（クラスターIPなし）
apiVersion: v1
kind: Service
metadata:
  name: headless-service
spec:
  clusterIP: None  # ヘッドレスService
  selector:
    app: database
  ports:
  - port: 5432
    targetPort: 5432
```

```bash
# ヘッドレスServiceのDNS解決
# A レコードがすべてのPod IPを返す
nslookup headless-service.production.svc.cluster.local
# Server: 10.96.0.10
# Address: 10.96.0.10#53
# 
# Name: headless-service.production.svc.cluster.local
# Address: 10.244.1.10  # Pod 1
# Address: 10.244.2.15  # Pod 2
# Address: 10.244.3.22  # Pod 3
```

## 🛠 実践演習

### 演習1: マイクロサービス通信環境の構築

**目標**: フロントエンド、バックエンド、データベースの3層アーキテクチャをService経由で接続

```bash
# 1. 名前空間作成
kubectl create namespace microservices

# 2. データベース層のデプロイ
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: microservices
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
        image: postgres:13
        env:
        - name: POSTGRES_DB
          value: myapp
        - name: POSTGRES_USER
          value: user
        - name: POSTGRES_PASSWORD
          value: password
        ports:
        - containerPort: 5432
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: microservices
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF

# 3. バックエンド層のデプロイ
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: microservices
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: node:16-alpine
        command: ["/bin/sh"]
        args: ["-c", "echo 'Backend running' && sleep 3600"]
        env:
        - name: DATABASE_URL
          value: "postgresql://user:password@postgres-service:5432/myapp"
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: microservices
spec:
  selector:
    app: backend
  ports:
  - port: 8080
    targetPort: 8080
EOF

# 4. フロントエンド層のデプロイ
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: microservices
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
        image: nginx:1.21
        env:
        - name: BACKEND_URL
          value: "http://backend-service:8080"
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: microservices
spec:
  type: LoadBalancer
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
EOF
```

```bash
# 5. 通信確認
kubectl get services -n microservices
kubectl exec -n microservices -it deployment/backend -- nslookup postgres-service
kubectl exec -n microservices -it deployment/frontend -- nslookup backend-service
```

### 演習2: NetworkPolicyによるセキュリティ実装

```bash
# 1. デフォルト拒否ポリシーの適用
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: microservices
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# 2. 必要な通信のみ許可
kubectl apply -f - <<EOF
# フロントエンド → バックエンド
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: microservices
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
---
# バックエンド → データベース
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-to-database
  namespace: microservices
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
---
# 外部からフロントエンドへのアクセス許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-ingress
  namespace: microservices
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  ingress:
  - ports:
    - protocol: TCP
      port: 80
---
# DNS解決とクラスター通信のためのEgress許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: microservices
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
  - to:
    - namespaceSelector: {}
EOF
```

```bash
# 3. 通信テスト
kubectl exec -n microservices -it deployment/frontend -- wget -qO- backend-service:8080 || echo "通信確認"
kubectl exec -n microservices -it deployment/backend -- nc -zv postgres-service 5432 || echo "DB接続確認"
```

### 演習3: Ingress設定とドメインルーティング

```bash
# 1. NGINX Ingress Controllerのインストール（Minikube）
minikube addons enable ingress

# 2. Ingressリソースの作成
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: microservices-ingress
  namespace: microservices
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  rules:
  - host: myapp.local
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
EOF

# 3. ローカルDNS設定（/etc/hosts）
echo "$(minikube ip) myapp.local" | sudo tee -a /etc/hosts

# 4. 動作確認
curl http://myapp.local/
curl http://myapp.local/api/health
```

## 🎯 ベストプラクティス

### 1. Service設計原則

```yaml
# ✅ 良い例: 明確な責任分離
apiVersion: v1
kind: Service
metadata:
  name: user-api
  labels:
    component: api
    domain: user
    environment: production
spec:
  selector:
    app: user-service
    version: v1
  ports:
  - name: http
    port: 8080
    targetPort: http
  - name: metrics
    port: 9090
    targetPort: metrics
```

### 2. NetworkPolicy段階的実装

```bash
# 段階1: 監視・ログ機能の確保
kubectl apply -f monitoring-network-policy.yaml

# 段階2: アプリケーション間通信の制限
kubectl apply -f app-to-app-network-policy.yaml

# 段階3: 外部通信の制限
kubectl apply -f external-access-network-policy.yaml

# 段階4: デフォルト拒否の適用
kubectl apply -f deny-all-network-policy.yaml
```

### 3. DNS最適化

```yaml
# DNS設定の最適化
apiVersion: v1
kind: Pod
spec:
  dnsConfig:
    options:
    - name: ndots
      value: "1"  # デフォルトの5から削減
    - name: timeout
      value: "1"
    - name: attempts
      value: "2"
```

## 🔧 トラブルシューティング

### Service接続問題の診断

```bash
# 1. Service確認
kubectl get svc -n microservices
kubectl describe svc backend-service -n microservices

# 2. Endpoint確認
kubectl get endpoints backend-service -n microservices

# 3. Pod状態確認
kubectl get pods -n microservices -l app=backend
kubectl describe pod <pod-name> -n microservices

# 4. ネットワーク接続テスト
kubectl exec -n microservices -it deployment/frontend -- nslookup backend-service
kubectl exec -n microservices -it deployment/frontend -- telnet backend-service 8080
```

### NetworkPolicy問題の診断

```bash
# 1. NetworkPolicy一覧確認
kubectl get networkpolicy -n microservices

# 2. 詳細確認
kubectl describe networkpolicy deny-all -n microservices

# 3. Pod通信テスト
kubectl exec -n microservices -it deployment/frontend -- wget --timeout=5 backend-service:8080

# 4. CNIログ確認（Calico例）
kubectl logs -n kube-system -l k8s-app=calico-node
```

### DNS解決問題の診断

```bash
# 1. DNS設定確認
kubectl exec -n microservices -it deployment/frontend -- cat /etc/resolv.conf

# 2. DNS解決テスト
kubectl exec -n microservices -it deployment/frontend -- nslookup kubernetes.default.svc.cluster.local

# 3. CoreDNS状態確認
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

## 📊 監視とメトリクス

### Service監視設定

```yaml
# ServiceMonitor（Prometheus Operator）
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: microservices-monitor
  namespace: microservices
spec:
  selector:
    matchLabels:
      monitoring: enabled
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### ネットワークポリシー監視

```yaml
# Falco rule for NetworkPolicy violations
- rule: Network Policy Violation
  desc: Detect network policy violations
  condition: k8s_audit and ka.verb=create and ka.resource.resource=networkpolicies
  output: NetworkPolicy created (user=%ka.user.name resource=%ka.resource.name reason=%ka.reason)
  priority: INFO
```

---

**AWS ECS管理者へのアドバイス**: 
Kubernetesのネットワーキングは、AWSの各種サービス（ALB、Security Group、Route 53等）の機能が統合されて提供されています。まずは基本的なService → Ingress → NetworkPolicyの流れを理解し、段階的にセキュリティを強化していくアプローチをお勧めします。
