# 🔍 Kubernetes概要

Kubernetesを理解するための出発点として、その基本的な特徴、利点、そしてAWS ECSとの比較を学習します。

## 🎯 この章で学ぶこと

- Kubernetesとは何か、なぜ必要なのか
- AWS ECSとの根本的な違いと類似点
- コンテナオーケストレーションの進化
- Kubernetesエコシステムの理解

## 🚀 Kubernetesとは

Kubernetesは、コンテナ化されたアプリケーションのデプロイ、スケーリング、管理を自動化するオープンソースプラットフォームです。

### 核となる特徴

| 特徴 | 説明 | AWS ECSとの比較 |
|------|------|-----------------|
| **宣言的設定** | あるべき状態をYAMLで定義 | Task Definitionと類似、より柔軟 |
| **自動修復** | 失敗したコンテナを自動再起動 | ECSサービスの自動復旧と同等 |
| **水平スケーリング** | 負荷に応じてPod数を自動調整 | Auto Scalingと同等、より細かい制御 |
| **サービスディスカバリ** | 内蔵DNS、自動ロードバランシング | Service Discoveryより高機能 |
| **ローリングアップデート** | ダウンタイムなしでアプリ更新 | ECSサービス更新と同等 |
| **設定管理** | ConfigMap、Secretで設定分離 | Parameter Store相当、より統合的 |

### なぜKubernetesなのか？

#### 1. ポータビリティ
```yaml
# 同じマニフェストで動作
---
# ローカル開発環境
apiVersion: v1
kind: Deployment
---
# クラウド本番環境
# 同じ設定ファイルを使用可能
```

#### 2. スケーラビリティ
```bash
# 簡単なスケーリング
kubectl scale deployment my-app --replicas=10

# 自動スケーリング
kubectl autoscale deployment my-app --min=2 --max=10 --cpu-percent=80
```

#### 3. 拡張性
```yaml
# カスタムリソースの定義
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: applications.example.com
```

## 🆚 AWS ECS vs Kubernetes 詳細比較

### アーキテクチャ比較

#### AWS ECS
```
┌──────────────────────────┐
│     ECS Cluster          │
├──────────────────────────┤
│  ┌─────────┐ ┌─────────┐ │
│  │EC2/Farg │ │EC2/Farg │ │
│  │Instance │ │Instance │ │
│  │ ┌─────┐ │ │ ┌─────┐ │ │
│  │ │Task │ │ │ │Task │ │ │
│  │ └─────┘ │ │ └─────┘ │ │
│  └─────────┘ └─────────┘ │
└──────────────────────────┘
```

#### Kubernetes
```
┌──────────────────────────┐
│  Kubernetes Cluster     │
├──────────────────────────┤
│  ┌─────────┐ ┌─────────┐ │
│  │Worker   │ │Worker   │ │
│  │Node     │ │Node     │ │
│  │ ┌─────┐ │ │ ┌─────┐ │ │
│  │ │ Pod │ │ │ │ Pod │ │ │
│  │ └─────┘ │ │ └─────┘ │ │
│  └─────────┘ └─────────┘ │
└──────────────────────────┘
```

### 管理方式の違い

#### AWS ECS: サービス中心
```json
{
  "taskDefinition": "my-app:1",
  "serviceName": "my-service",
  "desiredCount": 3,
  "loadBalancers": [...]
}
```

#### Kubernetes: 宣言的管理
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    spec:
      containers:
      - name: app
        image: my-app:1.0
```

### ネットワーキングの違い

#### AWS ECS
- ALB/NLBによる外部公開
- Service Discoveryによる内部通信
- Security Groupsによる制御

#### Kubernetes
- Serviceによる内部公開
- Ingressによる外部公開
- NetworkPolicyによる制御

```yaml
# Service: 内部通信
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 8080
---
# Ingress: 外部公開
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
spec:
  rules:
  - host: my-app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app-service
            port:
              number: 80
```

## 🌟 Kubernetesの利点

### 1. ベンダーロックイン回避
- 複数のクラウドプロバイダーで動作
- オンプレミス環境でも同じ設定
- 標準化されたAPI

### 2. 豊富なエコシステム
- **パッケージ管理**: Helm
- **設定管理**: Kustomize
- **CI/CD**: ArgoCD、Tekton
- **監視**: Prometheus、Grafana
- **サービスメッシュ**: Istio、Linkerd

### 3. 詳細な制御
```yaml
# リソース制限
resources:
  requests:
    memory: "64Mi"
    cpu: "250m"
  limits:
    memory: "128Mi"
    cpu: "500m"

# セキュリティ設定
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
    - ALL

# ヘルスチェック
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
```

## 🎯 AWS ECS管理者への移行ガイド

### 既存の知識の活用

| あなたの知識 | Kubernetesでの対応 | 学習のポイント |
|-------------|------------------|---------------|
| **Task Definition** | **PodSpec** | YAMLの書き方を学習 |
| **ECS Service** | **Deployment** | 宣言的管理の概念 |
| **ALB設定** | **Ingress** | アノテーションの活用 |
| **CloudFormation** | **Helm/Kustomize** | テンプレート化の手法 |
| **CloudWatch** | **Prometheus** | メトリクス設計の違い |
| **Parameter Store** | **ConfigMap/Secret** | 設定の分離方法 |

### 学習ロードマップ

#### Week 1: 基本概念
1. クラスターアーキテクチャの理解
2. Pod、Service、Deploymentの関係
3. kubectl基本操作

#### Week 2: 実践開始
1. 簡単なアプリケーションのデプロイ
2. 設定管理とSecret管理
3. ヘルスチェックの設定

#### Week 3: 運用面
1. ロードバランシングとIngress
2. 監視とログ設定
3. スケーリング設定

#### Week 4: 応用技術
1. Helmチャート作成
2. CI/CDパイプライン構築
3. セキュリティ強化

## 🔧 実践で重要な概念

### 1. 宣言的管理
```bash
# 望ましい状態を宣言
kubectl apply -f deployment.yaml

# 現在の状態を確認
kubectl get deployment my-app

# 差分を確認
kubectl diff -f deployment.yaml
```

### 2. ラベルとセレクター
```yaml
# ラベルの定義
metadata:
  labels:
    app: my-app
    version: v1.0
    environment: production

# セレクターでの選択
selector:
  matchLabels:
    app: my-app
```

### 3. 名前空間による分離
```bash
# 開発環境
kubectl create namespace development

# 本番環境
kubectl create namespace production

# 環境別デプロイ
kubectl apply -f app.yaml -n development
```

## 🚨 注意すべき違い

### 1. 状態管理
- **ECS**: サービスが望ましい状態を管理
- **Kubernetes**: 複数のコントローラーが協調して管理

### 2. ネットワーキング
- **ECS**: VPCネイティブ、Security Groups
- **Kubernetes**: Overlay Network、NetworkPolicy

### 3. 永続化ストレージ
- **ECS**: EBS/EFSをタスクにアタッチ
- **Kubernetes**: PV/PVCによる抽象化

## 📚 次のステップ

1. **[クラスターアーキテクチャ](./cluster-architecture.md)** - 詳細なコンポーネント理解
2. **[ワークロード](./workloads.md)** - Pod、Deployment、Serviceの詳細
3. **[チュートリアル](../tutorials/)** - 実際の操作体験

## 🎯 学習チェックポイント

- [ ] Kubernetesの基本的な利点を説明できる
- [ ] AWS ECSとの主要な違いを理解している
- [ ] 宣言的管理の概念を理解している
- [ ] 自分の学習計画を立てられる
- [ ] 次に学ぶべき概念が明確になっている

---

**次へ**: [クラスターアーキテクチャ](./cluster-architecture.md) | **実践**: [Hello Kubernetesチュートリアル](../tutorials/hello-kubernetes.md)
