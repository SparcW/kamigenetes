# ⚙️ 設定管理 (Configuration Management)

このガイドでは、Kubernetesにおけるアプリケーション設定と機密情報の管理方法について学習します。AWS ECSでのParameter StoreやSecrets Managerとの比較を通じて、Kubernetesの設定管理を理解します。

## 🎯 学習目標

- ConfigMapとSecretの理解と使い分け
- 環境変数とボリュームマウントによる設定注入
- AWS ECSでの設定管理との対応関係
- セキュアな設定管理のベストプラクティス

## 📚 設定管理の基本概念

### 🔍 設定の分離が重要な理由

```mermaid
graph TD
    A[アプリケーションコード] --> B[設定データ]
    B --> C[機密情報]
    B --> D[非機密設定]
    
    C --> E[Secret]
    D --> F[ConfigMap]
    
    E --> G[環境変数]
    E --> H[ボリュームマウント]
    F --> G
    F --> H
```

**Twelve-Factor Appの原則**:
- 設定をコードから分離
- 環境ごとの設定変更を容易に
- セキュリティの向上

## 📋 ConfigMap: 非機密設定データ

### 🔧 ConfigMapとは

**定義**: アプリケーションの設定データをKey-Value形式で保存するKubernetesオブジェクト

### 📝 ConfigMap作成方法

#### 1. YAML定義による作成

```yaml
# config-web-app.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-app-config
  namespace: production
data:
  # キー値ペア
  database_host: "postgresql.database.svc.cluster.local"
  database_port: "5432"
  redis_host: "redis.cache.svc.cluster.local"
  redis_port: "6379"
  log_level: "INFO"
  
  # 設定ファイル全体
  app.properties: |
    server.port=8080
    server.tomcat.max-threads=200
    spring.profiles.active=production
    
  nginx.conf: |
    upstream backend {
        server app:8080;
    }
    
    server {
        listen 80;
        location / {
            proxy_pass http://backend;
        }
    }
```

#### 2. kubectlコマンドによる作成

```bash
# 直接的な値から作成
kubectl create configmap database-config \
  --from-literal=DB_HOST=postgresql.example.com \
  --from-literal=DB_PORT=5432 \
  --from-literal=DB_NAME=myapp

# ファイルから作成
kubectl create configmap app-config \
  --from-file=app.properties \
  --from-file=nginx.conf

# ディレクトリから一括作成
kubectl create configmap config-files \
  --from-file=./config-directory/
```

### 🔄 ConfigMapの使用方法

#### 1. 環境変数として注入

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: web-app
        image: myapp:latest
        env:
        # 個別の値を環境変数として設定
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: web-app-config
              key: database_host
        
        # ConfigMap全体を環境変数として設定
        envFrom:
        - configMapRef:
            name: web-app-config
```

#### 2. ボリュームマウントとして注入

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: web-app
        image: myapp:latest
        volumeMounts:
        # 設定ファイルをマウント
        - name: config-volume
          mountPath: /etc/config
        # 特定のキーのみマウント
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
      
      volumes:
      # ConfigMap全体をボリュームとして
      - name: config-volume
        configMap:
          name: web-app-config
      
      # 特定のキーのみをボリュームとして
      - name: nginx-config
        configMap:
          name: web-app-config
          items:
          - key: nginx.conf
            path: nginx.conf
```

## 🔐 Secret: 機密情報管理

### 🔧 Secretとは

**定義**: パスワード、トークン、キーなどの機密情報を安全に保存するKubernetesオブジェクト

**特徴**:
- Base64エンコード（暗号化ではない）
- etcdでの保存時暗号化が可能
- 限定的なアクセス制御

### 📝 Secret作成方法

#### 1. YAML定義による作成

```yaml
# secret-database.yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-secret
  namespace: production
type: Opaque
data:
  # Base64エンコードした値
  username: YWRtaW4=  # admin
  password: UGFzc3dvcmQxMjM=  # Password123
  
stringData:
  # プレーンテキスト（自動的にBase64エンコード）
  database-url: "postgresql://admin:Password123@postgresql:5432/myapp"
```

#### 2. kubectlコマンドによる作成

```bash
# 直接的な値から作成
kubectl create secret generic database-credentials \
  --from-literal=username=admin \
  --from-literal=password=Password123

# ファイルから作成
kubectl create secret generic ssl-certs \
  --from-file=tls.crt=./certificates/tls.crt \
  --from-file=tls.key=./certificates/tls.key

# Docker registry認証情報
kubectl create secret docker-registry registry-secret \
  --docker-server=myregistry.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myemail@example.com
```

### 🔄 Secretの使用方法

#### 1. 環境変数として注入

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
```

#### 2. ボリュームマウントとして注入

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        volumeMounts:
        - name: db-secrets
          mountPath: /etc/secrets
          readOnly: true
      
      volumes:
      - name: db-secrets
        secret:
          secretName: database-secret
          defaultMode: 0400  # 読み取り専用
```

#### 3. ImagePullSecretとして使用

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: private-app
spec:
  template:
    spec:
      imagePullSecrets:
      - name: registry-secret
      containers:
      - name: app
        image: myregistry.com/myapp:latest
```

## 🆚 AWS ECS vs Kubernetes 設定管理比較

| 機能 | AWS ECS | Kubernetes | 備考 |
|------|---------|------------|------|
| **非機密設定** | Parameter Store (String) | ConfigMap | 両方とも暗号化なし |
| **機密情報** | Secrets Manager / Parameter Store (SecureString) | Secret | K8sは要追加暗号化 |
| **環境変数注入** | Task Definition | env / envFrom | 同様の仕組み |
| **ファイル注入** | EFS / Parameter Store | Volume Mount | K8sの方が柔軟 |
| **動的更新** | タスク再起動が必要 | 自動反映（条件付き） | K8sで部分的な動的更新 |
| **バージョン管理** | Parameter Store履歴 | Kubernetes履歴 | 両方とも対応 |
| **暗号化** | KMS自動暗号化 | 要設定 | ECSの方が簡単 |
| **アクセス制御** | IAM Policy | RBAC | 両方とも細かく制御可能 |

## 🔧 実践的な設定管理パターン

### 1. 環境別設定管理

```yaml
# 開発環境用ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: development
data:
  environment: "development"
  log_level: "DEBUG"
  database_host: "dev-db.internal"
  redis_replicas: "1"

---
# 本番環境用ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  environment: "production"
  log_level: "ERROR"
  database_host: "prod-db.internal"
  redis_replicas: "3"
```

### 2. 階層的設定管理

```yaml
# ベース設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: base-config
data:
  app_name: "my-web-app"
  version: "1.0.0"
  port: "8080"

---
# 環境固有設定
apiVersion: v1
kind: ConfigMap
metadata:
  name: env-config
data:
  log_level: "INFO"
  database_pool_size: "10"

---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        envFrom:
        - configMapRef:
            name: base-config
        - configMapRef:
            name: env-config
```

### 3. 設定の動的更新

```yaml
# 自動再読み込み対応アプリケーション
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dynamic-config-app
spec:
  template:
    metadata:
      annotations:
        # ConfigMapの変更を検知してPodを再起動
        configmap.reloader.stakater.com/reload: "app-config"
    spec:
      containers:
      - name: app
        image: myapp:latest
        volumeMounts:
        - name: config
          mountPath: /etc/config
        # アプリケーションが設定変更を検知する仕組み
        command: ["/app/server"]
        args: ["--config-watch", "/etc/config"]
      
      volumes:
      - name: config
        configMap:
          name: app-config
```

## 🔒 セキュリティベストプラクティス

### 1. Secretの保護

```yaml
# RBAC設定例
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
  resourceNames: ["database-secret"]  # 特定のSecretのみ

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-secrets
  namespace: production
subjects:
- kind: ServiceAccount
  name: app-service-account
  namespace: production
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### 2. 保存時暗号化（Encryption at Rest）

```yaml
# kube-apiserver設定例
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  - configmaps
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <32-byte key>
  - identity: {}
```

### 3. 外部シークレット管理システム連携

```yaml
# External Secrets Operatorを使用
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: 15s
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: database-secret
    creationPolicy: Owner
  data:
  - secretKey: username
    remoteRef:
      key: prod/database
      property: username
  - secretKey: password
    remoteRef:
      key: prod/database
      property: password
```

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. ConfigMap/Secretが反映されない

```bash
# ConfigMap/Secretの存在確認
kubectl get configmap -n production
kubectl get secret -n production

# 詳細情報の確認
kubectl describe configmap app-config -n production

# Podの環境変数確認
kubectl exec pod-name -- env | grep -i config
```

#### 2. Base64エンコード/デコード

```bash
# エンコード
echo -n "Password123" | base64

# デコード
echo "UGFzc3dvcmQxMjM=" | base64 -d

# Secretの値確認（注意: 本番では実行しない）
kubectl get secret database-secret -o jsonpath='{.data.password}' | base64 -d
```

#### 3. 設定更新の反映確認

```bash
# ConfigMapの更新
kubectl patch configmap app-config -p '{"data":{"log_level":"DEBUG"}}'

# Deploymentのロールアウト
kubectl rollout restart deployment/web-app -n production

# 更新状況の確認
kubectl rollout status deployment/web-app -n production
```

## 🎯 学習チェック

### 理解度確認クイズ

<details>
<summary>Q1: ConfigMapとSecretの主な違いは何ですか？</summary>

**A**: 
- **ConfigMap**: 非機密の設定データ用、Base64エンコードなし
- **Secret**: 機密情報用、Base64エンコード、追加のセキュリティ機能

用途に応じて適切に使い分けることが重要です。
</details>

<details>
<summary>Q2: AWS ECSでParameter Storeを使っていた場合、Kubernetesでは何を使うべきですか？</summary>

**A**: 
- **非機密設定**: ConfigMapを使用
- **機密情報**: Secretを使用
- **外部システム連携**: External Secrets Operatorを使用してAWS Secrets Managerと連携

移行時は設定の性質に応じて適切なKubernetesリソースを選択します。
</details>

<details>
<summary>Q3: 本番環境でSecretを安全に管理するために重要なことは？</summary>

**A**: 
1. **RBAC**: 必要最小限のアクセス権限
2. **保存時暗号化**: etcdレベルでの暗号化設定
3. **外部管理**: AWS Secrets ManagerやHashiCorp Vaultとの連携
4. **監査ログ**: アクセスログの記録と監視
5. **ローテーション**: 定期的なシークレットの更新
</details>

## 🔗 次のステップ

設定管理を理解したら、次は以下を学習してください：

1. **[セキュリティ](./security.md)** - RBACとセキュリティポリシー
2. **[ストレージ](./storage.md)** - 永続化ストレージと設定ファイル管理
3. **[実践チュートリアル](../../tutorials/configuration/)** - 実際の設定管理操作

## 📚 参考資料

- [Kubernetes ConfigMap公式ドキュメント](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Secret公式ドキュメント](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [AWS ECS設定管理ベストプラクティス](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/application.html)

---

**前へ**: [ワークロード](./workloads.md) | **次へ**: [セキュリティ](./security.md)
