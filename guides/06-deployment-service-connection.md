# DeploymentとServiceの関連付けガイド

## 基本概念

### DeploymentとServiceの関係
- **Deployment**: アプリケーションPodの管理（レプリカ数、更新戦略など）
- **Service**: ネットワークアクセスの抽象化（ロードバランサー、エンドポイント管理）
- **関連付け**: ラベルセレクターを使用して連携

## 関連付けの仕組み

### 1. ラベルセレクターによる関連付け

#### Deployment側（Pod template）
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx        # ← DeploymentがこのラベルのPodを管理
  template:
    metadata:
      labels:
        app: nginx      # ← Podに付与されるラベル
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
```

#### Service側
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx          # ← このラベルを持つPodにトラフィックを転送
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

### 2. 関連付けの確認方法

```bash
# Podのラベルを確認
kubectl get pods --show-labels

# Serviceのセレクターを確認
kubectl get service [service-name] -o wide

# エンドポイント（実際の接続先Pod）を確認
kubectl get endpoints [service-name]

# ServiceとPodの関連付け詳細
kubectl describe service [service-name]
```

## 実践例

### 基本的な関連付け例
```yaml
# deployment.yaml
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
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web-app
    tier: frontend    # 複数のラベルで詳細に選択
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### 複数ポートの関連付け
```yaml
# Multi-port service example
apiVersion: v1
kind: Service
metadata:
  name: multi-port-service
spec:
  selector:
    app: web-app
  ports:
  - name: http
    port: 80
    targetPort: 8080    # コンテナの8080ポートにマッピング
  - name: https
    port: 443
    targetPort: 8443    # コンテナの8443ポートにマッピング
  type: LoadBalancer
```

## AWS ECSとの比較

| 要素 | AWS ECS | Kubernetes |
|------|---------|------------|
| 関連付け方法 | タスク定義内で定義 | ラベルセレクター |
| ロードバランサー | ALB/NLBで自動設定 | Serviceリソースで設定 |
| ポートマッピング | タスク定義内 | Service内のports設定 |
| サービス発見 | ECS Service Discovery | DNS + EndpointSlice |
| ヘルスチェック | ALB Target Group | Readiness/Liveness Probe |

### ECSタスク定義例（参考）
```json
{
  "family": "nginx-task",
  "containerDefinitions": [
    {
      "name": "nginx",
      "image": "nginx:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

### 対応するKubernetes設定
```yaml
# Deployment + Service の組み合わせ
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

## トラブルシューティング

### 1. Serviceに接続できない場合

```bash
# Step 1: Podが存在するか確認
kubectl get pods -l app=nginx

# Step 2: Podのラベルを確認
kubectl get pods --show-labels

# Step 3: Serviceのセレクターを確認
kubectl describe service nginx-service

# Step 4: エンドポイントが作成されているか確認
kubectl get endpoints nginx-service
```

### 2. よくある問題と解決法

#### 問題: エンドポイントが空
```bash
$ kubectl get endpoints nginx-service
NAME            ENDPOINTS   AGE
nginx-service   <none>      5m
```

**原因**: ラベルセレクターの不一致

**解決法**:
```bash
# Podのラベルを確認
kubectl get pods --show-labels

# Serviceのセレクターを確認
kubectl get service nginx-service -o yaml | grep -A3 selector

# ラベルを修正
kubectl label pod [pod-name] app=nginx
```

#### 問題: ポートに接続できない
```bash
# コンテナのポートを確認
kubectl describe pod [pod-name]

# Serviceのポート設定を確認
kubectl describe service [service-name]
```

### 3. 動的な関連付け変更

```bash
# 実行中のPodのラベルを変更
kubectl label pod [pod-name] app=new-app

# Serviceのセレクターを変更
kubectl patch service [service-name] -p '{"spec":{"selector":{"app":"new-app"}}}'
```

## ベストプラクティス

### 1. ラベル命名規則
```yaml
labels:
  app: nginx                    # アプリケーション名
  component: web               # コンポーネント（web, api, db など）
  tier: frontend               # ティア（frontend, backend など）
  version: v1.0.0              # バージョン
  environment: production      # 環境
```

### 2. セレクターの設計
```yaml
# 基本的なセレクター
selector:
  app: nginx

# より詳細なセレクター
selector:
  app: nginx
  tier: frontend
  version: v1.0.0
```

### 3. 複数環境での管理
```yaml
# production環境
metadata:
  name: nginx-service-prod
spec:
  selector:
    app: nginx
    environment: production

# staging環境
metadata:
  name: nginx-service-staging
spec:
  selector:
    app: nginx
    environment: staging
```

## 確認コマンド一覧

```bash
# 基本的な確認
kubectl get deployments
kubectl get services
kubectl get pods --show-labels

# 詳細確認
kubectl describe deployment [deployment-name]
kubectl describe service [service-name]
kubectl get endpoints [service-name]

# 関連付け確認
kubectl get pods -l app=nginx          # ラベルでPodを絞り込み
kubectl get service -o wide            # Serviceのセレクターを表示

# トラブルシューティング
kubectl logs -l app=nginx              # 関連するPodのログ
kubectl port-forward service/[service-name] 8080:80  # ローカルテスト
```

## まとめ

1. **ラベルセレクター**: Deployment（Pod template）とServiceをラベルで関連付け
2. **ポートマッピング**: `containerPort`（Deployment）と`targetPort`（Service）を合わせる
3. **動作確認**: `kubectl get endpoints`でPodとServiceの関連付けを確認
4. **AWS ECS比較**: ECSのタスク定義とサービスの関係に類似
5. **トラブルシューティング**: ラベルとセレクターの一致を最初に確認
