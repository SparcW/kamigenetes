# 📚 学習環境構築ガイド - ローカルKubernetes環境

個人学習・検証用のローカルKubernetes環境の構築手順を説明します。AWS ECS経験者が効率的にKubernetesを学習できるよう、複数の選択肢とその特徴を紹介します。

## 🎯 学習環境の選択肢

### 🚀 推奨順序

1. **Docker Desktop** - 最も簡単、IDE統合良好
2. **minikube** - 豊富なアドオン、実戦的
3. **kind** - 軽量、CI/CD統合向け
4. **k3s/k3d** - 最軽量、リソース節約

## 🐳 Option 1: Docker Desktop Kubernetes

### 特徴
- **簡単**: チェックボックス1つで有効化
- **統合**: VS Code、Docker CLIとの連携
- **制限**: シングルノード、アドオン少

### インストール手順

#### Windows
```powershell
# Docker Desktop のインストール
winget install Docker.DockerDesktop

# Docker Desktop 起動後
# Settings > Kubernetes > Enable Kubernetes をチェック
# Apply & Restart
```

#### macOS
```bash
# Homebrew でインストール
brew install --cask docker

# または公式サイトからダウンロード
# https://www.docker.com/products/docker-desktop
```

### 設定確認
```bash
# kubectl設定の確認
kubectl config current-context
# 結果: docker-desktop

# クラスター情報
kubectl cluster-info
kubectl get nodes

# テストPod実行
kubectl run test --image=nginx:1.21 --rm -it --restart=Never -- echo "Docker Desktop K8s works!"
```

## ⚡ Option 2: minikube

### 特徴
- **多機能**: 豊富なアドオン（Dashboard、Metrics、Ingress）
- **リアル**: マルチノード対応、本番相当の機能
- **学習**: Kubernetesの全機能を体験可能

### インストール手順

#### Windows
```powershell
# minikube のインストール
winget install Kubernetes.minikube

# Docker Desktopが起動していることを確認
docker --version

# minikube 起動
minikube start --driver=docker --memory=4096 --cpus=2

# Dashboard 有効化
minikube addons enable dashboard
minikube addons enable metrics-server
minikube addons enable ingress
```

#### macOS/Linux
```bash
# macOS
brew install minikube

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 起動
minikube start --driver=docker --memory=4096 --cpus=2
```

### 基本操作
```bash
# クラスター状態確認
minikube status

# ダッシュボード起動
minikube dashboard

# IPアドレス確認
minikube ip

# SSH接続
minikube ssh

# アドオン管理
minikube addons list
minikube addons enable <addon-name>

# クラスター停止・削除
minikube stop
minikube delete
```

### 便利なアドオン
```bash
# 必須アドオン
minikube addons enable metrics-server    # リソース監視
minikube addons enable dashboard         # Web UI
minikube addons enable ingress          # 外部アクセス

# 学習用アドオン
minikube addons enable registry         # ローカルレジストリ
minikube addons enable storage-provisioner  # 動的ストレージ
minikube addons enable default-storageclass  # デフォルトストレージ

# 上級者向け
minikube addons enable istio            # サービスメッシュ
minikube addons enable helm-tiller      # Helm v2サポート
```

## 📦 Option 3: kind (Kubernetes in Docker)

### 特徴
- **軽量**: 最小リソースで複数クラスター
- **CI/CD**: テスト環境に最適
- **設定**: YAML設定ファイルで詳細制御

### インストール手順

#### Windows
```powershell
# kind のインストール
winget install Kubernetes.kind

# または Chocolatey
choco install kind
```

#### macOS/Linux
```bash
# macOS
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

### 基本的なクラスター作成
```bash
# シンプルなクラスター作成
kind create cluster --name learning

# 設定確認
kubectl cluster-info --context kind-learning
kubectl get nodes

# クラスター削除
kind delete cluster --name learning
```

### マルチノードクラスター設定
```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
- role: worker
```

```bash
# マルチノードクラスター作成
kind create cluster --config kind-config.yaml --name multi-node

# ノード確認
kubectl get nodes
```

## 🌟 Option 4: k3s/k3d

### 特徴
- **超軽量**: 最小限のリソース使用
- **高速**: 起動時間が短い
- **完全**: 完全なKubernetes実装

### k3d インストール・使用
```bash
# k3d インストール
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# クラスター作成
k3d cluster create learning --port "8080:80@loadbalancer" --port "8443:443@loadbalancer"

# 確認
kubectl get nodes
kubectl cluster-info

# クラスター削除
k3d cluster delete learning
```

## 🔧 学習環境の設定最適化

### kubectl 設定
```bash
# 自動補完設定
echo 'source <(kubectl completion bash)' >> ~/.bashrc  # Linux
echo 'source <(kubectl completion zsh)' >> ~/.zshrc    # macOS

# エイリアス設定
echo 'alias k=kubectl' >> ~/.bashrc
echo 'alias kgp="kubectl get pods"' >> ~/.bashrc
echo 'alias kgs="kubectl get services"' >> ~/.bashrc

# 設定の再読み込み
source ~/.bashrc
```

### VS Code 統合設定
```json
// .vscode/settings.json
{
  "kubernetes-explorer.kubeconfig": null,
  "vs-kubernetes": {
    "vs-kubernetes.crd-code-completion": "enabled",
    "vs-kubernetes.kubectl-path": "kubectl",
    "vs-kubernetes.helm-path": "helm"
  },
  "yaml.schemas": {
    "https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.22.0/all.json": "*.k8s.yaml"
  }
}
```

### 学習用名前空間作成
```bash
# 学習用ネームスペース
kubectl create namespace learning
kubectl create namespace development  
kubectl create namespace testing

# デフォルトネームスペース設定
kubectl config set-context --current --namespace=learning

# 確認
kubectl config view --minify --output 'jsonpath={..namespace}'
```

## 📊 環境比較表

| 特徴 | Docker Desktop | minikube | kind | k3s/k3d |
|------|---------------|----------|------|---------|
| **セットアップ** | ⭐⭐⭐ 最簡単 | ⭐⭐ 簡単 | ⭐⭐ 簡単 | ⭐⭐ 簡単 |
| **リソース使用** | ⭐⭐ 中程度 | ⭐ 多い | ⭐⭐⭐ 少ない | ⭐⭐⭐ 最少 |
| **機能の豊富さ** | ⭐ 基本のみ | ⭐⭐⭐ 最多 | ⭐⭐ 標準 | ⭐⭐ 標準 |
| **マルチノード** | ❌ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **起動速度** | ⭐⭐ 普通 | ⭐ 遅い | ⭐⭐⭐ 速い | ⭐⭐⭐ 最速 |
| **学習向け** | ⭐⭐ 入門向け | ⭐⭐⭐ 最適 | ⭐⭐ CI向け | ⭐⭐ 軽量重視 |

## 🎯 学習レベル別推奨

### 初心者（Kubernetes初回）
**推奨**: Docker Desktop
```bash
# 最も簡単な開始方法
# Docker Desktop の Kubernetes を有効化
kubectl run hello --image=nginx:1.21
kubectl expose pod hello --port=80 --type=LoadBalancer
```

### 中級者（体系的学習）
**推奨**: minikube
```bash
# 豊富なアドオンで実戦的な学習
minikube start --memory=4096
minikube addons enable dashboard metrics-server ingress
```

### 上級者（効率重視）
**推奨**: kind
```bash
# 設定可能で軽量
kind create cluster --config multi-node-config.yaml
```

## 🚀 学習の進め方

### Phase 1: 環境構築（30分）
1. Docker Desktop または minikube のセットアップ
2. kubectl の動作確認
3. 基本的なPodデプロイテスト

### Phase 2: 基本操作習得（1-2時間）
1. kubectl基本コマンド習得
2. YAML ファイル作成
3. ネームスペース活用

### Phase 3: 実践演習（2-4時間）
1. サンプルアプリケーションデプロイ
2. Service と Ingress 設定
3. ConfigMap と Secret 活用

## 🔧 トラブルシューティング

### 一般的な問題

#### Docker Desktop Kubernetes が有効化できない
```bash
# Docker Desktop の再起動
# Windows: タスクトレイから "Restart Docker Desktop"
# macOS: Docker > Restart

# リソース増量
# Settings > Resources > Memory を 4GB 以上に設定
```

#### minikube start failed
```bash
# ドライバー確認
minikube start --driver=docker

# 既存クラスターのクリーンアップ
minikube delete
minikube start --driver=docker --memory=4096

# ログ確認
minikube logs
```

#### kubectl: connection refused
```bash
# クラスター状態確認
kubectl cluster-info

# コンテキスト確認
kubectl config current-context

# コンテキスト切り替え
kubectl config use-context docker-desktop
kubectl config use-context minikube
```

## ✅ 学習環境チェックリスト

環境構築完了の確認項目：

- [ ] Docker Desktop または minikube が起動済み
- [ ] `kubectl cluster-info` が正常に表示される
- [ ] `kubectl get nodes` でノードが Ready 状態
- [ ] 基本的な Pod のデプロイが成功する
- [ ] VS Code Kubernetes拡張機能が動作する
- [ ] kubectl 自動補完が有効
- [ ] 学習用ネームスペースが作成済み

---

**次のステップ**: 環境構築が完了したら、[Hello Kubernetes](../tutorials/hello-kubernetes.md) チュートリアルで実際のデプロイを体験してみましょう！

**AWS ECS経験者向けポイント**: 
- ローカル環境でもクラスター概念があることに注意
- ECS Exec の代わりに `kubectl exec` を使用
- CloudWatch の代わりに `kubectl logs` と Dashboard を活用
