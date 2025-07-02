# Lab 1: ネームスペースとリソース管理

## 概要

このラボでは、Kubernetesのネームスペースの概念と、ConfigMap・Secretを使用した設定管理について学習します。AWS ECS管理者にとって、これらはアプリケーションの論理分離と設定管理の新しいアプローチとなります。

## 学習目標

このラボを完了すると、以下ができるようになります：

- [ ] ネームスペースを作成し、リソースを論理的に分離する
- [ ] リソースクォータを設定してリソース使用量を制御する
- [ ] ConfigMapを使用してアプリケーション設定を管理する
- [ ] Secretを使用して機密情報を安全に管理する
- [ ] ラベルとセレクターを使用してリソースを整理する

## AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes |
|------|---------|------------|
| **論理分離** | タグベースの分離 | Namespace |
| **設定管理** | タスク定義の環境変数 | ConfigMap |
| **機密情報** | Secrets Manager/Parameter Store | Secret |
| **リソース制限** | タスク定義のリソース制限 | ResourceQuota/LimitRange |
| **アクセス制御** | IAMポリシー | RBAC + Namespace |

## 手順

### ステップ 1: ネームスペースの作成

まず、アプリケーション用の専用ネームスペースを作成します。

```bash
# 現在のネームスペース確認
kubectl get namespaces

# マニフェストファイルの確認
cat ../kubernetes/namespace.yaml
```

**namespace.yaml の内容:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sample-app
  labels:
    app: sample-app
    environment: development
    tier: application
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: sample-app-quota
  namespace: sample-app
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.cpu: "4"
    limits.memory: 8Gi
    pods: "10"
    services: "5"
    persistentvolumeclaims: "3"
```

ネームスペースを作成します：

```bash
# ネームスペースの作成
kubectl apply -f ../kubernetes/namespace.yaml

# 作成確認
kubectl get namespaces

# 詳細情報の確認
kubectl describe namespace sample-app

# リソースクォータの確認
kubectl get resourcequota -n sample-app
kubectl describe resourcequota sample-app-quota -n sample-app
```

**AWS ECS管理者向け解説**:
- ECSでは「クラスター」が最上位の論理分離でしたが、Kubernetesでは「ネームスペース」がより細かい分離を提供
- ResourceQuotaはECSのサービス制限に似ていますが、より細かく制御可能

### ステップ 2: ConfigMapの作成

アプリケーションの設定情報をConfigMapで管理します。

```bash
# ConfigMapファイルの確認
cat ../kubernetes/configmap.yaml
```

**configmap.yaml の内容:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: sample-app
  labels:
    app: sample-app
    component: configuration
data:
  # アプリケーション設定
  APP_NAME: "Sample Kubernetes App"
  APP_VERSION: "1.0.0"
  NODE_ENV: "production"
  
  # データベース設定
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "sampledb"
  
  # Redis設定
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  
  # ログ設定
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  
  # 設定ファイル例
  app.properties: |
    database.pool.min=5
    database.pool.max=20
    cache.ttl=3600
    api.rate.limit=1000
```

ConfigMapを作成します：

```bash
# ConfigMapの作成
kubectl apply -f ../kubernetes/configmap.yaml

# 作成確認
kubectl get configmaps -n sample-app

# ConfigMapの内容確認
kubectl describe configmap app-config -n sample-app

# YAMLで内容確認
kubectl get configmap app-config -n sample-app -o yaml
```

**AWS ECS管理者向け解説**:
- ECSのタスク定義内の環境変数設定に相当
- ただし、ConfigMapはコンテナイメージから独立しており、再デプロイ不要で設定変更可能

### ステップ 3: Secretの作成

機密情報をSecretで管理します。

```bash
# Secretファイルの確認
cat ../kubernetes/secrets.yaml
```

**secrets.yaml の内容:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: sample-app
  labels:
    app: sample-app
    component: secrets
type: Opaque
data:
  # Base64エンコードされた値
  DB_USERNAME: cG9zdGdyZXM=  # postgres
  DB_PASSWORD: cGFzc3dvcmQ=  # password
  JWT_SECRET: bXktand0LXNlY3JldC1rZXk=  # my-jwt-secret-key
  API_KEY: YWJjZGVmZ2hpams=  # abcdefghijk
```

Secretを作成します：

```bash
# Secretの作成
kubectl apply -f ../kubernetes/secrets.yaml

# 作成確認
kubectl get secrets -n sample-app

# Secret詳細確認（値は表示されない）
kubectl describe secret app-secrets -n sample-app

# Secret内容の確認（Base64デコード）
kubectl get secret app-secrets -n sample-app -o jsonpath='{.data.DB_USERNAME}' | base64 -d
echo
kubectl get secret app-secrets -n sample-app -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
echo
```

**AWS ECS管理者向け解説**:
- AWS Secrets ManagerやParameter Store（SecureString）に相当
- 値は自動的にBase64エンコードされて保存される
- etcdで暗号化保存される（クラスター設定による）

### ステップ 4: リソースの確認とラベル活用

```bash
# ネームスペース内のすべてのリソース確認
kubectl get all -n sample-app

# ラベルでのフィルタリング
kubectl get all -n sample-app -l app=sample-app

# ConfigMapとSecretの確認
kubectl get configmaps,secrets -n sample-app

# リソースの詳細情報
kubectl describe namespace sample-app

# 現在のリソース使用量確認
kubectl describe resourcequota sample-app-quota -n sample-app
```

### ステップ 5: 実用的な操作コマンド

```bash
# ConfigMapからの環境変数確認
kubectl get configmap app-config -n sample-app -o go-template='{{range $k,$v := .data}}{{printf "%s=%s\n" $k $v}}{{end}}'

# Secretの作成（コマンドライン）
kubectl create secret generic my-secret \
  --from-literal=username=admin \
  --from-literal=password=mypassword \
  -n sample-app

# ファイルからConfigMapを作成
echo "key1=value1" > config.properties
echo "key2=value2" >> config.properties
kubectl create configmap file-config --from-file=config.properties -n sample-app

# 作成したテストリソースの削除
kubectl delete secret my-secret -n sample-app
kubectl delete configmap file-config -n sample-app
rm config.properties
```

## 動作確認

以下のコマンドで正常に作成されていることを確認します：

```bash
# 1. ネームスペースの確認
echo "=== Namespace ==="
kubectl get namespace sample-app

# 2. リソースクォータの確認
echo "=== ResourceQuota ==="
kubectl get resourcequota -n sample-app

# 3. ConfigMapの確認
echo "=== ConfigMap ==="
kubectl get configmap app-config -n sample-app

# 4. Secretの確認
echo "=== Secret ==="
kubectl get secret app-secrets -n sample-app

# 5. すべてのリソース一覧
echo "=== All Resources ==="
kubectl get all,configmaps,secrets -n sample-app
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. ネームスペースが作成できない

```bash
# 権限確認
kubectl auth can-i create namespaces

# 既存ネームスペース確認
kubectl get namespaces | grep sample-app
```

#### 2. ResourceQuotaでリソース作成が拒否される

```bash
# 現在の使用量確認
kubectl describe resourcequota sample-app-quota -n sample-app

# リソース使用量の詳細
kubectl get pods -n sample-app -o custom-columns=NAME:.metadata.name,CPU-REQ:.spec.containers[*].resources.requests.cpu,MEM-REQ:.spec.containers[*].resources.requests.memory
```

#### 3. ConfigMap/Secretが読み込めない

```bash
# 権限確認
kubectl auth can-i get configmaps -n sample-app
kubectl auth can-i get secrets -n sample-app

# リソース存在確認
kubectl get configmaps,secrets -n sample-app
```

## 学習ポイント

### AWS ECSからKubernetesへの移行で重要な概念

1. **ネームスペースによる分離**
   - ECS: クラスター + タグによる論理分離
   - K8s: ネームスペースによる強固な分離

2. **設定の外部化**
   - ECS: タスク定義に設定を埋め込み
   - K8s: ConfigMap/Secretで設定を分離

3. **リソース管理**
   - ECS: サービスレベルでのリソース制限
   - K8s: ネームスペースレベルでのクォータ管理

## 次のステップ

このラボで学習した内容：
- ✅ ネームスペースによるリソース分離
- ✅ ConfigMapによる設定管理
- ✅ Secretによる機密情報管理
- ✅ ResourceQuotaによるリソース制御

次は[Lab 2: データベース層のデプロイ](../lab-02-database/README.md)で、永続化ストレージとStatefulSetについて学習します。

## 関連ドキュメント

- [Namespaces概念ガイド](../../../docs/concepts/namespace.md)
- [ConfigMapsとSecrets](../../../docs/concepts/configuration.md)
- [Resource Quotas](../../../docs/concepts/resource-quotas.md)
