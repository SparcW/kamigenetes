# 開発環境のセットアップ

このガイドでは、サンプルアプリケーションのラボ環境をセットアップします。

## 1. アプリケーションソースコードの準備

### サンプルアプリケーションの概要

このラボで使用するアプリケーションは、以下の3層アーキテクチャです：

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Node.js)     │───▶│   (Node.js API) │───▶│   (PostgreSQL)  │
│   Port: 3000    │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │     Cache       │
                       │    (Redis)      │
                       │   Port: 6379    │
                       └─────────────────┘
```

### ソースコードの確認

```bash
# アプリケーションディレクトリの確認
ls -la hands-on/sample-app/app/

# ファイル構成
# ├── Dockerfile          # コンテナイメージ定義
# ├── package.json        # Node.js依存関係
# ├── server.js          # アプリケーションコード
# └── public/
#     └── index.html     # フロントエンド
```

## 2. Dockerイメージのビルド

### ローカル環境での場合

```bash
# アプリケーションディレクトリに移動
cd hands-on-labs/sample-app/app

# Dockerイメージのビルド
docker build -t k8s-sample-app:latest .

# ビルド結果の確認
docker images | grep k8s-sample-app
```

**AWS ECS管理者向けメモ**:
- ECSではECRへのプッシュが必要でしたが、ローカル開発では不要です
- Kubernetesは複数のレジストリからプル可能です

### Minikube使用時の特別な設定

Minikubeを使用する場合、ローカルのDockerイメージを使用するための設定が必要です：

```bash
# Minikubeのdockerデーモンを使用
eval $(minikube docker-env)

# イメージを再ビルド
docker build -t k8s-sample-app:latest .

# Minikube内でのイメージ確認
docker images | grep k8s-sample-app
```

### イメージのテスト実行

```bash
# コンテナの起動テスト
docker run -d -p 3000:3000 --name test-app k8s-sample-app:latest

# アプリケーションの動作確認
curl http://localhost:3000

# テストコンテナの停止・削除
docker stop test-app
docker rm test-app
```

## 3. Kubernetesマニフェストファイルの確認

### ディレクトリ構造

```bash
# マニフェストファイルの確認
ls -la hands-on-labs/sample-app/kubernetes/

# 期待される構造:
# ├── namespace.yaml      # ネームスペース定義
# ├── configmap.yaml      # アプリケーション設定
# ├── secrets.yaml        # 機密情報
# ├── postgres/
# │   ├── postgres-deployment.yaml
# │   ├── postgres-pvc.yaml
# │   └── postgres-service.yaml
# ├── redis/
# │   ├── redis-deployment.yaml
# │   └── redis-service.yaml
# └── web/
#     ├── web-deployment.yaml
#     └── web-service.yaml
```

### マニフェストファイルの検証

```bash
# YAML構文の検証
kubectl apply --dry-run=client -f hands-on-labs/sample-app/kubernetes/namespace.yaml

# すべてのマニフェストの構文チェック
kubectl apply --dry-run=client -f hands-on-labs/sample-app/kubernetes/
```

## 4. ネットワーク設定

### ポート使用状況の確認

```bash
# 必要なポートが利用可能か確認
netstat -tulnp | grep -E ':(3000|5432|6379|8080)'

# またはss コマンド（Linux）
ss -tulnp | grep -E ':(3000|5432|6379|8080)'
```

### Minikube用ポートフォワード設定

```bash
# Minikubeのネットワーク設定確認
minikube ip

# NodePortサービス用のポート範囲確認
kubectl get services --all-namespaces
```

## 5. 監視ツールの準備（オプション）

### Kubernetes Dashboard

```bash
# ダッシュボードの有効化（Minikube）
minikube addons enable dashboard

# ダッシュボードの起動
minikube dashboard
```

### メトリクスサーバー

```bash
# メトリクスサーバーの有効化（Minikube）
minikube addons enable metrics-server

# メトリクス取得の確認
kubectl top nodes
```

## 6. 開発用ユーティリティ

### kubectlエイリアスの設定

```bash
# ~/.bashrcまたは~/.zshrcに追加
echo 'alias k=kubectl' >> ~/.bashrc
echo 'alias kgp="kubectl get pods"' >> ~/.bashrc
echo 'alias kgs="kubectl get services"' >> ~/.bashrc

# 設定の再読み込み
source ~/.bashrc
```

### kubectl自動補完

```bash
# Bashの場合
echo 'source <(kubectl completion bash)' >> ~/.bashrc

# Zshの場合
echo 'source <(kubectl completion zsh)' >> ~/.zshrc
```

## 7. 環境変数の設定

```bash
# ラボ用の環境変数設定
export NAMESPACE=sample-app
export IMAGE_TAG=latest
export APP_NAME=k8s-sample-app

# 設定の確認
echo $NAMESPACE
echo $IMAGE_TAG
echo $APP_NAME
```

## 8. 最終確認

以下のコマンドがすべて正常に実行できることを確認してください：

```bash
# 1. クラスター接続確認
kubectl cluster-info

# 2. イメージ存在確認
docker images | grep k8s-sample-app

# 3. マニフェスト構文確認
kubectl apply --dry-run=client -f hands-on/sample-app/kubernetes/namespace.yaml

# 4. リソース作成権限確認
kubectl auth can-i create deployments

# 5. ネームスペース作成テスト
kubectl create namespace test-setup
kubectl delete namespace test-setup
```

## AWS ECSとKubernetesの開発環境比較

| 項目 | AWS ECS | Kubernetes |
|------|---------|------------|
| **ローカル開発** | ecs-cli local | minikube/kind |
| **イメージ管理** | ECR必須 | ローカル可能 |
| **設定管理** | タスク定義JSON | YAMLマニフェスト |
| **デプロイ** | AWS CLI/コンソール | kubectl |
| **監視** | CloudWatch | kubectl/Dashboard |
| **ログ** | CloudWatch Logs | kubectl logs |

## トラブルシューティング

### イメージプルエラー

```bash
# ImagePullBackOff エラーの場合
kubectl describe pod <pod-name>

# Minikubeでローカルイメージを使用
eval $(minikube docker-env)
docker build -t k8s-sample-app:latest .
```

### 権限エラー

```bash
# RBAC権限の確認
kubectl auth can-i "*" "*" --as=system:serviceaccount:default:default

# クラスター管理者権限の確認
kubectl auth can-i "*" "*"
```

### ネットワークエラー

```bash
# DNS解決確認
kubectl run test-dns --image=busybox --rm -it -- nslookup kubernetes.default

# サービス接続確認
kubectl run test-curl --image=curlimages/curl --rm -it -- curl http://kubernetes.default
```

環境のセットアップが完了したら、[Lab 1: ネームスペースとリソース管理](../lab-01-namespace/README.md)に進んでください。
