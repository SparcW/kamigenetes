# 📝 用語集 - Kubernetes用語とAWS ECS対応表

KubernetesとAWS ECSの用語対応表と、Kubernetesの重要概念の詳細解説です。AWS ECS経験者がスムーズにKubernetesを理解できるよう、既存知識との対応関係を明確にしています。

## 🔄 基本概念の対応表

### インフラストラクチャ

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **Cluster** | **Cluster** | コンテナを実行するインフラストラクチャの集合 |
| **Container Instance** | **Node** | コンテナを実行する個別のマシン（EC2インスタンス等） |
| **ECS Agent** | **kubelet** | ノード上でコンテナを管理するエージェント |
| **Fargate** | **Serverless Nodes** | サーバーレスなコンテナ実行環境 |

### アプリケーション実行

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **Task Definition** | **Pod Specification** | コンテナの実行仕様定義 |
| **Task** | **Pod** | 実際に実行されているコンテナのインスタンス |
| **Service** | **Deployment + Service** | アプリケーションの管理と公開 |
| **Container Definition** | **Container Spec** | 個別コンテナの設定 |

### ネットワーキング

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **ALB/NLB** | **Ingress/Service** | ロードバランサーとトラフィック分散 |
| **Service Discovery** | **Service/DNS** | サービス間の通信と名前解決 |
| **VPC/Subnet** | **Network Policy** | ネットワーク分離とセキュリティ |
| **Security Group** | **Network Policy** | ネットワークレベルのアクセス制御 |

### 設定管理

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **Parameter Store** | **ConfigMap** | 非機密の設定情報管理 |
| **Secrets Manager** | **Secret** | 機密情報（パスワード、APIキー等）管理 |
| **Environment Variables** | **env/envFrom** | 環境変数の設定 |
| **Task Role** | **ServiceAccount** | アプリケーションが使用する権限 |

### スケーリング

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **Auto Scaling** | **HPA (Horizontal Pod Autoscaler)** | 水平スケーリング |
| **Desired Count** | **Replicas** | 実行したいインスタンス数 |
| **Cluster Auto Scaling** | **Cluster Autoscaler** | ノード数の自動調整 |

### 監視・ログ

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **CloudWatch Logs** | **kubectl logs** | ログ収集・確認 |
| **CloudWatch Metrics** | **Metrics Server** | メトリクス監視 |
| **X-Ray** | **Jaeger/Zipkin** | 分散トレーシング |

### デプロイメント

| AWS ECS用語 | Kubernetes用語 | 説明 |
|-------------|----------------|------|
| **Rolling Update** | **Rolling Update** | 無停止でのアプリケーション更新 |
| **Blue/Green Deployment** | **Blue/Green Strategy** | 環境切り替え型デプロイ |
| **CodePipeline** | **ArgoCD/Tekton** | CI/CDパイプライン |

## 📚 Kubernetes重要用語詳解

### Core リソース

#### Pod
```yaml
# Pod: 1つ以上のコンテナをまとめた実行単位
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
spec:
  containers:
  - name: app
    image: nginx:1.21
```
**AWS ECS比較**: Task に相当。ただし、Podは通常直接作成せず、Deploymentから管理される。

#### Service
```yaml
# Service: Podへのアクセス抽象化
apiVersion: v1
kind: Service
metadata:
  name: example-service
spec:
  selector:
    app: example
  ports:
  - port: 80
    targetPort: 80
```
**AWS ECS比較**: ALB/NLBとService Discoveryの機能を統合。

#### Namespace
```yaml
# Namespace: リソースの論理的分離
apiVersion: v1
kind: Namespace
metadata:
  name: development
```
**AWS ECS比較**: ECSクラスターに近いが、より細かい分離が可能。

### Workload リソース

#### Deployment
```yaml
# Deployment: アプリケーションの宣言的管理
apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: example
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
      - name: app
        image: nginx:1.21
```
**AWS ECS比較**: ECS ServiceとTask Definitionの機能を統合。

#### StatefulSet
```yaml
# StatefulSet: ステートフルなアプリケーションの管理
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: database
spec:
  serviceName: "database"
  replicas: 3
  selector:
    matchLabels:
      app: database
  template:
    # Pod template
```
**AWS ECS比較**: ECSには直接対応する機能なし。データベース等の順序付けが必要なアプリケーション向け。

### 設定管理

#### ConfigMap
```yaml
# ConfigMap: 非機密設定情報
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  database_url: "postgresql://db:5432/myapp"
  debug: "false"
```
**AWS ECS比較**: Parameter Storeに相当。

#### Secret
```yaml
# Secret: 機密情報
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  username: YWRtaW4=  # base64 encoded
  password: MWYyZDFlMmU2N2Rm  # base64 encoded
```
**AWS ECS比較**: Secrets Managerに相当。

### ネットワーキング

#### Ingress
```yaml
# Ingress: 外部からの HTTP/HTTPS アクセス制御
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80
```
**AWS ECS比較**: ALBのリスナールールに相当。

#### NetworkPolicy
```yaml
# NetworkPolicy: ネットワークレベルアクセス制御
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```
**AWS ECS比較**: Security Groupに相当。

### ストレージ

#### PersistentVolume (PV)
```yaml
# PersistentVolume: 永続ストレージの定義
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  storageClassName: gp2
  awsElasticBlockStore:
    volumeID: vol-12345678
    fsType: ext4
```

#### PersistentVolumeClaim (PVC)
```yaml
# PersistentVolumeClaim: ストレージの要求
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: example-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: gp2
```
**AWS ECS比較**: EBS Volumeのアタッチメントに相当。

### セキュリティ

#### ServiceAccount
```yaml
# ServiceAccount: Pod の実行権限
apiVersion: v1
kind: ServiceAccount
metadata:
  name: example-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/my-role
```
**AWS ECS比較**: Task Roleに相当。

#### Role/RoleBinding
```yaml
# Role: 権限定義
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
---
# RoleBinding: ユーザーと権限の紐付け
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
subjects:
- kind: ServiceAccount
  name: example-sa
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```
**AWS ECS比較**: IAM Policy/Roleの添付に相当。

## 🔧 重要な概念

### ラベル (Labels) とセレクター (Selectors)
```yaml
# ラベルによるリソース管理
metadata:
  labels:
    app: web
    version: v1.0
    environment: production
    team: platform

# セレクターによる選択
selector:
  matchLabels:
    app: web
    environment: production
```
**AWS ECS比較**: ECS Tagsに似ているが、より強力な選択・グループ化機能。

### アノテーション (Annotations)
```yaml
# メタデータとして付加情報を記録
metadata:
  annotations:
    deployment.kubernetes.io/revision: "1"
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"v1","kind":"Pod"...}
```
**AWS ECS比較**: ECS Tagsに似ているが、システム情報の記録用途。

### Finalizers
```yaml
# リソース削除時の前処理を制御
metadata:
  finalizers:
  - kubernetes.io/pv-protection
```
**AWS ECS比較**: ECSには直接対応する概念なし。リソースのライフサイクル制御。

## 📖 状態 (Status) 関連用語

### Pod の状態
- **Pending**: スケジューリング待ち、イメージダウンロード中
- **Running**: 実行中
- **Succeeded**: 正常終了
- **Failed**: 異常終了
- **Unknown**: 状態不明

### Deployment の状態
- **Progressing**: ロールアウト進行中
- **Complete**: ロールアウト完了
- **Failed**: ロールアウト失敗

### Service の種類
- **ClusterIP**: クラスター内部からのみアクセス可能
- **NodePort**: 各ノードのポートを使用してアクセス
- **LoadBalancer**: 外部ロードバランサーを使用
- **ExternalName**: 外部サービスへのエイリアス

## 🎯 学習時の注意点

### AWS ECS経験者が混同しやすい概念

1. **Service の概念**
   - **ECS Service**: アプリケーション全体の管理
   - **K8s Service**: ネットワークアクセスの抽象化
   - **K8s Deployment**: ECS Serviceに相当

2. **Task vs Pod**
   - **ECS Task**: 通常1つのアプリケーション
   - **K8s Pod**: 1つ以上の密結合コンテナ

3. **スケーリング の対象**
   - **ECS**: Task 数をスケール
   - **K8s**: Pod 数をスケール

---

**学習のコツ**: 
まずAWS ECSとの対応関係を理解し、その上でKubernetes固有の概念（ラベル、アノテーション等）を段階的に学習することをお勧めします。
