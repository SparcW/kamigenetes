# Kubernetesの基本概念 🎯

## はじめに
AWS ECS管理者の皆さん、Kubernetesへようこそ！このガイドでは、Kubernetesの基本概念をAWS ECSと比較しながら学習します。

## 🏗️ Kubernetesアーキテクチャ

### クラスター構成
```
┌─────────────────────────────────────┐
│           Kubernetesクラスター       │
├─────────────────────────────────────┤
│  マスターノード (Control Plane)      │
│  ├── API Server                     │
│  ├── etcd (データストア)             │
│  ├── Scheduler                      │
│  └── Controller Manager             │
├─────────────────────────────────────┤
│  ワーカーノード                      │
│  ├── kubelet                        │
│  ├── kube-proxy                     │
│  └── Container Runtime (Docker)     │
└─────────────────────────────────────┘
```

### AWS ECSとの比較

| 概念 | AWS ECS | Kubernetes |
|------|---------|------------|
| **クラスター** | ECSクラスター | Kubernetesクラスター |
| **ノード** | EC2インスタンス/Fargate | Worker Node |
| **タスク** | ECSタスク | Pod |
| **サービス** | ECSサービス | Service + Deployment |
| **タスク定義** | TaskDefinition | PodSpec (YAML) |
| **オーケストレーター** | ECS Agent | kubelet |

## 🧩 主要コンポーネント

### 1. Pod（ポッド）
**ECSタスクに相当する最小のデプロイ単位**

```yaml
# basic-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
```

**ECS vs Kubernetes**:
- **ECS**: タスクが直接コンテナを管理
- **K8s**: Podが1つ以上のコンテナを管理（通常は1つ）

### 2. Deployment（デプロイメント）
**ECSサービスに相当するPodの管理機能**

```yaml
# nginx-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3  # ECSサービスのDesired Countに相当
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
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"
          limits:
            memory: "128Mi"
            cpu: "500m"
```

**主な機能**:
- レプリカ数の管理
- ローリングアップデート
- セルフヒーリング（自動復旧）

### 3. Service（サービス）
**ECS Service Discoveryやロードバランサーに相当**

```yaml
# nginx-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80        # サービスのポート
    targetPort: 80  # コンテナのポート
  type: LoadBalancer  # AWS ALB/NLBに相当
```

**サービスタイプ**:
- `ClusterIP`: 内部通信のみ（ECS Service Connect相当）
- `NodePort`: ノードのポート経由でアクセス
- `LoadBalancer`: 外部ロードバランサー（ALB/NLB相当）

## 🎛️ 基本的なkubectlコマンド

### ECSからKubernetesへのコマンド対比

| 操作 | AWS CLI (ECS) | kubectl (K8s) |
|------|---------------|---------------|
| **クラスター一覧** | `aws ecs list-clusters` | `kubectl config get-contexts` |
| **タスク/Pod一覧** | `aws ecs list-tasks` | `kubectl get pods` |
| **サービス一覧** | `aws ecs list-services` | `kubectl get services` |
| **デプロイ** | `aws ecs update-service` | `kubectl apply -f deployment.yaml` |
| **ログ確認** | CloudWatch Logs | `kubectl logs <pod-name>` |
| **実行中タスク詳細** | `aws ecs describe-tasks` | `kubectl describe pod <pod-name>` |

### 基本操作例

```bash
# クラスターの接続確認
kubectl cluster-info

# Podの作成と確認
kubectl apply -f basic-pod.yaml
kubectl get pods
kubectl describe pod nginx-pod

# Deploymentの作成とスケーリング
kubectl apply -f nginx-deployment.yaml
kubectl get deployments
kubectl scale deployment nginx-deployment --replicas=5

# Serviceの作成と確認
kubectl apply -f nginx-service.yaml
kubectl get services

# ログの確認
kubectl logs nginx-pod

# Pod内でのコマンド実行（ECS Exec相当）
kubectl exec -it nginx-pod -- /bin/bash

# リソースの削除
kubectl delete pod nginx-pod
kubectl delete deployment nginx-deployment
kubectl delete service nginx-service
```

## 🏷️ ラベルとセレクター

KubernetesではECSのタグよりも強力なラベル機能があります：

```yaml
# ラベルの例
metadata:
  labels:
    app: frontend
    version: v1.2.0
    environment: production
    team: web-team
```

```bash
# ラベルによる検索（ECSタグフィルターより柔軟）
kubectl get pods -l app=frontend
kubectl get pods -l environment=production,version=v1.2.0
kubectl get pods --show-labels
```

## 🔧 Namespace（名前空間）

ECSのクラスターよりも細かい論理分割が可能：

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: development
---
apiVersion: v1
kind: Namespace
metadata:
  name: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
```

```bash
# 名前空間の操作
kubectl create namespace development
kubectl get namespaces
kubectl apply -f deployment.yaml -n development
kubectl get pods -n development
```

## 📦 Kubernetesオブジェクトの理解

### Kubernetesオブジェクトとは

**Kubernetesオブジェクト**は、Kubernetes上で永続的なエンティティです。Kubernetesはこれらのエンティティを使い、クラスターの状態を表現します。

**AWS ECS比較**: ECSのタスク定義やサービス定義に相当する設定情報

### オブジェクトが表現する内容

- どのようなコンテナ化されたアプリケーションが稼働しているか
- それらのアプリケーションから利用可能なリソース
- アプリケーションがどのように振る舞うかのポリシー（再起動、アップグレード、耐障害性など）

### オブジェクトのSpec（仕様）とStatus（状態）

```yaml
# Deploymentオブジェクトの例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:                    # 望ましい状態（仕様）
  replicas: 3
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
        image: nginx:1.21
        ports:
        - containerPort: 80
status:                  # 現在の状態（Kubernetesが自動管理）
  readyReplicas: 3
  availableReplicas: 3
  conditions:
  - type: Available
    status: "True"
```

**AWS ECS比較**:
- **spec**: ECSタスク定義のDesired Countや設定に相当
- **status**: ECS Serviceの現在の実行状態に相当

### 必須フィールド

すべてのKubernetesオブジェクトには以下の必須フィールドがあります：

```yaml
apiVersion: apps/v1      # 使用するKubernetes APIのバージョン
kind: Deployment         # オブジェクトの種類
metadata:                # オブジェクトを特定するメタデータ
  name: my-app
  namespace: production
  labels:
    app: my-app
    version: v1.0.0
spec:                    # オブジェクトの望ましい状態
  # オブジェクト固有の設定...
```

**フィールド説明**:

| フィールド | 説明 | AWS ECS比較 |
|-----------|------|------------|
| **apiVersion** | 使用するKubernetes APIのバージョン | CloudFormationのAWSTemplateFormatVersion |
| **kind** | 作成するオブジェクトの種類 | リソースタイプ（AWS::ECS::TaskDefinition等） |
| **metadata** | オブジェクト識別情報（名前、ラベル等） | タスク定義名、タグ |
| **spec** | オブジェクトの望ましい状態 | タスク定義の設定内容 |

### よく使用されるオブジェクト種類

#### 1. ワークロード関連
```yaml
# Pod - 最小のデプロイ単位
kind: Pod

# Deployment - レプリカセットの管理
kind: Deployment

# StatefulSet - ステートフルなアプリケーション
kind: StatefulSet

# DaemonSet - 各ノードで1つずつ実行
kind: DaemonSet

# Job - 一度だけ実行されるタスク
kind: Job

# CronJob - 定期実行タスク
kind: CronJob
```

#### 2. ネットワーク関連
```yaml
# Service - Podへのアクセス提供
kind: Service

# Ingress - HTTP/HTTPSアクセス制御
kind: Ingress

# NetworkPolicy - ネットワークポリシー
kind: NetworkPolicy
```

#### 3. ストレージ関連
```yaml
# PersistentVolume - 永続ボリューム
kind: PersistentVolume

# PersistentVolumeClaim - ボリューム要求
kind: PersistentVolumeClaim

# StorageClass - ストレージクラス
kind: StorageClass
```

#### 4. 設定・機密情報
```yaml
# ConfigMap - 設定データ
kind: ConfigMap

# Secret - 機密データ
kind: Secret
```

### オブジェクトの状態管理

Kubernetesのコントロールプレーンは、以下のプロセスで状態管理を行います：

```
1. ユーザーがオブジェクトを作成/更新
   ↓
2. Kubernetes APIがオブジェクトを保存
   ↓
3. コントローラーが現在の状態をチェック
   ↓
4. spec（望ましい状態）と現在の状態を比較
   ↓
5. 差分があれば現在の状態をspecに合わせる
   ↓
6. statusフィールドを更新
```

**AWS ECS比較**: ECS Serviceが自動的にタスクの数を調整するのと同様

### オブジェクトの操作例

```bash
# オブジェクトの作成
kubectl apply -f deployment.yaml

# オブジェクトの確認
kubectl get deployments
kubectl describe deployment nginx-deployment

# オブジェクトの更新
kubectl edit deployment nginx-deployment

# オブジェクトの削除
kubectl delete deployment nginx-deployment

# オブジェクトの詳細（YAML形式）
kubectl get deployment nginx-deployment -o yaml

# 特定フィールドの取得
kubectl get deployment nginx-deployment -o jsonpath='{.spec.replicas}'
```

### オブジェクトのライフサイクル

```
作成 → 実行中 → 更新 → 削除
 ↓      ↓       ↓      ↓
spec   status   spec   削除処理
設定   監視     変更   クリーンアップ
```

**AWS ECS比較**:
- **作成**: ECSタスク定義の作成、サービスの作成
- **実行中**: ECSサービスによるタスク管理
- **更新**: タスク定義の新リビジョン作成
- **削除**: サービス停止、タスク定義削除

### メタデータの活用

```yaml
metadata:
  name: web-app
  namespace: production
  labels:
    app: web-app
    tier: frontend
    environment: prod
    version: v2.1.0
  annotations:
    deployment.kubernetes.io/revision: "3"
    description: "本番環境のWebアプリケーション"
```

**ラベルとアノテーションの違い**:
- **ラベル**: セレクターで検索可能、オブジェクト分類用
- **アノテーション**: 追加情報の記録、ツール連携用

## 🎯 実践演習

### 演習1: 基本的なWebアプリケーションのデプロイ

1. **Nginx Podの作成**
```bash
kubectl run nginx --image=nginx:1.21 --port=80
kubectl get pods
```

2. **Serviceによる公開**
```bash
kubectl expose pod nginx --type=LoadBalancer --port=80
kubectl get services
```

3. **アクセス確認**
```bash
# LoadBalancerのEXTERNAL-IPを確認
kubectl get services nginx

# アクセステスト（EXTERNAL-IPが割り当てられた後）
curl http://<EXTERNAL-IP>
```

### 演習2: ECSタスク定義からの変換

**ECSタスク定義例**:
```json
{
  "family": "sample-app",
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "nginx:1.21",
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

**Kubernetes YAML変換**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
      - name: web
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "250m"     # 0.25 CPU cores
            memory: "512Mi" # 512 MiB
          limits:
            cpu: "250m"
            memory: "512Mi"
```

## 📝 まとめ

このセクションでは以下を学習しました：

✅ **Kubernetesの基本アーキテクチャ**  
✅ **Pod、Deployment、Serviceの概念**  
✅ **ECSとKubernetesの対比**  
✅ **基本的なkubectlコマンド**  
✅ **ラベルとNamespaceの活用**  
✅ **Kubernetesオブジェクトの理解**
   - spec（仕様）とstatus（状態）の概念
   - 必須フィールド（apiVersion、kind、metadata、spec）
   - オブジェクトの状態管理とライフサイクル
   - メタデータとラベル・アノテーションの活用  

## 🚀 次のステップ

基本概念を理解できたら、次は：
1. [AWS ECSとKubernetesの詳細比較](./02-ecs-vs-kubernetes.md)
2. [開発環境の構築](./03-development-setup.md)

## 🤔 よくある質問

**Q: ECSの1タスク = K8sの1Pod？**  
A: 基本的にはそうですが、Podは複数のコンテナを含むこともできます。

**Q: ECSサービスの代わりは？**  
A: DeploymentとServiceの組み合わせが相当します。

**Q: ECS Exec相当の機能は？**  
A: `kubectl exec`コマンドでPod内でコマンド実行できます。

**Q: specとstatusの違いは？**  
A: specは「望ましい状態」、statusは「現在の状態」です。Kubernetesが自動的にspecに合わせてstatusを調整します。

**Q: オブジェクトの種類はどうやって調べる？**  
A: `kubectl api-resources`コマンドで利用可能なオブジェクト種類を確認できます。

**Q: メタデータのラベルは何に使う？**  
A: オブジェクトの分類・検索・セレクターでの選択に使用します。AWS ECSのタグに似た機能です。

---
**次へ**: [AWS ECSとKubernetesの比較](./02-ecs-vs-kubernetes.md)
