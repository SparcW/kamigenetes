# 🏗️ クラスターアーキテクチャ

## 概要

Kubernetesクラスターは、コンテナ化されたアプリケーションを実行するための分散システムです。AWS ECS管理者の視点から、Kubernetesクラスターの構造と各コンポーネントの役割を理解していきます。

## 🎯 学習目標

- Kubernetesクラスターの全体構造を理解する
- コントロールプレーンとワーカーノードの役割を把握する
- AWS ECSクラスターとの違いを理解する
- 各コンポーネントの責任範囲を把握する

## 🏛️ クラスター全体像

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
├─────────────────────────────────────────────────────────────┤
│                  Control Plane (Master)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│  │ API Server  │ │    etcd     │ │ Scheduler   │ │Controller│  │
│  │             │ │             │ │             │ │ Manager │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Worker Nodes                             │
│  ┌───────────────────────┐  ┌───────────────────────┐        │
│  │      Node 1           │  │      Node 2           │        │
│  │  ┌─────────────────┐  │  │  ┌─────────────────┐  │   ...  │
│  │  │     kubelet     │  │  │  │     kubelet     │  │        │
│  │  │   kube-proxy    │  │  │  │   kube-proxy    │  │        │
│  │  │ Container Runtime│  │  │  │ Container Runtime│  │        │
│  │  └─────────────────┘  │  │  └─────────────────┘  │        │
│  │  ┌─────┐ ┌─────┐ ┌──┐ │  │  ┌─────┐ ┌─────┐ ┌──┐ │        │
│  │  │Pod 1│ │Pod 2│ │..│ │  │  │Pod 3│ │Pod 4│ │..│ │        │
│  │  └─────┘ └─────┘ └──┘ │  │  └─────┘ └─────┘ └──┘ │        │
│  └───────────────────────┘  └───────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 🎛️ コントロールプレーン (Control Plane)

コントロールプレーンは、クラスター全体の管理と制御を担当します。

### 🌐 API Server (kube-apiserver)

**役割**: Kubernetesクラスターの中央制御点

- **機能**:
  - RESTful APIを提供
  - 認証・認可の実行
  - etcdとの通信仲介
  - webhook の実行

- **AWS ECSとの比較**:
  - ECS APIに相当
  - ただし、ECSより豊富な機能を提供

**実用例**:
```bash
# API Serverとの通信例
kubectl get nodes
kubectl apply -f deployment.yaml
kubectl logs pod-name
```

### 💾 etcd

**役割**: 分散キーバリューストア（クラスターの状態保存）

- **機能**:
  - クラスター設定データの保存
  - 全リソースの現在状態を保持
  - 分散合意アルゴリズム（Raft）による一貫性保証

- **AWS ECSとの比較**:
  - ECSでは AWS 内部のデータストアが同様の役割
  - etcdは直接操作可能（上級者向け）

**重要な概念**:
```bash
# etcdから直接データを確認（デバッグ用）
etcdctl get /registry/pods/default/my-pod
```

### 📅 Scheduler (kube-scheduler)

**役割**: Podを適切なノードに配置する

- **機能**:
  - ノードのリソース状況を評価
  - アフィニティ・アンチアフィニティルールの適用
  - リソース要求に基づく最適配置

- **AWS ECSとの比較**:
  - ECS Schedulerに相当
  - より細かい制御が可能

**スケジューリング要因**:
```yaml
# Podスケジューリングの例
apiVersion: v1
kind: Pod
spec:
  nodeSelector:
    environment: production
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: zone
            operator: In
            values: ["us-west-1a", "us-west-1b"]
```

### 🎮 Controller Manager (kube-controller-manager)

**役割**: 様々なコントローラーの実行

- **主要コントローラー**:
  - **ReplicaSet Controller**: Pod数の管理
  - **Deployment Controller**: ローリングアップデート
  - **Service Controller**: Service の endpoint 管理
  - **Node Controller**: ノードのヘルスチェック

- **AWS ECSとの比較**:
  - ECSサービスの自動管理機能に相当
  - より多くの種類のリソースを管理

## 🖥️ ワーカーノード (Worker Nodes)

ワーカーノードは、実際にコンテナを実行するマシンです。

### 🤖 kubelet

**役割**: ノード上のPod管理エージェント

- **機能**:
  - API Serverからの指示を受信
  - Podのライフサイクル管理
  - ヘルスチェックの実行
  - ノード状態の報告

- **AWS ECSとの比較**:
  - ECS Agentに相当
  - より直接的なコンテナ制御

**kubeletの役割**:
```bash
# kubeletのログ確認
journalctl -u kubelet -f

# ノードの状態確認
kubectl describe node worker-node-1
```

### 🌐 kube-proxy

**役割**: ネットワークプロキシとロードバランサー

- **機能**:
  - Serviceの実装
  - トラフィックの負荷分散
  - iptables/IPVS ルールの管理

- **AWS ECSとの比較**:
  - AWS Load Balancerの一部機能をノードレベルで実装
  - より細かいネットワーク制御

**kube-proxyの動作**:
```bash
# Service のエンドポイント確認
kubectl get endpoints my-service

# kube-proxy の設定確認
kubectl get configmap kube-proxy-config -n kube-system -o yaml
```

### 🐳 Container Runtime

**役割**: 実際のコンテナ実行

- **対応ランタイム**:
  - **containerd**: 最も一般的
  - **CRI-O**: RedHat系
  - **Docker**: 従来の選択肢

- **AWS ECSとの比較**:
  - ECSでもDockerまたはcontainerdを使用
  - CRI (Container Runtime Interface) でランタイムを抽象化

## 🆚 AWS ECS vs Kubernetes アーキテクチャ比較

| コンポーネント | AWS ECS | Kubernetes |
|----------------|---------|------------|
| **制御層** | ECS Control Plane (AWS管理) | Control Plane (自己管理またはマネージド) |
| **API** | ECS API | Kubernetes API Server |
| **状態管理** | AWS内部データストア | etcd |
| **スケジューラー** | ECS Scheduler | kube-scheduler |
| **ノード管理** | EC2 Auto Scaling Group | Node Controller |
| **エージェント** | ECS Agent | kubelet |
| **ネットワーク** | ALB/NLB + Security Groups | kube-proxy + Service |
| **コンテナ実行** | Docker/containerd | CRI対応ランタイム |

## 🔧 AWS EKS でのアーキテクチャ

AWS EKS使用時の特徴：

### マネージドコントロールプレーン
```
┌─────────────────────────────────────────┐
│            AWS EKS                      │
│  ┌─────────────────────────────────────┐│
│  │     Managed Control Plane          ││
│  │  (AWS が管理・運用)                  ││
│  │                                     ││
│  │  ✅ 高可用性保証                     ││
│  │  ✅ 自動アップデート                 ││
│  │  ✅ 暗号化                          ││
│  │  ✅ 監査ログ                        ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│           Customer VPC                   │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Worker Node │  │ Worker Node │  ...  │
│  │  (EC2/Fargate) │  │ (EC2/Fargate) │       │
│  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────┘
```

### EKS Fargateの場合
```
┌─────────────────────────────────────────┐
│            AWS EKS                      │
│  ┌─────────────────────────────────────┐│
│  │     Managed Control Plane          ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│              Fargate                     │
│  ┌─────────────────────────────────────┐│
│  │  Serverless Worker Nodes           ││
│  │  (ノード管理不要)                    ││
│  │                                     ││
│  │  ✅ Pod単位での課金                  ││
│  │  ✅ 自動スケーリング                 ││
│  │  ✅ セキュリティ分離                 ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## 🔍 実践的な確認コマンド

### クラスター全体の確認
```bash
# クラスター情報の確認
kubectl cluster-info

# ノード一覧の確認
kubectl get nodes -o wide

# システムPodの確認
kubectl get pods -n kube-system

# クラスターバージョン確認
kubectl version
```

### コンポーネントの健全性確認
```bash
# コンポーネント状態確認
kubectl get componentstatuses

# API Server の確認
kubectl get --raw=/healthz

# etcd の確認
kubectl get events --sort-by=.metadata.creationTimestamp

# Controller Manager の確認
kubectl get pods -n kube-system -l component=kube-controller-manager
```

### ノード詳細の確認
```bash
# 特定ノードの詳細情報
kubectl describe node <node-name>

# ノードのリソース使用量
kubectl top nodes

# ノードのPod一覧
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=<node-name>
```

## 🛡️ セキュリティとベストプラクティス

### コントロールプレーンセキュリティ
- **API Server**:
  - TLS暗号化の必須化
  - RBAC による認可制御
  - Admission Controllers の活用

- **etcd**:
  - データ暗号化 (encryption at rest)
  - ネットワーク分離
  - 定期的なバックアップ

### ノードセキュリティ
- **OS レベル**:
  - 最小権限の原則
  - 定期的なセキュリティパッチ適用
  - ログ監視

- **Container Runtime**:
  - 非root実行の推奨
  - セキュリティスキャン
  - リソース制限の設定

## 🔄 高可用性とディザスタリカバリ

### マルチマスター構成
```bash
# 複数のコントロールプレーンノード
kubectl get nodes -l node-role.kubernetes.io/control-plane

# etcd クラスターの確認
kubectl get pods -n kube-system -l component=etcd
```

### バックアップ戦略
```bash
# etcd バックアップ
etcdctl snapshot save backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# バックアップの確認
etcdctl snapshot status backup.db
```

## 📊 監視とトラブルシューティング

### よくある問題と対策

#### API Server に接続できない
```bash
# 接続テスト
kubectl version --short

# 設定確認
kubectl config view

# 証明書確認
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout
```

#### Pod がスケジュールされない
```bash
# スケジューラーの状態確認
kubectl get events --sort-by=.metadata.creationTimestamp

# ノードの状態確認
kubectl describe nodes

# リソース使用量確認
kubectl top nodes
kubectl top pods --all-namespaces
```

#### ネットワーク通信の問題
```bash
# kube-proxy の状態確認
kubectl get pods -n kube-system -l k8s-app=kube-proxy

# Service の確認
kubectl get services --all-namespaces
kubectl get endpoints --all-namespaces

# DNS 確認
nslookup kubernetes.default.svc.cluster.local
```

## 🔗 次のステップ

アーキテクチャの理解ができたら、以下のトピックに進んでください：

1. **[ワークロード](./workloads.md)** - Pod、Deployment、Serviceの詳細
2. **[ネットワーキング](./networking.md)** - クラスター内外の通信
3. **[セキュリティ](./security.md)** - RBAC とセキュリティポリシー
4. **[ハンズオンラボ](../../hands-on-labs/)** - 実際のクラスター操作

## 📚 関連リソース

- [Kubernetes Components](https://kubernetes.io/docs/concepts/overview/components/)
- [AWS EKS Architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html)
- [etcd Documentation](https://etcd.io/docs/)
- [Container Runtime Interface (CRI)](https://kubernetes.io/docs/concepts/architecture/cri/)

---

**AWS ECS経験者へのポイント**: ECSではAWSが全てのインフラを管理していましたが、Kubernetesでは（EKSを使用しても）より多くの設定とカスタマイズが可能です。この柔軟性こそがKubernetesの最大の特徴です。
