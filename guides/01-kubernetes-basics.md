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

---
**次へ**: [AWS ECSとKubernetesの比較](./02-ecs-vs-kubernetes.md)
