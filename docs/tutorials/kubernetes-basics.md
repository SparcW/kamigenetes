# ⚙️ Kubernetes基本操作 - kubectl習得とYAML管理

Hello Kubernetesチュートリアルの次のステップです。kubectl コマンドの効率的な使用方法とYAMLファイルの管理を学習します。

## 🎯 学習目標

このチュートリアルを完了すると、以下ができるようになります：
- kubectl コマンドの効率的な使用
- YAMLファイルの作成と管理
- Kubernetesリソースの操作パターンの理解
- AWS ECS CLIとkubectlの使い分け

## 📋 前提条件

- [Hello Kubernetes](./hello-kubernetes.md) チュートリアル完了
- Kubernetesクラスターが起動済み

## 🔧 kubectl基本操作

### 1.1 リソース操作の基本パターン

```bash
# CRUD操作パターン
kubectl create -f resource.yaml    # 作成（新規のみ）
kubectl apply -f resource.yaml     # 作成・更新
kubectl get <resource-type>        # 一覧表示
kubectl describe <resource-type> <name>  # 詳細表示
kubectl delete -f resource.yaml    # 削除
```

### 1.2 AWS ECS CLI との比較

| 操作 | AWS ECS CLI | kubectl |
|------|-------------|---------|
| タスク定義登録 | `aws ecs register-task-definition` | `kubectl apply -f deployment.yaml` |
| サービス作成 | `aws ecs create-service` | `kubectl apply -f service.yaml` |
| タスク一覧 | `aws ecs list-tasks` | `kubectl get pods` |
| ログ確認 | `aws logs get-log-events` | `kubectl logs` |
| スケーリング | `aws ecs update-service` | `kubectl scale` |

## 📦 Step 1: 様々なリソースタイプの操作

### 1.1 Namespace（ネームスペース）

```bash
# 現在のネームスペース確認
kubectl config view --minify --output 'jsonpath={..namespace}'

# ネームスペース一覧
kubectl get namespaces

# 新しいネームスペース作成
kubectl create namespace my-app

# ネームスペース指定でリソース表示
kubectl get pods -n my-app
kubectl get pods --all-namespaces
```

**AWS ECSとの比較**: ECSのクラスターのような概念で、リソースを論理的に分離

### 1.2 Labels（ラベル）とSelectors

```yaml
# pod-with-labels.yaml
apiVersion: v1
kind: Pod
metadata:
  name: labeled-pod
  labels:
    app: web
    tier: frontend
    version: v1.0
    environment: development
spec:
  containers:
  - name: nginx
    image: nginx:1.21
```

```bash
# ラベル付きPodの作成
kubectl apply -f pod-with-labels.yaml

# ラベルでフィルタリング
kubectl get pods -l app=web
kubectl get pods -l tier=frontend,version=v1.0
kubectl get pods -l environment!=production

# ラベルの表示
kubectl get pods --show-labels

# ラベルの追加・削除
kubectl label pod labeled-pod owner=team-a
kubectl label pod labeled-pod version- # 削除
```

**AWS ECSとの比較**: ECSのタグと同様の機能だが、より強力なセレクション機能

## 🔍 Step 2: YAML ファイル管理のベストプラクティス

### 2.1 リソース定義の分離

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: webapp
  labels:
    environment: development
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: webapp
data:
  database_url: "postgresql://localhost:5432/myapp"
  debug: "true"
  max_connections: "100"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: webapp
type: Opaque
data:
  db_password: cGFzc3dvcmQxMjM=  # base64エンコード
  api_key: YWJjZGVmZ2hpams=
```

### 2.2 マルチリソース管理

```bash
# 複数リソースの一括操作
kubectl apply -f namespace.yaml -f configmap.yaml -f secret.yaml

# ディレクトリ内の全YAMLファイル適用
kubectl apply -f ./manifests/

# 再帰的に適用
kubectl apply -R -f ./k8s-manifests/
```

### 2.3 YAMLファイルの検証

```bash
# YAML構文チェック（適用せずに検証）
kubectl apply -f deployment.yaml --dry-run=client -o yaml

# サーバーサイドでの検証
kubectl apply -f deployment.yaml --dry-run=server

# YAMLの差分確認
kubectl diff -f deployment.yaml
```

## 🛠️ Step 3: 効率的なkubectl操作

### 3.1 ショートハンドとエイリアス

```bash
# リソースタイプのショートハンド
kubectl get po          # pods
kubectl get svc         # services  
kubectl get deploy      # deployments
kubectl get ns          # namespaces
kubectl get cm          # configmaps

# kubectlのエイリアス設定（.bashrcや.zshrcに追加）
alias k=kubectl
alias kgp='kubectl get pods'
alias kgs='kubectl get services'
alias kgd='kubectl get deployments'
```

### 3.2 出力フォーマットのカスタマイズ

```bash
# JSON出力
kubectl get pod labeled-pod -o json

# YAML出力
kubectl get pod labeled-pod -o yaml

# カスタムカラム表示
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# JSONPath での特定フィールド抽出
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# ワイド表示（詳細情報）
kubectl get pods -o wide
```

### 3.3 ログとデバッグ

```bash
# リアルタイムログ監視
kubectl logs -f labeled-pod

# 前のコンテナのログ（再起動後）
kubectl logs labeled-pod --previous

# 複数行のログ出力
kubectl logs labeled-pod --tail=50

# タイムスタンプ付きログ
kubectl logs labeled-pod --timestamps=true

# マルチコンテナPodの特定コンテナログ
kubectl logs labeled-pod -c container-name
```

## 📊 Step 4: リソース監視と管理

### 4.1 リアルタイム監視

```bash
# Pod状態の監視
kubectl get pods -w

# 全ネームスペースの監視
kubectl get pods --all-namespaces -w

# イベントの監視
kubectl get events -w

# リソース使用量の確認
kubectl top nodes
kubectl top pods
```

### 4.2 トラブルシューティング

```bash
# Pod の詳細な状態確認
kubectl describe pod labeled-pod

# イベントの確認
kubectl get events --sort-by=.metadata.creationTimestamp

# リソースの依存関係確認
kubectl get all -l app=web

# ネットワーク疎通テスト用Pod作成
kubectl run debug-pod --image=busybox:1.35 --rm -it --restart=Never -- sh
```

## 🔧 実践演習

### 演習 1: マルチコンテナPodの作成

```yaml
# multi-container-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-app
  labels:
    app: multi-app
spec:
  containers:
  - name: web-server
    image: nginx:1.21
    ports:
    - containerPort: 80
    volumeMounts:
    - name: shared-data
      mountPath: /usr/share/nginx/html
  - name: data-generator
    image: busybox:1.35
    command: ['sh', '-c']
    args:
    - while true; do
        echo "Current time: $(date)" > /data/index.html;
        sleep 30;
      done
    volumeMounts:
    - name: shared-data
      mountPath: /data
  volumes:
  - name: shared-data
    emptyDir: {}
```

```bash
# Podの作成
kubectl apply -f multi-container-pod.yaml

# 各コンテナのログ確認
kubectl logs multi-container-app -c web-server
kubectl logs multi-container-app -c data-generator

# Webサーバーへのアクセステスト
kubectl port-forward multi-container-app 8080:80
```

### 演習 2: ConfigMapとSecretの活用

```yaml
# app-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.properties: |
    server.port=8080
    database.host=db.example.com
    database.port=5432
    debug.enabled=true
  nginx.conf: |
    server {
        listen 80;
        location / {
            proxy_pass http://backend:3000;
        }
    }
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:  # base64エンコード不要
  database.username: admin
  database.password: secret123
  api.key: abcdef123456
---
apiVersion: v1
kind: Pod
metadata:
  name: configured-app
spec:
  containers:
  - name: app
    image: nginx:1.21
    env:
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: database.host
    - name: DB_USER
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: database.username
    - name: DB_PASS
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: database.password
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config
    - name: secret-volume
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: config-volume
    configMap:
      name: app-config
  - name: secret-volume
    secret:
      secretName: app-secrets
```

## 📚 学習チェック

以下の項目をすべて実行できたかチェックしてください：

- [ ] kubectl create と apply の違いを理解した
- [ ] ラベルとセレクターを使用できた
- [ ] 複数のYAMLファイルを一括操作できた
- [ ] --dry-run でYAMLの検証ができた
- [ ] ショートハンドコマンドを使用できた
- [ ] ログとイベントを確認できた
- [ ] ConfigMapとSecretを作成・使用できた
- [ ] マルチコンテナPodを作成できた

## 🎯 理解度クイズ

1. `kubectl apply` と `kubectl create` の主な違いは何ですか？
2. ラベルセレクター `-l app=web,tier!=database` の意味は？
3. ConfigMapとSecretの使い分け基準は何ですか？

<details>
<summary>答えを見る</summary>

1. **apply**は宣言的で更新可能、**create**は命令的で新規作成のみ
2. **app=web かつ tier≠database のリソースを選択**
3. **ConfigMap**は非機密設定、**Secret**は機密情報（パスワード、APIキーなど）

</details>

## 🚀 次のステップ

Kubernetes基本操作の習得お疲れさまでした！

次は **[ステートレスアプリケーション](./stateless-application.md)** で、実際のWebアプリケーションをDeploymentとServiceでデプロイする方法を学習しましょう。

---

**AWS ECS経験者向けポイント**:
- kubectl ≈ AWS CLI だが、より宣言的なアプローチ
- ラベル ≈ ECS Tags だが、より強力な選択機能
- ConfigMap/Secret ≈ Parameter Store/Secrets Manager だが、YAML内で直接参照可能
