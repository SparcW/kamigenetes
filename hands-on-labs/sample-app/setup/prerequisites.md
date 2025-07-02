# 前提条件の確認

このラボを開始する前に、以下の前提条件が満たされていることを確認してください。

## 1. Kubernetesクラスター

### オプション A: Minikube（推奨・初学者向け）

```bash
# Minikubeのインストール確認
minikube version

# クラスターの起動
minikube start

# 状態確認
minikube status
```

**AWS ECS管理者向けメモ**: 
- Minikubeは開発用のローカルKubernetesクラスターです
- ECSでいうところの「ローカル開発環境」に相当します
- 本番環境ではAWS EKSを使用します

### オプション B: AWS EKS

```bash
# AWS CLIの設定確認
aws sts get-caller-identity

# eksctlの確認
eksctl version

# クラスター作成（オプション）
eksctl create cluster --name k8s-learning --region ap-northeast-1
```

### オプション C: 他のクラスター

任意のKubernetesクラスター（GKE、AKS、オンプレミスなど）も使用可能です。

## 2. kubectl コマンドラインツール

```bash
# kubectlのインストール確認
kubectl version --client

# クラスターへの接続確認
kubectl cluster-info

# ノードの確認
kubectl get nodes
```

**期待される出力例**:
```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1h    v1.28.3
```

## 3. Docker

```bash
# Dockerのインストール確認
docker --version

# Dockerデーモンの動作確認
docker ps
```

**AWS ECS管理者向けメモ**: 
- KubernetesでもECSと同様にDockerコンテナを使用します
- ただし、ContainerDなどの他のコンテナランタイムも使用可能です

## 4. 追加ツール（オプション）

### Helm（パッケージマネージャー）

```bash
# Helmのインストール確認
helm version
```

### k9s（Kubernetesダッシュボード）

```bash
# k9sの確認（オプション）
k9s version
```

## 5. 権限確認

```bash
# 現在のコンテキスト確認
kubectl config current-context

# 権限確認
kubectl auth can-i "*" "*"

# ネームスペース作成権限確認
kubectl auth can-i create namespaces
```

## 6. ワークスペース準備

```bash
# プロジェクトディレクトリに移動
cd /path/to/k8s-workspace

# ディレクトリ構造確認
ls -la hands-on-labs/sample-app/
```

## 7. ネットワーク要件

- インターネット接続（コンテナイメージのプル用）
- ローカルポート 8080-8090が利用可能
- Docker Hubへのアクセス

## トラブルシューティング

### kubectl接続エラー

```bash
# 設定ファイルの確認
kubectl config view

# コンテキストの切り替え
kubectl config use-context <context-name>
```

### Minikube起動エラー

```bash
# 詳細ログで起動
minikube start --v=7

# リソース不足の場合
minikube start --memory=4096 --cpus=2
```

### Docker権限エラー

```bash
# Dockerグループに追加（Linux）
sudo usermod -aG docker $USER
# ログアウト・ログインが必要
```

## 動作確認チェックリスト

以下のコマンドがすべて正常に実行できることを確認してください：

- [ ] `kubectl get nodes` - ノード一覧が表示される
- [ ] `kubectl get namespaces` - ネームスペース一覧が表示される
- [ ] `docker ps` - 実行中のコンテナ一覧が表示される
- [ ] `kubectl create namespace test-ns` - テストネームスペースが作成できる
- [ ] `kubectl delete namespace test-ns` - テストネームスペースが削除できる

## AWS ECS経験者向けの比較

| 確認項目 | AWS ECS | Kubernetes |
|----------|---------|------------|
| **クラスター確認** | `aws ecs list-clusters` | `kubectl get nodes` |
| **サービス確認** | `aws ecs list-services` | `kubectl get services` |
| **タスク確認** | `aws ecs list-tasks` | `kubectl get pods` |
| **権限確認** | IAMロール/ポリシー | RBAC/ServiceAccount |
| **ネットワーク** | VPC/セキュリティグループ | Service/NetworkPolicy |

前提条件がすべて満たされたら、[環境セットアップ](environment-setup.md)に進んでください。
