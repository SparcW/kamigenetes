# 💼 ワークロード (Workloads)

## 概要

ワークロードは、Kubernetesで実行されるアプリケーションを表す概念です。AWS ECS管理者の視点から、タスクとサービスに相当するKubernetesのワークロード管理について詳しく学習します。

## 🎯 学習目標

- Pod、Deployment、Service の関係性を理解する
- AWS ECSのタスクとサービスとの対応を把握する
- ワークロードのライフサイクル管理方法を習得する
- 実際の運用で使用するパターンを理解する

## 🧩 ワークロードの全体像

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Workloads                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────┐ │
│  │   Deployment    │    │    Service      │    │ Ingress  │ │
│  │                 │    │                 │    │          │ │
│  │  ┌───────────┐  │    │  Load Balancer  │    │   L7 LB  │ │
│  │  │ReplicaSet │  │────▶│   & Discovery   │◀───│ Routing  │ │
│  │  │           │  │    │                 │    │          │ │
│  │  │ ┌───────┐ │  │    └─────────────────┘    └──────────┘ │
│  │  │ │ Pod 1 │ │  │                                        │
│  │  │ │ Pod 2 │ │  │                                        │
│  │  │ │ Pod 3 │ │  │                                        │
│  │  │ └───────┘ │  │                                        │
│  │  └───────────┘  │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## 🏃 Pod: 最小実行単位

### 基本概念

**Pod**は、1つ以上のコンテナをグループ化した最小のデプロイ可能な単位です。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-app
  labels:
    app: web-server
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "200m"
```

### AWS ECS との比較

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **最小単位** | Task | Pod |
| **コンテナ数** | 1つのタスクに複数コンテナ | 1つのPodに複数コンテナ |
| **ネットワーク** | ENI per task | 共有ネットワーク名前空間 |
| **ストレージ** | ボリューム共有 | ボリューム共有 |
| **ライフサイクル** | タスク停止で全コンテナ停止 | Pod削除で全コンテナ削除 |

### マルチコンテナPodの例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app-with-sidecar
spec:
  containers:
  # メインアプリケーション
  - name: web-app
    image: nginx:1.21
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/nginx
  
  # ログ収集サイドカー
  - name: log-shipper
    image: fluent/fluent-bit:1.8
    volumeMounts:
    - name: shared-logs
      mountPath: /logs
    - name: fluent-bit-config
      mountPath: /fluent-bit/etc
  
  volumes:
  - name: shared-logs
    emptyDir: {}
  - name: fluent-bit-config
    configMap:
      name: fluent-bit-config
```

### Pod のライフサイクル

```bash
# Pod の状態確認
kubectl get pods -o wide

# Pod の詳細情報
kubectl describe pod simple-app

# Pod のログ確認
kubectl logs simple-app

# Pod 内でのコマンド実行
kubectl exec -it simple-app -- /bin/bash

# Pod の削除
kubectl delete pod simple-app
```

## 🚀 Deployment: 宣言的なアプリケーション管理

### 基本概念

**Deployment**は、Podの宣言的な管理を提供し、ローリングアップデートやスケーリングを自動化します。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app-deployment
  labels:
    app: web-app
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
      - name: web-app
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        # ヘルスチェック
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

### AWS ECS サービスとの比較

| 機能 | AWS ECS Service | Kubernetes Deployment |
|------|-----------------|------------------------|
| **レプリカ管理** | Desired Count | replicas |
| **ヘルスチェック** | Target Group Health Check | Liveness/Readiness Probe |
| **デプロイ戦略** | Rolling Update | Rolling Update + その他 |
| **ロールバック** | 手動でタスク定義変更 | kubectl rollout undo |
| **スケーリング** | Service 更新 | kubectl scale |
| **自動復旧** | 自動でタスク再作成 | 自動でPod再作成 |

### Deployment の操作

```bash
# Deployment の作成
kubectl apply -f deployment.yaml

# Deployment の確認
kubectl get deployments
kubectl describe deployment web-app-deployment

# スケーリング
kubectl scale deployment web-app-deployment --replicas=5

# ローリングアップデート
kubectl set image deployment/web-app-deployment web-app=nginx:1.22

# ロールアウト状況確認
kubectl rollout status deployment/web-app-deployment

# ロールアウト履歴
kubectl rollout history deployment/web-app-deployment

# ロールバック
kubectl rollout undo deployment/web-app-deployment
```

### ReplicaSet との関係

```bash
# Deployment配下のReplicaSet確認
kubectl get replicasets -l app=web-app

# ReplicaSet詳細
kubectl describe replicaset <replicaset-name>

# Deployment → ReplicaSet → Pod の関係確認
kubectl get all -l app=web-app
```

## 🌐 Service: ネットワーク接続とサービスディスカバリ

### 基本概念

**Service**は、Podへの安定したネットワークアクセスポイントを提供します。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
  labels:
    app: web-app
spec:
  type: ClusterIP  # 内部通信用
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  selector:
    app: web-app
```

### Service タイプ

#### 1. ClusterIP (デフォルト)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: internal-service
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: backend-app
```

#### 2. NodePort
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodeport-service
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080  # 30000-32767の範囲
  selector:
    app: web-app
```

#### 3. LoadBalancer
```yaml
apiVersion: v1
kind: Service
metadata:
  name: loadbalancer-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: web-app
```

### AWS ECS との比較

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **内部通信** | Service Discovery | ClusterIP Service |
| **外部公開** | ALB/NLB | LoadBalancer Service |
| **ポート公開** | Host Port Mapping | NodePort Service |
| **DNS解決** | servicename.namespace | servicename.namespace.svc.cluster.local |
| **ヘルスチェック** | Target Group | Service Endpoint |
| **負荷分散** | ALB/NLB | kube-proxy |

### Service の動作確認

```bash
# Service 一覧
kubectl get services

# Service 詳細
kubectl describe service web-app-service

# Endpoint 確認
kubectl get endpoints web-app-service

# DNS 解決テスト
kubectl run test-pod --image=busybox --rm -it -- nslookup web-app-service

# Service 経由での接続テスト
kubectl run test-pod --image=curlimages/curl --rm -it -- curl http://web-app-service
```

## 🌍 Ingress: 外部からのアクセス制御

### 基本概念

**Ingress**は、HTTP/HTTPSトラフィックの外部からクラスター内サービスへのルーティングを管理します。

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app-service
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
```

### TLS 対応 Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
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
            name: web-app-service
            port:
              number: 80
```

### AWS ECS ALB との比較

| 機能 | AWS ALB | Kubernetes Ingress |
|------|---------|---------------------|
| **L7ルーティング** | Target Group Rules | Ingress Rules |
| **SSL終端** | ACM統合 | TLS Secret |
| **パスベースルーティング** | Listener Rules | Path Rules |
| **ホストベースルーティング** | Host Header Rules | Host Rules |
| **認証** | Cognito/OIDC | External Auth |
| **アノテーション** | ALB Ingress Controller | Ingress Controller固有 |

## 🔄 実践的なワークロードパターン

### 1. ステートレスWebアプリケーション

```yaml
# Web Tier
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
      tier: frontend
  template:
    metadata:
      labels:
        app: web-app
        tier: frontend
    spec:
      containers:
      - name: web-app
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
spec:
  selector:
    app: web-app
    tier: frontend
  ports:
  - port: 80
    targetPort: 80
```

### 2. マイクロサービスアーキテクチャ

```yaml
# API Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-service
      tier: backend
  template:
    metadata:
      labels:
        app: api-service
        tier: backend
    spec:
      containers:
      - name: api
        image: node:16-alpine
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
---
# User Service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: user-service
      tier: backend
  template:
    metadata:
      labels:
        app: user-service
        tier: backend
    spec:
      containers:
      - name: user-api
        image: node:16-alpine
        ports:
        - containerPort: 3001
```

### 3. バッチジョブワークロード

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: data-processor
spec:
  template:
    spec:
      containers:
      - name: processor
        image: python:3.9
        command: ["python", "process.py"]
        env:
        - name: BATCH_SIZE
          value: "1000"
      restartPolicy: Never
  backoffLimit: 3
---
# 定期実行ジョブ
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-report
spec:
  schedule: "0 6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: report-generator
            image: python:3.9
            command: ["python", "daily_report.py"]
          restartPolicy: OnFailure
```

## 🎛️ ワークロード管理のベストプラクティス

### 1. リソース管理

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    resources:
      requests:  # 最小リソース要求
        memory: "128Mi"
        cpu: "100m"
      limits:    # 最大リソース制限
        memory: "256Mi"
        cpu: "200m"
```

### 2. ヘルスチェック

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    # 生存確認
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
    # 準備完了確認
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
```

### 3. セキュリティコンテキスト

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

### 4. 設定の外部化

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url
    - name: LOG_LEVEL
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: log_level
```

## 🔍 トラブルシューティング

### よくある問題と対策

#### Pod が起動しない
```bash
# Pod状態の確認
kubectl describe pod <pod-name>

# ログの確認
kubectl logs <pod-name>

# 前回のコンテナのログ
kubectl logs <pod-name> --previous

# イベントの確認
kubectl get events --sort-by=.metadata.creationTimestamp
```

#### Service に接続できない
```bash
# Service とエンドポイントの確認
kubectl get service <service-name>
kubectl get endpoints <service-name>

# Pod のラベル確認
kubectl get pods --show-labels

# ネットワークテスト
kubectl run test-pod --image=busybox --rm -it -- wget -O- http://<service-name>:<port>
```

#### Deployment の更新が失敗
```bash
# ロールアウト状況確認
kubectl rollout status deployment/<deployment-name>

# ロールアウト履歴
kubectl rollout history deployment/<deployment-name>

# ReplicaSet 確認
kubectl get replicasets -l app=<app-name>

# 問題のある新しいPod確認
kubectl describe pod <new-pod-name>
```

## 🔗 次のステップ

ワークロードの基本を理解したら、以下のトピックに進んでください：

1. **[設定管理](./configuration.md)** - ConfigMap と Secret の詳細
2. **[ネットワーキング](./networking.md)** - Service とネットワークポリシー
3. **[ストレージ](./storage.md)** - 永続化ボリュームの管理
4. **[ハンズオンラボ](../../hands-on-labs/)** - 実際のアプリケーションデプロイ

## 📚 関連リソース

- [Kubernetes Workloads](https://kubernetes.io/docs/concepts/workloads/)
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)

---

**AWS ECS経験者へのポイント**: ECSのタスクとサービスは、KubernetesのPodとDeploymentに対応しますが、Kubernetesの方がより細かい制御と豊富な機能を提供します。特に宣言的管理とローリングアップデートの機能は、運用の自動化に大きく貢献します。
