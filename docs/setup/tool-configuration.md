# 🛠 Kubernetes開発ツール設定ガイド

このガイドでは、AWS ECS経験者向けに、Kubernetesアプリケーション開発に必要なツールの設定とベストプラクティスを詳しく解説します。kubectl、Helm、開発環境、IDEプラグイン、デバッグツールなどの効率的な設定方法を学習します。

## 📋 目次

1. [AWS ECSとの対応関係](#aws-ecsとの対応関係)
2. [必須ツール一覧](#必須ツール一覧)
3. [kubectl設定](#kubectl設定)
4. [Helm設定](#helm設定)
5. [IDE・エディター設定](#ideエディター設定)
6. [デバッグツール](#デバッグツール)
7. [ローカル開発環境](#ローカル開発環境)
8. [CI/CDツール連携](#cicdツール連携)
9. [実践演習](#実践演習)

## 🔄 AWS ECSとの対応関係

### 開発ツールマッピング

| AWS ECS環境 | Kubernetes環境 | 説明 |
|-------------|----------------|------|
| **AWS CLI** | **kubectl** | クラスター・リソース操作 |
| **ECS CLI** | **Helm** | アプリケーションパッケージ管理 |
| **CloudFormation** | **Kustomize** | 設定管理・テンプレート化 |
| **ECS Service Connect** | **Istio/Linkerd** | サービスメッシュ・通信管理 |
| **CloudWatch Insights** | **kubectl logs + stern** | ログ確認・検索 |
| **ECS Exec** | **kubectl exec** | コンテナ内コマンド実行 |
| **AWS Console** | **Kubernetes Dashboard** | Web UI管理画面 |
| **CodeCommit/CodeBuild** | **Skaffold** | ローカル開発・デプロイ |

### ワークフロー比較

```bash
# AWS ECS 開発フロー
aws ecs create-service --service-name my-app
aws ecs update-service --service my-app --task-definition my-app:2
aws logs tail /aws/ecs/my-app --follow

# Kubernetes 開発フロー
kubectl apply -f deployment.yaml
kubectl set image deployment/my-app container=my-app:v2
kubectl logs -f deployment/my-app
```

## 🧰 必須ツール一覧

### 1. 基本ツール

| ツール | 用途 | インストール優先度 |
|--------|------|-------------------|
| **kubectl** | Kubernetesクラスター操作 | 🔴 必須 |
| **Helm** | パッケージ管理 | 🔴 必須 |
| **Docker** | コンテナ構築・テスト | 🔴 必須 |
| **kubectx/kubens** | コンテキスト切り替え | 🟡 推奨 |
| **stern** | 複数Podログ表示 | 🟡 推奨 |
| **k9s** | TUIクラスター管理 | 🟡 推奨 |

### 2. 開発効率化ツール

| ツール | 用途 | インストール優先度 |
|--------|------|-------------------|
| **Skaffold** | ローカル開発ワークフロー | 🟡 推奨 |
| **Tilt** | ローカル開発環境管理 | 🟢 オプション |
| **Kustomize** | YAML設定管理 | 🟡 推奨 |
| **yq** | YAML処理・編集 | 🟡 推奨 |
| **jq** | JSON処理・編集 | 🟡 推奨 |
| **fzf** | 対話的検索ツール | 🟢 オプション |

### 3. 監視・デバッグツール

| ツール | 用途 | インストール優先度 |
|--------|------|-------------------|
| **kubectl-debug** | Podデバッグ | 🟡 推奨 |
| **kubectl-trace** | システムコール追跡 | 🟢 オプション |
| **popeye** | クラスター設定検証 | 🟡 推奨 |
| **polaris** | ベストプラクティス検証 | 🟡 推奨 |
| **kubectl-who-can** | RBAC権限確認 | 🟢 オプション |

## ⚙️ kubectl設定

### 1. kubectl基本設定

```bash
# 1. kubectl インストール (Linux)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 2. 補完機能設定
echo 'source <(kubectl completion bash)' >>~/.bashrc
echo 'alias k=kubectl' >>~/.bashrc
echo 'complete -o default -F __start_kubectl k' >>~/.bashrc

# 3. kubectx/kubens インストール
sudo git clone https://github.com/ahmetb/kubectx /opt/kubectx
sudo ln -s /opt/kubectx/kubectx /usr/local/bin/kubectx
sudo ln -s /opt/kubectx/kubens /usr/local/bin/kubens

# 4. 設定ファイル確認
kubectl config view
kubectl config get-contexts
```

### 2. 複数環境管理

```bash
# クラスター設定追加
kubectl config set-cluster development \
  --server=https://k8s-dev.mycompany.com \
  --certificate-authority=/path/to/dev-ca.crt

kubectl config set-cluster production \
  --server=https://k8s-prod.mycompany.com \
  --certificate-authority=/path/to/prod-ca.crt

# ユーザー設定
kubectl config set-credentials dev-user \
  --client-certificate=/path/to/dev-user.crt \
  --client-key=/path/to/dev-user.key

kubectl config set-credentials prod-user \
  --client-certificate=/path/to/prod-user.crt \
  --client-key=/path/to/prod-user.key

# コンテキスト作成
kubectl config set-context development \
  --cluster=development \
  --user=dev-user \
  --namespace=development

kubectl config set-context production \
  --cluster=production \
  --user=prod-user \
  --namespace=production

# コンテキスト切り替え
kubectx development
kubens development
```

### 3. kubectl便利設定

```bash
# ~/.kubectl_aliases
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get services'
alias kgd='kubectl get deployments'
alias kdp='kubectl describe pod'
alias kds='kubectl describe service'
alias kdd='kubectl describe deployment'
alias klf='kubectl logs -f'
alias kex='kubectl exec -it'
alias kdel='kubectl delete'
alias kapp='kubectl apply -f'

# 関数定義
klog() {
  kubectl logs -f deployment/$1
}

kexec() {
  kubectl exec -it deployment/$1 -- /bin/bash
}

kport() {
  kubectl port-forward service/$1 $2:$2
}

# ~/.bashrc に追加
source ~/.kubectl_aliases
```

### 4. kubeconfig最適化

```yaml
# ~/.kube/config の最適化例
apiVersion: v1
kind: Config
current-context: development

clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTi...
    server: https://k8s-dev.mycompany.com
  name: development

- cluster:
    certificate-authority-data: LS0tLS1CRUdJTi...
    server: https://k8s-prod.mycompany.com
  name: production

contexts:
- context:
    cluster: development
    namespace: development
    user: dev-user
  name: development

- context:
    cluster: production
    namespace: production
    user: prod-user
  name: production

users:
- name: dev-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args:
      - eks
      - get-token
      - --cluster-name
      - k8s-development
      - --region
      - us-west-2

- name: prod-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args:
      - eks
      - get-token
      - --cluster-name
      - k8s-production
      - --region
      - us-west-2
```

## 📦 Helm設定

### 1. Helm基本設定

```bash
# 1. Helm インストール
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 2. 補完機能設定
echo 'source <(helm completion bash)' >>~/.bashrc

# 3. 基本リポジトリ追加
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# 4. Helm設定確認
helm version
helm repo list
```

### 2. Chart開発環境

```bash
# Chart作成
helm create my-app

# Chart構造確認
tree my-app/
# my-app/
# ├── Chart.yaml
# ├── values.yaml
# ├── charts/
# └── templates/
#     ├── deployment.yaml
#     ├── service.yaml
#     ├── ingress.yaml
#     └── tests/

# Chart検証
helm lint my-app/
helm template my-app my-app/ --values my-app/values-dev.yaml
helm install my-app-dev my-app/ --values my-app/values-dev.yaml --dry-run

# Chart テスト
helm test my-app-dev
```

### 3. 環境別values管理

```yaml
# values-development.yaml
replicaCount: 1

image:
  repository: my-app
  tag: "dev-latest"
  pullPolicy: Always

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  hosts:
    - host: my-app-dev.internal.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
```

```yaml
# values-production.yaml
replicaCount: 3

image:
  repository: my-app
  tag: "v1.2.3"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
  hosts:
    - host: my-app.mycompany.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### 4. Helmfile設定

```yaml
# helmfile.yaml - 複数Chart管理
repositories:
- name: bitnami
  url: https://charts.bitnami.com/bitnami
- name: prometheus-community
  url: https://prometheus-community.github.io/helm-charts

environments:
  development:
    values:
    - environments/development/globals.yaml
  production:
    values:
    - environments/production/globals.yaml

releases:
- name: postgresql
  namespace: database
  chart: bitnami/postgresql
  version: 12.1.0
  values:
  - databases/postgresql-{{ .Environment.Name }}.yaml

- name: redis
  namespace: cache
  chart: bitnami/redis
  version: 17.3.7
  values:
  - cache/redis-{{ .Environment.Name }}.yaml

- name: my-app
  namespace: application
  chart: ./charts/my-app
  values:
  - applications/my-app-{{ .Environment.Name }}.yaml
```

```bash
# Helmfile 操作
helmfile sync  # すべてのリリースを同期
helmfile apply # 差分適用
helmfile destroy # すべてのリリース削除
```

## 🎯 IDE・エディター設定

### 1. Visual Studio Code設定

#### 必須拡張機能

```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-kubernetes-tools.vscode-kubernetes-tools",
    "redhat.vscode-yaml",
    "tim-koehler.helm-intellisense",
    "ms-vscode.vscode-docker",
    "ms-azuretools.vscode-docker",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

#### 設定ファイル

```json
// .vscode/settings.json
{
  "yaml.schemas": {
    "https://raw.githubusercontent.com/instrumenta/kubernetes-json-schema/master/v1.18.0-standalone-strict/all.json": "/*.k8s.yaml"
  },
  "yaml.format.enable": true,
  "yaml.completion": true,
  "yaml.hover": true,
  "yaml.validate": true,
  "files.associations": {
    "**/charts/**/*.yaml": "helm",
    "**/charts/**/*.yml": "helm",
    "**/templates/**/*.yaml": "helm",
    "**/templates/**/*.yml": "helm"
  },
  "helm-intellisense.customValueFileNames": [
    "values-development.yaml",
    "values-production.yaml",
    "values-staging.yaml"
  ]
}
```

#### スニペット設定

```json
// .vscode/snippets/kubernetes.json
{
  "Kubernetes Deployment": {
    "prefix": "k8s-deployment",
    "body": [
      "apiVersion: apps/v1",
      "kind: Deployment",
      "metadata:",
      "  name: ${1:app-name}",
      "  namespace: ${2:default}",
      "spec:",
      "  replicas: ${3:3}",
      "  selector:",
      "    matchLabels:",
      "      app: ${1:app-name}",
      "  template:",
      "    metadata:",
      "      labels:",
      "        app: ${1:app-name}",
      "    spec:",
      "      containers:",
      "      - name: ${1:app-name}",
      "        image: ${4:nginx:latest}",
      "        ports:",
      "        - containerPort: ${5:80}"
    ],
    "description": "Kubernetes Deployment template"
  },
  
  "Kubernetes Service": {
    "prefix": "k8s-service",
    "body": [
      "apiVersion: v1",
      "kind: Service",
      "metadata:",
      "  name: ${1:service-name}",
      "  namespace: ${2:default}",
      "spec:",
      "  selector:",
      "    app: ${3:app-name}",
      "  ports:",
      "  - port: ${4:80}",
      "    targetPort: ${5:8080}",
      "  type: ${6|ClusterIP,NodePort,LoadBalancer|}"
    ],
    "description": "Kubernetes Service template"
  }
}
```

### 2. IntelliJ IDEA設定

#### プラグイン設定

```
# 必須プラグイン
- Kubernetes
- Docker
- YAML/Ansible support
- Helm

# 推奨プラグイン
- GitToolBox
- Rainbow Brackets
- String Manipulation
```

#### 外部ツール設定

```xml
<!-- File -> Settings -> Tools -> External Tools -->
<tool name="kubectl apply" showInMainMenu="false" showInEditor="true" showInProject="true" showInSearchPopup="true" disabled="false" useConsole="true" showConsoleOnStdOut="true" showConsoleOnStdErr="true" synchronizeAfterRun="true">
  <exec>
    <option name="COMMAND" value="kubectl" />
    <option name="PARAMETERS" value="apply -f $FilePath$" />
    <option name="WORKING_DIRECTORY" value="$ProjectFileDir$" />
  </exec>
</tool>

<tool name="helm template" showInMainMenu="false" showInEditor="true" showInProject="true" showInSearchPopup="true" disabled="false" useConsole="true" showConsoleOnStdOut="true" showConsoleOnStdErr="true" synchronizeAfterRun="true">
  <exec>
    <option name="COMMAND" value="helm" />
    <option name="PARAMETERS" value="template $FileDir$ --values $FileDir$/values.yaml" />
    <option name="WORKING_DIRECTORY" value="$ProjectFileDir$" />
  </exec>
</tool>
```

### 3. 共通開発設定

```yaml
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{yaml,yml}]
indent_style = space
indent_size = 2

[*.{json}]
indent_style = space
indent_size = 2

[*.{sh}]
indent_style = space
indent_size = 2
```

```yaml
# .yamllint
extends: default
rules:
  line-length:
    max: 120
  comments:
    min-spaces-from-content: 1
  document-start: disable
  truthy:
    allowed-values: ['true', 'false']
    check-keys: false
```

## 🐛 デバッグツール

### 1. 基本デバッグツール

```bash
# stern インストール・使用
brew install stern
# または
wget https://github.com/stern/stern/releases/download/v1.22.0/stern_1.22.0_linux_amd64.tar.gz

# 複数Podのログ監視
stern my-app --namespace production --since 1h
stern "^my-app-.*" --selector app=my-app --tail 50

# k9s インストール・使用
brew install k9s
# または
wget https://github.com/derailed/k9s/releases/download/v0.27.4/k9s_Linux_amd64.tar.gz

# k9s起動
k9s
# :pods でPod一覧
# :svc でService一覧
# :deploy でDeployment一覧
```

### 2. 高度なデバッグツール

```bash
# kubectl-debug インストール
kubectl krew install debug

# デバッグ用コンテナ作成
kubectl debug my-pod --image=busybox --target=my-container

# ノードデバッグ
kubectl debug node/my-node --image=ubuntu

# kubectl-trace インストール
kubectl krew install trace

# システムコール追跡
kubectl trace run my-pod --program-from-file trace.bt
```

### 3. 設定検証ツール

```bash
# popeye インストール・実行
brew install derailed/popeye/popeye
popeye --namespace production

# polaris インストール・実行
kubectl apply -f https://github.com/FairwindsOps/polaris/releases/latest/download/dashboard.yaml
kubectl port-forward --namespace polaris svc/polaris-dashboard 8080:80

# kube-score 使用
kube-score score my-deployment.yaml
```

## 🏠 ローカル開発環境

### 1. Minikube設定

```bash
# Minikube インストール
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# プロファイル作成
minikube start --profile development --cpus 4 --memory 8192 --disk-size 50g
minikube start --profile testing --cpus 2 --memory 4096 --disk-size 20g

# アドオン有効化
minikube addons enable ingress --profile development
minikube addons enable dashboard --profile development
minikube addons enable metrics-server --profile development

# プロファイル切り替え
minikube profile development
```

### 2. Kind設定

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: development
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
```

```bash
# Kind クラスター作成
kind create cluster --config kind-config.yaml

# NGINX Ingress インストール
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```

### 3. Skaffold設定

```yaml
# skaffold.yaml
apiVersion: skaffold/v2beta28
kind: Config
metadata:
  name: my-app
build:
  artifacts:
  - image: my-app
    docker:
      dockerfile: Dockerfile
  local:
    push: false
deploy:
  helm:
    releases:
    - name: my-app
      chartPath: charts/my-app
      valuesFiles:
      - charts/my-app/values-development.yaml
      setValues:
        image.tag: my-app
portForward:
- resourceType: service
  resourceName: my-app
  port: 8080
  localPort: 8080
```

```bash
# Skaffold開発モード
skaffold dev --port-forward

# Skaffold デバッグモード
skaffold debug --port-forward
```

### 4. Tilt設定

```python
# Tiltfile
# Docker Build
docker_build('my-app', '.')

# Kubernetes Deploy
k8s_yaml('k8s/development/')

# Port Forward
k8s_resource('my-app', port_forwards='8080:8080')

# Live Update
docker_build(
  'my-app',
  '.',
  live_update=[
    sync('./src', '/app/src'),
    run('npm install', trigger=['./package.json'])
  ]
)

# Local Resource
local_resource(
  'test',
  'npm test',
  deps=['./src', './test'],
  auto_init=False
)
```

```bash
# Tilt起動
tilt up
# Web UI: http://localhost:10350
```

## 🚀 CI/CDツール連携

### 1. GitLab CI設定

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_REGISTRY: harbor.mycompany.com
  KUBE_NAMESPACE: $CI_COMMIT_REF_SLUG

test:
  stage: test
  image: node:16
  script:
    - npm install
    - npm test
    - npm run lint
  only:
    - merge_requests
    - main

build:
  stage: build
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context mycompany/k8s-production:production
    - helm upgrade --install my-app charts/my-app 
        --set image.tag=$CI_COMMIT_SHA 
        --namespace $KUBE_NAMESPACE
        --create-namespace
  environment:
    name: production
    url: https://my-app.mycompany.com
  only:
    - main
```

### 2. GitHub Actions設定

```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v3
      with:
        node-version: '16'
    - run: npm ci
    - run: npm test
    - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
    - uses: actions/checkout@v4
    - uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v4
    - uses: azure/k8s-set-context@v1
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG }}
    - uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/deployment.yaml
          k8s/service.yaml
        images: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        namespace: production
```

## 🔧 実践演習

### 演習1: 開発環境構築

```bash
# 1. 必須ツールインストール
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/

curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 2. ローカルクラスター起動
minikube start --profile development

# 3. サンプルアプリケーションデプロイ
helm create my-first-app
helm install my-first-app ./my-first-app

# 4. ポートフォワード設定
kubectl port-forward service/my-first-app 8080:80

# 5. アプリケーション確認
curl http://localhost:8080
```

### 演習2: デバッグツール実習

```bash
# 1. 問題のあるPodデプロイ
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: problematic-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: problematic-app
  template:
    metadata:
      labels:
        app: problematic-app
    spec:
      containers:
      - name: app
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          limits:
            memory: "64Mi"
            cpu: "250m"
          requests:
            memory: "32Mi"
            cpu: "125m"
EOF

# 2. 問題診断
kubectl get pods -l app=problematic-app
kubectl describe pod <pod-name>

# 3. ログ確認
stern problematic-app

# 4. リソース使用量確認
kubectl top pods -l app=problematic-app

# 5. 設定検証
popeye --namespace default
```

### 演習3: CI/CDパイプライン構築

```bash
# 1. GitOpsリポジトリ作成
git init k8s-gitops
cd k8s-gitops

# 2. ディレクトリ構造作成
mkdir -p {environments/{development,staging,production},applications,base}

# 3. Argo CD設定
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 4. Application作成
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/mycompany/k8s-gitops
    targetRevision: HEAD
    path: environments/development
  destination:
    server: https://kubernetes.default.svc
    namespace: development
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
```

## 📚 ベストプラクティス

### 1. 開発ワークフロー最適化

```bash
# ~/.bash_profile - 開発効率化関数
# クイック操作関数
kwatch() {
  watch -n 2 "kubectl get pods -n ${1:-default} | grep ${2:-.}"
}

kdrain() {
  kubectl drain $1 --ignore-daemonsets --delete-emptydir-data --force
}

kscale() {
  kubectl scale deployment $1 --replicas=$2
}

# 環境切り替え関数
use-dev() {
  kubectx development
  kubens development
  export KUBECONFIG=~/.kube/dev-config
}

use-prod() {
  kubectx production
  kubens production
  export KUBECONFIG=~/.kube/prod-config
}
```

### 2. セキュリティ設定

```yaml
# .kubectl-security-policy
# セキュアなkubectl設定
apiVersion: v1
kind: Config
preferences:
  colors: true
clusters:
- cluster:
    certificate-authority-data: <CA_DATA>
    server: https://k8s-api.mycompany.com
  name: secure-cluster
contexts:
- context:
    cluster: secure-cluster
    namespace: my-namespace
    user: limited-user
  name: secure-context
current-context: secure-context
users:
- name: limited-user
  user:
    token: <LIMITED_TOKEN>
```

### 3. 監視・アラート設定

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: development-alerts
spec:
  groups:
  - name: development
    rules:
    - alert: PodRestartingTooMuch
      expr: rate(kube_pod_container_status_restarts_total[1h]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} is restarting too frequently"
```

---

**AWS ECS管理者へのアドバイス**: 
ツール設定は段階的に進めることが重要です。まずはkubectl + Helmの基本操作に慣れ、その後デバッグツールやIDE連携を追加していくことをお勧めします。AWS CLIの知識があれば、kubectlの習得も比較的スムーズに進むはずです。IDE設定とCI/CD連携により、ECSでの開発効率を上回る環境を構築できます。
