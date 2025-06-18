# Kubernetes開発環境の構築 🛠️

## はじめに

AWS ECS管理者の皆さんがKubernetesを効率的に学習できる開発環境を構築します。ローカル環境での学習から、本格的なAWS EKSクラスターまで段階的にセットアップしていきます。

## 🎯 環境構築の全体像

```text
┌─────────────────────────────────────┐
│           学習ステップ               │
├─────────────────────────────────────┤
│  1. ローカルKubernetes環境          │
│     ├── Docker Desktop (Windows)    │
│     ├── kind / minikube            │
│     └── kubectl                    │
├─────────────────────────────────────┤
│  2. AWS CLI & eksctl               │
│     ├── AWS認証設定                 │
│     └── EKSクラスター管理           │
├─────────────────────────────────────┤
│  3. 開発ツール                      │
│     ├── VS Code拡張機能             │
│     ├── Helm                       │
│     └── k9s (クラスター管理UI)      │
└─────────────────────────────────────┘
```

## 🚀 Step 1: ローカルKubernetes環境

### Docker Desktopの設定（Windows）

1. **Docker Desktopのインストール**

```powershell
# Chocolateyを使用（推奨）
choco install docker-desktop

# または手動ダウンロード
# https://www.docker.com/products/docker-desktop/
```

2. **Kubernetesの有効化**

```text
Docker Desktop → Settings → Kubernetes → Enable Kubernetes ✓
```

3. **動作確認**

```powershell
# Dockerの確認
docker --version
docker run hello-world

# Kubernetesの確認
kubectl version --client
kubectl cluster-info
```

### kindの設定（軽量な代替案）

Docker Desktopが重い場合のより軽量な選択肢：

```powershell
# kindのインストール
choco install kind

# クラスターの作成
kind create cluster --name learning-cluster

# kubectl contextの切り替え
kubectl config use-context kind-learning-cluster

# クラスターの確認
kubectl get nodes
```

### kubectlの設定

```powershell
# kubectlのインストール（Docker Desktopに含まれているが、最新版を取得）
choco install kubernetes-cli

# 補完機能の設定（PowerShell）
kubectl completion powershell | Out-String | Invoke-Expression

# エイリアスの設定
Set-Alias -Name k -Value kubectl
```

## 🔧 Step 2: AWS CLI & eksctl設定

### AWS CLIの設定

```powershell
# AWS CLIのインストール
choco install awscli

# 認証情報の設定（既存のECS管理者権限を使用）
aws configure
# AWS Access Key ID: [既存のキー]
# AWS Secret Access Key: [既存のシークレット]
# Default region name: us-west-2
# Default output format: json

# 動作確認
aws sts get-caller-identity
aws eks list-clusters
```

### eksctlの設定

```powershell
# eksctlのインストール
choco install eksctl

# 動作確認
eksctl version
```

### テスト用EKSクラスターの作成

```powershell
# 学習用小規模クラスターの作成（コスト最適化）
eksctl create cluster \
  --name learning-eks \
  --version 1.28 \
  --region us-west-2 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed

# クラスター接続確認
kubectl get nodes
kubectl get pods -A
```

**⚠️ コスト注意**: このクラスターは学習後に必ず削除してください
```powershell
eksctl delete cluster --name learning-eks --region us-west-2
```

## 📚 Step 3: VS Code拡張機能とツール

### 必須VS Code拡張機能

```powershell
# VS Code拡張機能のインストール
code --install-extension ms-kubernetes-tools.vscode-kubernetes-tools
code --install-extension redhat.vscode-yaml
code --install-extension ms-vscode.vscode-json
code --install-extension ms-azuretools.vscode-docker
```

#### 主要拡張機能の説明

1. **Kubernetes Tools**
   - YAMLファイルの構文チェック
   - クラスターリソースの表示
   - kubectl統合

2. **YAML Support**
   - Kubernetes YAMLの自動補完
   - スキーマ検証

3. **Docker Extension**
   - Dockerfileとcompose.ymlサポート

### 便利なCLIツール

#### Helmのインストール

```powershell
# Helmパッケージマネージャー
choco install kubernetes-helm

# 動作確認
helm version

# 基本的なリポジトリ追加
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

#### k9sのインストール（クラスター管理UI）

```powershell
# k9s - ターミナル内Kubernetes管理UI
choco install k9s

# 起動
k9s

# 基本的なキー操作
# :pods -> Podの一覧
# :svc -> Serviceの一覧
# :deploy -> Deploymentの一覧
# q -> 終了
```

#### kubectx/kubenの代替（PowerShell用）

```powershell
# コンテキスト切り替え関数をプロファイルに追加
notepad $PROFILE

# 以下をプロファイルに追加:
function kctx {
    param([string]$context)
    if ($context) {
        kubectl config use-context $context
    } else {
        kubectl config get-contexts
    }
}

function kns {
    param([string]$namespace)
    if ($namespace) {
        kubectl config set-context --current --namespace=$namespace
    } else {
        kubectl config view --minify --output 'jsonpath={..namespace}'
    }
}
```

## 🏗️ Step 4: 開発ワークフローの設定

### プロジェクト構造の準備

```powershell
# 学習用ディレクトリ構造
mkdir c:\dev\k8s-projects
cd c:\dev\k8s-projects

# サンプルプロジェクト構造
mkdir manifests
mkdir helm-charts
mkdir apps
mkdir monitoring

# サンプルアプリケーション
git clone https://github.com/kubernetes/examples.git
```

### VS Code Workspace設定

```json
{
  "folders": [
    {
      "path": "."
    }
  ],
  "settings": {
    "yaml.schemas": {
      "https://json.schemastore.org/kustomization": "kustomization.yaml",
      "kubernetes": "*.yaml"
    },
    "yaml.customTags": [
      "!And",
      "!If",
      "!Not",
      "!Equals",
      "!Or",
      "!FindInMap sequence",
      "!Base64",
      "!Cidr",
      "!Ref",
      "!Sub",
      "!GetAtt",
      "!GetAZs",
      "!ImportValue",
      "!Select",
      "!Split",
      "!Join sequence"
    ],
    "files.associations": {
      "*.yaml": "yaml",
      "*.yml": "yaml"
    }
  },
  "extensions": {
    "recommendations": [
      "ms-kubernetes-tools.vscode-kubernetes-tools",
      "redhat.vscode-yaml",
      "ms-azuretools.vscode-docker"
    ]
  }
}
```

### Git設定（Kubernetes YAML管理）

```powershell
# .gitignoreの作成
@"
# Kubernetes
*.tmp
*.secret
*-secret.yaml

# Helm
charts/*.tgz
.helmignore

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db
"@ | Out-File -FilePath .gitignore -Encoding UTF8
```

## 🔍 Step 5: 動作確認とサンプルデプロイ

### ローカル環境での確認

```powershell
# 現在のコンテキスト確認
kubectl config current-context

# サンプルPodの作成
kubectl run nginx --image=nginx:1.21 --port=80

# Podの確認
kubectl get pods
kubectl describe pod nginx

# サービスの作成と確認
kubectl expose pod nginx --type=NodePort --port=80
kubectl get services

# ローカルアクセス確認（Docker Desktop使用時）
kubectl port-forward pod/nginx 8080:80
# ブラウザで http://localhost:8080 にアクセス

# リソースの削除
kubectl delete pod nginx
kubectl delete service nginx
```

### YAMLファイルでのデプロイテスト

**nginx-deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 2
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
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

```powershell
# YAMLファイルでのデプロイ
kubectl apply -f nginx-deployment.yaml

# 確認
kubectl get deployments
kubectl get pods
kubectl get services

# VS Codeでのライブ編集テスト
code nginx-deployment.yaml
# レプリカ数を3に変更して保存

kubectl apply -f nginx-deployment.yaml
kubectl get pods  # 3つのPodが確認できる

# クリーンアップ
kubectl delete -f nginx-deployment.yaml
```

## 🐛 トラブルシューティング

### よくある問題と解決策

#### 1. Docker Desktopが起動しない
```powershell
# Hyper-Vとコンテナ機能の有効化確認
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V /all
dism.exe /online /enable-feature /featurename:Containers /all

# 再起動後、Docker Desktopを再インストール
```

#### 2. kubectl接続エラー
```powershell
# コンテキストの確認
kubectl config get-contexts

# コンテキストの修正
kubectl config use-context docker-desktop

# クラスター情報の確認
kubectl cluster-info
```

#### 3. AWS EKS接続エラー
```powershell
# AWS認証情報の確認
aws sts get-caller-identity

# EKSクラスターの認証情報更新
aws eks update-kubeconfig --region us-west-2 --name learning-eks

# kubectl確認
kubectl get nodes
```

#### 4. VS Code Kubernetes拡張が動作しない
```powershell
# 拡張機能の再インストール
code --uninstall-extension ms-kubernetes-tools.vscode-kubernetes-tools
code --install-extension ms-kubernetes-tools.vscode-kubernetes-tools

# VS Codeの再起動
```

## 📋 環境確認チェックリスト

- [ ] Docker Desktopが起動し、Kubernetesが有効
- [ ] kubectl コマンドが動作
- [ ] AWS CLIが設定済み
- [ ] eksctl が動作
- [ ] VS Code拡張機能がインストール済み
- [ ] helm コマンドが動作
- [ ] k9s が起動
- [ ] サンプルPodのデプロイが成功
- [ ] YAMLファイルでのデプロイが成功

## 🎓 学習環境の活用方法

### 日常的な学習ルーチン

1. **朝の環境確認**（5分）
```powershell
kubectl cluster-info
kubectl get nodes
kubectl get pods -A
```

2. **新機能の実験**（30-60分）
   - 新しいKubernetesリソースのテスト
   - YAMLファイルの編集と適用
   - VS Code拡張機能の活用

3. **定期的なクリーンアップ**（週1回）
```powershell
# 不要なリソースの削除
kubectl get all -A
kubectl delete pod --field-selector=status.phase=Succeeded -A
```

### 学習プロジェクトの進め方

1. **各ガイドの実践**
   - ガイドの内容を実際に環境で試す
   - ECSとの違いを体感する

2. **サンプルアプリケーションの改造**
   - 提供されたYAMLファイルを修正
   - 新しい機能を追加

3. **実際のアプリケーションの移植**
   - 既存のECSタスクをKubernetesに移植
   - 段階的に複雑さを増す

## 📝 まとめ

✅ **ローカル開発環境**: Docker Desktop + kubectl  
✅ **クラウド環境**: AWS EKS + eksctl  
✅ **開発ツール**: VS Code + 専用拡張機能  
✅ **管理ツール**: helm + k9s  
✅ **動作確認**: サンプルデプロイ成功  

環境構築が完了したら、次は実際にKubernetesの核となる概念を学習しましょう。

---

**次へ**: [Pod、Service、Deploymentの基本](./04-core-concepts.md)
