# 🛠️ ツールのインストール - 開発環境構築ガイド

Kubernetes開発・運用に必要なツールの導入と設定方法を説明します。AWS ECS経験者が効率的にKubernetes環境を構築できるよう、ステップバイステップで解説します。

## 🎯 対象ツール

- **kubectl** - Kubernetesクラスター操作CLI
- **Helm** - Kubernetesパッケージマネージャー
- **kustomize** - YAML設定管理ツール
- **minikube/kind** - ローカルクラスター
- **VS Code拡張機能** - 開発効率化

## 💻 OS別インストール手順

### Windows環境

#### 🪟 Windows Package Manager (winget) 使用

```powershell
# 管理者権限でPowerShell起動

# Docker Desktop
winget install Docker.DockerDesktop

# kubectl
winget install Kubernetes.kubectl

# Helm
winget install Helm.Helm

# minikube
winget install Kubernetes.minikube

# kind (オプション)
winget install Kubernetes.kind
```

#### 🍫 Chocolatey 使用（代替方法）

```powershell
# Chocolatey未インストールの場合
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# ツールのインストール
choco install kubernetes-cli
choco install kubernetes-helm
choco install minikube
choco install kind
```

### macOS環境

#### 🍺 Homebrew 使用

```bash
# Homebrew未インストールの場合
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Docker Desktop
brew install --cask docker

# kubectl
brew install kubectl

# Helm
brew install helm

# minikube
brew install minikube

# kind
brew install kind

# kustomize
brew install kustomize
```

### Linux環境（Ubuntu/Debian）

```bash
# 必要なパッケージ
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl

# kubectl
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-archive-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

## ⚙️ ツール設定

### kubectl 設定

```bash
# インストール確認
kubectl version --client

# 自動補完の有効化（bash）
echo 'source <(kubectl completion bash)' >> ~/.bashrc
echo 'alias k=kubectl' >> ~/.bashrc
echo 'complete -o default -F __start_kubectl k' >> ~/.bashrc

# 自動補完の有効化（zsh）
echo 'source <(kubectl completion zsh)' >> ~/.zshrc
echo 'alias k=kubectl' >> ~/.zshrc
echo 'compdef __start_kubectl k' >> ~/.zshrc

# 設定の再読み込み
source ~/.bashrc  # または ~/.zshrc
```

### Helm 設定

```bash
# インストール確認
helm version

# 公式Helmリポジトリの追加
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 自動補完の有効化
helm completion bash > /etc/bash_completion.d/helm  # Linux
helm completion zsh > "${fpath[1]}/_helm"           # macOS
```

### minikube 設定

```bash
# インストール確認
minikube version

# クラスター起動
minikube start --driver=docker --memory=4096 --cpus=2

# kubectl設定の自動更新
minikube update-context

# ダッシュボード有効化
minikube addons enable dashboard
minikube addons enable metrics-server

# アクセス確認
kubectl cluster-info
kubectl get nodes
```

## 🔧 VS Code 拡張機能

### 必須拡張機能

```json
{
  "recommendations": [
    "ms-kubernetes-tools.vscode-kubernetes-tools",
    "ms-azuretools.vscode-docker",
    "redhat.vscode-yaml",
    "tim-koehler.helm-intellisense",
    "signageos.signageos-vscode-sops",
    "github.copilot"
  ]
}
```

### インストール手順

```bash
# VS Code拡張機能の一括インストール
code --install-extension ms-kubernetes-tools.vscode-kubernetes-tools
code --install-extension ms-azuretools.vscode-docker
code --install-extension redhat.vscode-yaml
code --install-extension tim-koehler.helm-intellisense
```

### VS Code設定

```json
// settings.json
{
  "kubernetes-explorer.kubeconfig": null,
  "vs-kubernetes": {
    "vs-kubernetes.crd-code-completion": "enabled",
    "vs-kubernetes.helm-path.linux": "/usr/local/bin/helm",
    "vs-kubernetes.helm-path.mac": "/usr/local/bin/helm",
    "vs-kubernetes.helm-path.windows": "helm.exe"
  },
  "yaml.schemas": {
    "https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master/v1.22.0/all.json": "*.k8s.yaml"
  }
}
```

## 🧪 動作確認

### 基本動作テスト

```bash
# 1. kubectl動作確認
kubectl version --client
kubectl cluster-info

# 2. Helm動作確認
helm version
helm repo list

# 3. minikube動作確認
minikube status
minikube ip

# 4. 簡単なPodデプロイテスト
kubectl run test-pod --image=nginx:1.21 --rm -it --restart=Never -- echo "Hello Kubernetes"
```

### 詳細確認コマンド

```bash
# クラスターの詳細情報
kubectl get nodes -o wide
kubectl get pods --all-namespaces
kubectl get services --all-namespaces

# リソース使用量
kubectl top nodes
kubectl top pods --all-namespaces

# アドオン確認
minikube addons list
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. kubectl: command not found

```bash
# PATHの確認
echo $PATH

# kubectlの場所確認
which kubectl

# PATHに追加（例：macOS Homebrew）
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

#### 2. minikube start failed

```bash
# ドライバーの確認
minikube start --driver=docker

# 別のドライバーを試す
minikube start --driver=virtualbox
minikube start --driver=hyperv  # Windows

# クリーンアップして再試行
minikube delete
minikube start --driver=docker --memory=4096
```

#### 3. Docker Desktop接続エラー

```bash
# Docker Desktopの起動確認
docker version
docker ps

# Docker Desktopの再起動
# Windows: タスクトレイから再起動
# macOS: Applications > Docker > 再起動
```

#### 4. Helm repo 追加エラー

```bash
# HTTPSプロキシ設定（企業環境）
helm repo add stable https://charts.helm.sh/stable --insecure-skip-tls-verify

# 証明書エラーの場合
export HELM_TLS_VERIFY=false
helm repo add stable https://charts.helm.sh/stable
```

## 📊 AWS ECS CLI との比較

| 機能 | AWS ECS CLI | Kubernetes ツール |
|------|-------------|-------------------|
| **インストール** | `pip install awscli` | `winget install kubectl` |
| **認証設定** | `aws configure` | kubeconfig ファイル |
| **クラスター操作** | `aws ecs` | `kubectl` |
| **テンプレート管理** | CloudFormation | Helm, Kustomize |
| **ローカル開発** | ECS Local | minikube, kind |
| **IDE統合** | AWS Toolkit | Kubernetes Tools |

### 学習のポイント
- **AWS CLI** に慣れている場合、`kubectl` の操作感は似ている
- **CloudFormation** の代わりに **Helm** でテンプレート管理
- **ECS Exec** の代わりに `kubectl exec` でコンテナ内アクセス

## 📚 追加ツール（オプション）

### 開発効率化ツール

```bash
# k9s - TUIでのKubernetes管理
curl -sS https://webinstall.dev/k9s | bash

# kubectx/kubens - コンテキスト/ネームスペース切り替え
brew install kubectx  # macOS
choco install kubectx kubens  # Windows

# stern - マルチPodログ表示
brew install stern  # macOS
choco install stern  # Windows
```

### 使用例

```bash
# k9s の起動
k9s

# コンテキスト切り替え
kubectx minikube
kubectx docker-desktop

# ネームスペース切り替え
kubens kube-system
kubens default

# 複数Podのログ監視
stern app-name
```

## ✅ インストール完了チェックリスト

- [ ] Docker Desktop インストール・起動確認
- [ ] kubectl インストール・動作確認
- [ ] Helm インストール・リポジトリ追加
- [ ] minikube/kind インストール・クラスター起動
- [ ] VS Code 拡張機能インストール
- [ ] kubectl 自動補完設定
- [ ] 基本的なPodデプロイテスト成功

---

**次のステップ**: 環境構築が完了したら、[Hello Kubernetes](../tutorials/hello-kubernetes.md) チュートリアルで実際のPodデプロイを体験してみましょう！
