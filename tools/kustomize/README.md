# 🔧 Kustomize - 宣言的設定管理ツール

KustomizeはKubernetesマニフェストの設定管理ツールです。テンプレートを使わずに、オーバーレイ方式で環境別設定を管理できます。AWS ECS経験者にとって、パラメータストアやCloudFormationの代替となる重要なツールです。

## 🎯 Kustomizeとは

### 基本概念
- **Base**: 共通の基本設定
- **Overlay**: 環境固有の差分設定
- **Patch**: 既存設定の部分的な変更
- **Generator**: ConfigMap/Secretの動的生成

### AWS ECSとの比較

| AWS ECS | Kustomize | 説明 |
|---------|-----------|------|
| **Task Definition Template** | Base | 基本的なコンテナ定義 |
| **Parameter Store** | ConfigMap Generator | 設定値の管理 |
| **Environment Variables** | Overlay | 環境別の設定差分 |
| **CloudFormation Parameters** | Kustomization.yaml | 設定の統合管理 |

## 🚀 インストールと基本操作

### インストール
```bash
# kubectl統合版（推奨）
kubectl kustomize --help

# スタンドアロン版
# Windows
winget install Kubernetes.kustomize

# macOS
brew install kustomize

# Linux
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
```

### 基本ディレクトリ構造
```
app/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── development/
    │   ├── kustomization.yaml
    │   └── config-patch.yaml
    ├── staging/
    │   ├── kustomization.yaml
    │   └── scaling-patch.yaml
    └── production/
        ├── kustomization.yaml
        ├── security-patch.yaml
        └── resources-patch.yaml
```

## 📦 Step 1: Base設定の作成

### deployment.yaml
```yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: app
        image: nginx:1.21
        ports:
        - containerPort: 80
        env:
        - name: ENVIRONMENT
          value: "base"
        resources:
          requests:
            memory: "64Mi"
            cpu: "250m"
          limits:
            memory: "128Mi"
            cpu: "500m"
```

### service.yaml
```yaml
# base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
  labels:
    app: web-app
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### base/kustomization.yaml
```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: web-app-base

# 管理するリソース
resources:
- deployment.yaml
- service.yaml

# 共通ラベル
commonLabels:
  team: platform
  version: v1.0

# 共通アノテーション
commonAnnotations:
  managed-by: kustomize
  
# イメージタグ設定
images:
- name: nginx
  newTag: "1.21"

# ネームプレフィックス
namePrefix: ""

# ネームサフィックス
nameSuffix: ""
```

## 🔧 Step 2: 環境別Overlay作成

### Development環境
```yaml
# overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Base設定を参照
resources:
- ../../base

# 名前にサフィックス追加
nameSuffix: -dev

# 環境固有のラベル
commonLabels:
  environment: development

# レプリカ数の変更
replicas:
- name: web-app
  count: 1

# イメージタグの変更
images:
- name: nginx
  newTag: "1.21-alpine"

# 環境変数の変更
patchesStrategicMerge:
- config-patch.yaml

# ConfigMap生成
configMapGenerator:
- name: app-config
  literals:
  - DATABASE_URL=postgresql://dev-db:5432/myapp
  - DEBUG=true
  - LOG_LEVEL=debug

# Secret生成
secretGenerator:
- name: app-secrets
  literals:
  - API_KEY=dev-api-key-12345
  - DB_PASSWORD=dev-password
```

```yaml
# overlays/development/config-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: ENVIRONMENT
          value: "development"
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_URL
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: API_KEY
```

### Production環境
```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

nameSuffix: -prod

commonLabels:
  environment: production

# 本番用のレプリカ数
replicas:
- name: web-app
  count: 5

# 本番イメージタグ
images:
- name: nginx
  newTag: "1.21.6"

# 複数のパッチ適用
patchesStrategicMerge:
- scaling-patch.yaml
- security-patch.yaml
- resources-patch.yaml

configMapGenerator:
- name: app-config
  literals:
  - DATABASE_URL=postgresql://prod-db:5432/myapp
  - DEBUG=false
  - LOG_LEVEL=info

secretGenerator:
- name: app-secrets
  envs:
  - secrets.env  # ファイルから読み込み
```

```yaml
# overlays/production/resources-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
```

## 🛠️ Step 3: 高度な機能

### JSONパッチによる細かい変更
```yaml
# overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

# JSONパッチでピンポイント変更
patchesJson6902:
- target:
    version: v1
    kind: Deployment
    name: web-app
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 3
    - op: add
      path: /spec/template/spec/containers/0/env/-
      value:
        name: CACHE_ENABLED
        value: "true"
```

### カスタムリソース生成
```yaml
# カスタムリソースジェネレーター
generators:
- custom-generator.yaml

# Custom Generator設定
# custom-generator.yaml
apiVersion: builtin
kind: ConfigMapGenerator
metadata:
  name: dynamic-config
options:
  disableNameSuffixHash: true
files:
- configs/app.properties
- configs/logging.conf
```

### 変数置換
```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml

# 変数定義
vars:
- name: APP_NAME
  objref:
    kind: Deployment
    name: web-app
    apiVersion: apps/v1
  fieldref:
    fieldpath: metadata.name
- name: APP_VERSION
  objref:
    kind: ConfigMap
    name: app-config
    apiVersion: v1
  fieldref:
    fieldpath: data.version

# 設定ファイルで変数を使用
# $(APP_NAME) や $(APP_VERSION) として参照可能
```

## 🔍 実際の運用

### デプロイコマンド
```bash
# 開発環境へのデプロイ
kubectl apply -k overlays/development/

# 本番環境へのデプロイ
kubectl apply -k overlays/production/

# 生成されるYAMLの確認（デプロイしない）
kubectl kustomize overlays/development/

# 差分確認
kubectl diff -k overlays/production/
```

### CI/CDパイプライン統合
```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to staging
      run: |
        kubectl apply -k overlays/staging/
        
    - name: Deploy to production
      if: github.ref == 'refs/heads/main'
      run: |
        kubectl apply -k overlays/production/
```

## 📊 実践例: マイクロサービス管理

### 複数サービスの統合管理
```
microservices/
├── services/
│   ├── user-service/
│   │   ├── base/
│   │   └── overlays/
│   ├── order-service/
│   │   ├── base/
│   │   └── overlays/
│   └── payment-service/
│       ├── base/
│       └── overlays/
└── environments/
    ├── development/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

```yaml
# environments/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 全サービスの本番設定を統合
resources:
- ../../services/user-service/overlays/production
- ../../services/order-service/overlays/production
- ../../services/payment-service/overlays/production

# 本番環境共通の設定
commonLabels:
  environment: production
  team: platform

# Namespace
namespace: production

# ネットワークポリシー等の共通リソース
resources:
- network-policy.yaml
- resource-quotas.yaml
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. パッチが適用されない
```bash
# 生成されるYAMLを確認
kubectl kustomize overlays/development/

# ターゲットリソースの名前・種類が正確か確認
# metadata.name と kind が一致している必要がある
```

#### 2. ConfigMap/Secretのハッシュサフィックス
```yaml
# ハッシュサフィックスを無効化
configMapGenerator:
- name: app-config
  options:
    disableNameSuffixHash: true
  literals:
  - KEY=value
```

#### 3. 相対パス問題
```bash
# kustomization.yamlからの相対パスで指定
resources:
- ../../base  # 正しい
- /absolute/path/base  # 避ける
```

## 🎯 AWS ECS経験者向けのポイント

### ECS vs Kustomize 設定管理

#### ECS Task Definition Templates
```json
{
  "family": "my-app-${ENVIRONMENT}",
  "cpu": "${CPU}",
  "memory": "${MEMORY}",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "my-app:${IMAGE_TAG}",
      "environment": [
        {"name": "ENV", "value": "${ENVIRONMENT}"}
      ]
    }
  ]
}
```

#### Kustomize相当
```yaml
# base + overlay で同様の効果
# より強力な設定管理とパッチ機能
```

### 移行のポイント
1. **パラメータ化**: ECSのパラメータストア → Kustomize変数
2. **環境分離**: ECSのタスク定義テンプレート → Kustomizeオーバーレイ
3. **設定注入**: ECS環境変数 → ConfigMap/Secret Generator

## ✅ 学習チェックリスト

- [ ] Kustomizeの基本概念を理解（Base/Overlay）
- [ ] 基本的なkustomization.yamlを作成できる
- [ ] 環境別オーバーレイを作成できる
- [ ] ConfigMap/SecretGeneratorを使用できる
- [ ] パッチ（Strategic Merge/JSON6902）を適用できる
- [ ] kubectl kustomize でYAML生成確認ができる
- [ ] 実際の環境にデプロイできる

---

**次のステップ**: Kustomizeの基本を習得したら、[ArgoCD](../argocd/)と組み合わせてGitOpsワークフローを構築してみましょう。

**AWS ECS経験者向けまとめ**: 
- Kustomize ≈ CloudFormation + Parameter Store の代替
- より柔軟な設定管理とパッチ機能
- Gitベースの設定管理でIaCを実現
