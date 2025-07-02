# 🔄 ArgoCD - GitOps継続的デプロイメント

ArgoCDはKubernetes向けの宣言的GitOps継続的デプロイメントツールです。Gitリポジトリを真実の源として、アプリケーションの状態を自動的に同期します。AWS ECS経験者にとって、CodePipelineやCodeDeployの代替となる強力なツールです。

## 🎯 ArgoCDとは

### GitOpsの原則
1. **宣言的**: 全システム状態をGitで宣言的に記述
2. **バージョン管理**: Gitでシステム状態の履歴管理
3. **自動同期**: Git変更を自動的にクラスターに適用
4. **継続的な監視**: 実際の状態と期待状態の差分を監視

### AWS ECSとの比較

| AWS ECS | ArgoCD | 説明 |
|---------|--------|------|
| **CodePipeline** | ArgoCD Application | デプロイメントパイプライン |
| **CodeDeploy** | Sync Operation | 実際のデプロイ実行 |
| **CloudFormation** | Kustomize/Helm | インフラ・アプリ定義 |
| **Parameter Store** | Git Repository | 設定の管理場所 |
| **CloudWatch** | ArgoCD UI | デプロイ状況の監視 |

## 🚀 インストールとセットアップ

### クラスターへのインストール

```bash
# ArgoCD namespace作成
kubectl create namespace argocd

# ArgoCDインストール
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# インストール確認
kubectl get pods -n argocd

# 全Pod起動まで待機
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### ArgoCD CLI インストール

```bash
# Windows
winget install ArgoProj.ArgoCD-CLI

# macOS
brew install argocd

# Linux
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
```

### 初期設定

```bash
# AdminパスワードのSecret取得
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# ポートフォワードでUI接続
kubectl port-forward svc/argocd-server -n argocd 8080:443

# ブラウザで https://localhost:8080 にアクセス
# ユーザー: admin
# パスワード: 上記で取得したパスワード

# CLI ログイン
argocd login localhost:8080
```

## 📦 Step 1: 最初のアプリケーション作成

### Gitリポジトリ準備
```
my-k8s-apps/
├── apps/
│   └── sample-app/
│       ├── base/
│       │   ├── deployment.yaml
│       │   ├── service.yaml
│       │   └── kustomization.yaml
│       └── overlays/
│           ├── development/
│           └── production/
└── argocd/
    └── applications/
        ├── sample-app-dev.yaml
        └── sample-app-prod.yaml
```

### アプリケーション定義
```yaml
# argocd/applications/sample-app-dev.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sample-app-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  
  # ソースリポジトリ設定
  source:
    repoURL: https://github.com/your-org/my-k8s-apps.git
    targetRevision: HEAD
    path: apps/sample-app/overlays/development
    
  # デプロイ先クラスター設定
  destination:
    server: https://kubernetes.default.svc
    namespace: development
    
  # 同期ポリシー
  syncPolicy:
    automated:
      prune: true      # 不要なリソース削除
      selfHeal: true   # ドリフト自動修正
    syncOptions:
    - CreateNamespace=true  # namespace自動作成
    
    # ヘルスチェック
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas  # レプリカ数の差分は無視
```

### CLIでアプリケーション作成
```bash
# アプリケーション作成
argocd app create sample-app-dev \
  --repo https://github.com/your-org/my-k8s-apps.git \
  --path apps/sample-app/overlays/development \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace development \
  --sync-policy automated \
  --auto-prune \
  --self-heal

# アプリケーション確認
argocd app list
argocd app get sample-app-dev

# 手動同期
argocd app sync sample-app-dev

# 同期状況監視
argocd app wait sample-app-dev
```

## 🔧 Step 2: 高度な設定

### Multi-Source アプリケーション
```yaml
# 複数のソースを統合
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: multi-source-app
spec:
  sources:
  - repoURL: https://github.com/your-org/k8s-manifests.git
    path: apps/backend
    targetRevision: HEAD
  - repoURL: https://github.com/your-org/helm-charts.git
    path: charts/database
    targetRevision: HEAD
    helm:
      valueFiles:
      - values-production.yaml
  - repoURL: https://github.com/your-org/config-repo.git
    path: environments/production
    targetRevision: HEAD
```

### Helm Chart統合
```yaml
# Helm Chart のデプロイ
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: postgresql-app
spec:
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: postgresql
    targetRevision: 12.1.2
    helm:
      values: |
        auth:
          postgresPassword: "secretpassword"
          database: "myapp"
        primary:
          resources:
            requests:
              memory: 256Mi
              cpu: 250m
        metrics:
          enabled: true
```

### App of Apps パターン
```yaml
# 複数アプリケーションの統合管理
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-of-apps
spec:
  source:
    repoURL: https://github.com/your-org/argocd-apps.git
    path: apps
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## 🔐 Step 3: セキュリティとアクセス制御

### RBAC設定
```yaml
# argocd-rbac-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    # 開発チーム権限
    p, role:developer, applications, get, */*, allow
    p, role:developer, applications, sync, development/*, allow
    
    # 運用チーム権限  
    p, role:operator, applications, *, */*, allow
    p, role:operator, clusters, *, *, allow
    
    # ユーザーとロールのバインド
    g, dev-team, role:developer
    g, ops-team, role:operator
```

### SSO統合（例：GitHub）
```yaml
# argocd-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  # GitHub OAuth
  url: https://argocd.example.com
  oidc.config: |
    name: GitHub
    issuer: https://github.com
    clientId: your-github-oauth-app-id
    clientSecret: $oidc.github.clientSecret
    requestedScopes: ["user:email"]
    requestedIDTokenClaims: {"groups": {"essential": true}}
```

## 📊 Step 4: 監視とアラート

### Prometheus統合
```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: argocd-metrics
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-metrics
  endpoints:
  - port: metrics
```

### カスタムヘルスチェック
```yaml
# Health Check 設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
data:
  resource.customizations.health.my-crd: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.phase == "Ready" then
        hs.status = "Healthy"
        hs.message = "Resource is ready"
      else
        hs.status = "Progressing"
        hs.message = "Resource is not ready"
      end
    end
    return hs
```

## 🔄 実践的なワークフロー

### GitOps ワークフロー
```bash
# 1. 開発者がアプリケーションコードを更新
git commit -m "Update application version"
git push origin main

# 2. CI/CDがイメージをビルド・プッシュ
docker build -t myapp:v1.2.3 .
docker push myregistry/myapp:v1.2.3

# 3. マニフェストリポジトリの更新
# kustomization.yaml のイメージタグを更新
git commit -m "Update myapp to v1.2.3"
git push origin main

# 4. ArgoCDが自動的に変更を検出・同期
# （または手動同期）
argocd app sync sample-app-dev
```

### Blue/Green デプロイメント
```yaml
# Blue/Green用のアプリケーション設定
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-blue
spec:
  source:
    path: overlays/blue
    # ... その他の設定
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-green
spec:
  source:
    path: overlays/green
    # ... その他の設定
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. Out of Sync状態が続く
```bash
# 差分の詳細確認
argocd app diff sample-app-dev

# 手動同期強制実行
argocd app sync sample-app-dev --force

# プルーニング実行
argocd app sync sample-app-dev --prune
```

#### 2. Git認証エラー
```bash
# Private リポジトリの認証設定
argocd repo add https://github.com/private/repo.git \
  --username your-username \
  --password your-token

# SSH Key認証
argocd repo add git@github.com:private/repo.git \
  --ssh-private-key-path ~/.ssh/id_rsa
```

#### 3. アプリケーションが削除できない
```bash
# Finalizer削除
kubectl patch app sample-app-dev -n argocd \
  --type json \
  --patch='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

## 📈 本番運用のベストプラクティス

### 1. アプリケーション構成
- **App of Apps**: 関連アプリケーションの統合管理
- **Environment分離**: 環境別のアプリケーション定義
- **Progressive Rollout**: 段階的なロールアウト戦略

### 2. Git構成
- **Separate Repos**: アプリコードとマニフェストの分離
- **Branch Strategy**: 環境別ブランチまたはディレクトリ
- **Review Process**: Pull Requestによるレビュープロセス

### 3. 監視・アラート
- **Sync Status**: 同期状態の監視
- **Health Status**: アプリケーション健全性の監視
- **Notification**: Slack、メール等への通知

## 🎯 AWS ECS経験者向けのポイント

### ECS vs ArgoCD デプロイメント比較

#### ECS CodePipeline
```yaml
# buildspec.yml
version: 0.2
phases:
  build:
    commands:
      - docker build -t $IMAGE_URI .
      - docker push $IMAGE_URI
  post_build:
    commands:
      - aws ecs update-service --service my-service
```

#### ArgoCD GitOps
```yaml
# Gitにコミットするだけ
# ArgoCD が自動的に検出・デプロイ
```

### 移行のポイント
1. **Git中心**: コードとマニフェストをGitで管理
2. **宣言的**: 現在状態ではなく期待状態を定義
3. **自動化**: 手動デプロイから自動同期へ
4. **可視性**: UI での状態確認とロールバック

## ✅ 学習チェックリスト

- [ ] ArgoCDクラスターへのインストール完了
- [ ] 初回ログインとUI確認
- [ ] 基本的なアプリケーション作成・同期
- [ ] Kustomize/Helm統合の理解
- [ ] GitOpsワークフローの実践
- [ ] RBAC・セキュリティ設定の理解
- [ ] トラブルシューティング経験

---

**次のステップ**: ArgoCDの基本を習得したら、[Helm](../helm/)と組み合わせた高度なパッケージ管理や、実際のCI/CDパイプライン統合に挑戦してみましょう。

**AWS ECS経験者向けまとめ**: 
- ArgoCD ≈ CodePipeline + CodeDeploy の代替
- Git中心のワークフローで、より宣言的・自動化されたデプロイ
- UI による可視性と細かな制御が可能
