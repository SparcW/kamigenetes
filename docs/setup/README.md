# 🚀 セットアップガイド - Kubernetes環境構築

Kubernetes学習・運用環境の構築手順をステップバイステップで説明します。AWS ECS経験者が効率的にKubernetes環境を整備できるよう、レベル別に構成しています。

## 🎯 環境の種類

### 📚 [学習環境](./learning-environment.md)
個人学習・検証用のローカル環境

- **minikube** - シングルノード学習環境
- **kind** - Docker内Kubernetesクラスター
- **Docker Desktop** - 組み込みKubernetes
- **k3s/k3d** - 軽量Kubernetesディストリビューション

### 🏭 [本番環境](./production-environment.md)  
企業・プロダクション用のマネージドクラスター

- **AWS EKS** - Amazon Elastic Kubernetes Service
- **クラスター設計** - HA構成とネットワーク設計
- **ノード管理** - ワーカーノードの最適化
- **セキュリティ** - 本番レベルのセキュリティ設定

### 🔧 [ツール設定](./tool-configuration.md)
開発・運用ツールチェーンの構築

- **CI/CD統合** - GitHub Actions、GitLab CI
- **監視ツール** - Prometheus、Grafana、AlertManager
- **ログ管理** - ELK Stack、Fluent Bit
- **セキュリティツール** - Falco、OPA Gatekeeper

### 🔒 [セキュリティ設定](./security-configuration.md)
クラスターセキュリティの強化

- **RBAC** - ロールベースアクセス制御
- **Pod Security** - Pod セキュリティスタンダード
- **Network Policy** - ネットワーク分離
- **Secret 管理** - 機密情報の暗号化・管理

## 🏗️ 環境選択ガイド

### 用途別推奨環境

| 用途 | 推奨環境 | 理由 |
|------|----------|------|
| **個人学習** | minikube | 簡単セットアップ、豊富なアドオン |
| **チーム開発** | kind | 設定の共有性、CI/CD統合 |
| **プロトタイプ** | Docker Desktop | IDE統合、Windows/macOS対応 |
| **ステージング** | AWS EKS | 本番環境との一致 |
| **本番運用** | AWS EKS | マネージドサービス、高可用性 |

### リソース要件

#### 学習環境
- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ストレージ**: 20GB以上
- **ネットワーク**: インターネット接続

#### 本番環境
- **ワーカーノード**: 3台以上（HA構成）
- **CPU**: 4コア以上/ノード
- **メモリ**: 8GB以上/ノード
- **ストレージ**: SSD推奨、バックアップ体制
- **ネットワーク**: 冗長化、セキュリティグループ設定

## ⚡ クイックスタート

### 1. 学習環境（5分で開始）

```bash
# Docker Desktop を起動
# Kubernetesを有効化（設定 > Kubernetes > Enable Kubernetes）

# または minikube を使用
minikube start --driver=docker --memory=4096

# 動作確認
kubectl cluster-info
kubectl get nodes
```

### 2. 基本ツールのインストール

```bash
# Windows（管理者権限で実行）
winget install Docker.DockerDesktop
winget install Kubernetes.kubectl
winget install Helm.Helm

# macOS
brew install kubectl helm
brew install --cask docker

# 動作確認
kubectl version --client
helm version
docker --version
```

### 3. VS Code 環境設定

```bash
# 推奨拡張機能のインストール
code --install-extension ms-kubernetes-tools.vscode-kubernetes-tools
code --install-extension ms-azuretools.vscode-docker
code --install-extension redhat.vscode-yaml
```

## 🔄 AWS ECS からの移行パス

### Phase 1: 環境並行運用（1-2週間）
```bash
# 既存ECSクラスター維持
aws ecs describe-clusters --clusters my-cluster

# 並行してKubernetesクラスター構築
minikube start
kubectl create namespace migration-test
```

### Phase 2: ワークロード移行（2-4週間）
```bash
# ECS Task Definition から Kubernetes Deployment への変換
# AWS ECS
aws ecs describe-task-definition --task-definition my-app

# Kubernetes相当
kubectl apply -f my-app-deployment.yaml
kubectl apply -f my-app-service.yaml
```

### Phase 3: 本番切り替え（1-2週間）
```bash
# ロードバランサーの切り替え
# ECS ALB から Kubernetes Ingress へ
kubectl apply -f ingress.yaml

# DNS切り替え
# Route 53 レコードの更新
```

## 📊 環境比較

### AWS ECS vs Kubernetes 環境

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **セットアップ** | マネージド、設定少 | セルフマネージド、設定多 |
| **学習環境** | ローカル実行困難 | minikube等で容易 |
| **コスト** | 従量課金 | インフラ+運用コスト |
| **カスタマイズ** | AWS制約あり | フル制御可能 |
| **エコシステム** | AWS統合 | CNCF豊富なツール |
| **スキル要件** | AWS特化 | 汎用的、転用可能 |

### 機能マッピング

| AWS ECS | Kubernetes | 移行方法 |
|---------|------------|----------|
| **Cluster** | Cluster | EKS クラスター作成 |
| **Service** | Deployment + Service | YAML変換 |
| **Task Definition** | Pod Spec | コンテナ定義変換 |
| **ALB/NLB** | Ingress Controller | AWS Load Balancer Controller |
| **IAM Role** | ServiceAccount + RBAC | IRSA 設定 |
| **CloudWatch** | Prometheus + Grafana | 監視システム移行 |

## 🛠️ 段階的構築手順

### Step 1: 基礎環境（第1週）
1. [学習環境構築](./learning-environment.md)
2. [基本ツール導入](./tool-configuration.md)
3. Hello World デプロイ

### Step 2: 開発環境（第2週）  
1. VS Code 統合
2. Git ワークフロー設定
3. ローカル開発環境最適化

### Step 3: 検証環境（第3-4週）
1. [本番相当環境構築](./production-environment.md)
2. [セキュリティ設定](./security-configuration.md)
3. 監視・ログ基盤導入

### Step 4: 本番環境（第5-8週）
1. AWS EKS クラスター設計
2. 高可用性・災害復旧設計
3. 運用手順の確立

## 📚 関連リソース

### 公式ドキュメント
- [Kubernetes公式セットアップガイド](https://kubernetes.io/docs/setup/)
- [AWS EKS ユーザーガイド](https://docs.aws.amazon.com/eks/latest/userguide/)
- [Docker Desktop Kubernetes](https://docs.docker.com/desktop/kubernetes/)

### コミュニティリソース
- [minikube 公式サイト](https://minikube.sigs.k8s.io/)
- [kind 公式サイト](https://kind.sigs.k8s.io/)
- [CNCF Landscape](https://landscape.cncf.io/)

### 学習補助
- [katacoda Kubernetes Playground](https://www.katacoda.com/courses/kubernetes)
- [Play with Kubernetes](https://labs.play-with-k8s.com/)

---

**推奨学習パス**: 
1. [学習環境構築](./learning-environment.md) → 
2. [ツール設定](./tool-configuration.md) → 
3. [基本チュートリアル](../tutorials/) → 
4. [本番環境構築](./production-environment.md)
