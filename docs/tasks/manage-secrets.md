# 🔐 Secret管理 - 機密情報の安全な管理

このタスクガイドでは、Kubernetesにおける機密情報の安全な管理方法を解説します。AWS ECS経験者向けに、Secrets ManagerやParameter Storeとの比較を交えながら、Secret、外部シークレット管理、セキュリティベストプラクティスについて実践的に説明します。

## 🎯 対象タスク

- **Secret基本操作**: 作成、更新、削除、ローテーション
- **外部シークレット管理**: AWS Secrets Manager、HashiCorp Vault連携
- **セキュリティ強化**: 暗号化、RBAC、監査
- **ベストプラクティス**: セキュアな運用体制の構築

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | セキュリティのポイント |
|------|---------|------------|---------------|
| **機密情報保存** | Secrets Manager | Secret + 外部連携 | 複数の保存方式を組み合わせ |
| **アクセス制御** | IAM Policies | RBAC | より細かい権限制御 |
| **暗号化** | KMS自動暗号化 | etcd暗号化 + 外部KMS | 多層防御の実装 |
| **ローテーション** | 自動ローテーション | 外部ツール + Operator | ライフサイクル管理の自動化 |

## 🔑 1. Secret の基本操作

### Secret の作成方法

#### 命令的作成

```bash
# リテラル値から作成
kubectl create secret generic app-secrets \
  --from-literal=username=admin \
  --from-literal=password=supersecret \
  --from-literal=api-key=abc123def456

# ファイルから作成
echo -n 'admin' > username.txt
echo -n 'supersecret' > password.txt
kubectl create secret generic app-secrets \
  --from-file=username=username.txt \
  --from-file=password=password.txt

# 環境ファイルから作成
cat > .env << EOF
USERNAME=admin
PASSWORD=supersecret
API_KEY=abc123def456
EOF
kubectl create secret generic app-secrets --from-env-file=.env

# TLS Secretの作成
kubectl create secret tls tls-secret \
  --cert=server.crt \
  --key=server.key

# Docker registry認証の作成
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myemail@example.com
```

#### 宣言的作成

```yaml
# basic-secrets.yaml
# 基本的なSecret
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
  labels:
    app: myapp
    type: credentials
  annotations:
    description: "Application secrets for production environment"
type: Opaque
data:
  # Base64エンコードされた値
  username: YWRtaW4=  # admin
  password: c3VwZXJzZWNyZXQ=  # supersecret
  api-key: YWJjMTIzZGVmNDU2  # abc123def456

stringData:
  # プレーンテキスト（自動的にBase64エンコード）
  database-url: "postgresql://admin:supersecret@postgres:5432/myapp"
  jwt-secret: "my-jwt-secret-key-2023"
---
# TLS Secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: |
    LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t
    # ... certificate content (base64)
    LS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQ==
  tls.key: |
    LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t
    # ... private key content (base64)
    LS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==
---
# Service Account Token Secret
apiVersion: v1
kind: Secret
metadata:
  name: mysecretname
  namespace: production
  annotations:
    kubernetes.io/service-account.name: myserviceaccount
type: kubernetes.io/service-account-token
---
# Docker Config Secret
apiVersion: v1
kind: Secret
metadata:
  name: regcred
  namespace: production
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: |
    ewogICJhdXRocyI6IHsKICAgICJyZWdpc3RyeS5leGFtcGxlLmNvbSI6IHsKICAgICAgInVzZXJuYW1lIjogIm15dXNlciIsCiAgICAgICJwYXNzd29yZCI6ICJteXBhc3N3b3JkIiwKICAgICAgImVtYWlsIjogIm15ZW1haWxAZXhhbXBsZS5jb20iLAogICAgICAiYXV0aCI6ICJiWGwxYzJWeU9tMTVjR0Z6YzNkdmNtUT0iCiAgICB9CiAgfQp9
```

### Secret の使用方法

```yaml
# secret-usage.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-secrets
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: app-with-secrets
  template:
    metadata:
      labels:
        app: app-with-secrets
    spec:
      # Docker registry認証
      imagePullSecrets:
      - name: regcred
      
      containers:
      - name: app
        image: registry.example.com/myapp:latest
        ports:
        - containerPort: 8080
        
        # 方法1: 環境変数として使用
        env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: password
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: api-key
        
        # 方法2: Secret全体を環境変数として使用
        envFrom:
        - secretRef:
            name: app-secrets
        
        # 方法3: ボリュームマウント
        volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
        - name: tls-volume
          mountPath: /etc/tls
          readOnly: true
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      
      volumes:
      # Secret をファイルとしてマウント
      - name: secret-volume
        secret:
          secretName: app-secrets
          defaultMode: 0400  # ファイル権限設定
          items:
          - key: database-url
            path: database.conf
          - key: jwt-secret
            path: jwt.key
      
      # TLS証明書マウント
      - name: tls-volume
        secret:
          secretName: tls-secret
          defaultMode: 0400
```

## 🔒 2. Secret の セキュリティ強化

### RBAC による Secret アクセス制御

```yaml
# secret-rbac.yaml
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: production
---
# Role - 特定のSecretのみアクセス可能
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
  resourceNames: ["app-secrets", "tls-secret"]  # 特定のSecretのみ
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: secret-reader-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: app-service-account
  namespace: production
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
---
# 管理者用ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: secret-admin
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["*"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["*"]
---
# 読み取り専用ユーザー用Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: secret-viewer
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
  # resourceNamesを指定しない場合は全Secret（注意）
```

### etcd 暗号化の設定

```yaml
# encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: c2VjcmV0IGlzIHNlY3VyZQ==  # 32バイトのキー
  - identity: {}  # フォールバック用
```

```bash
# kube-apiserverでの暗号化有効化
kube-apiserver \
  --encryption-provider-config=/etc/kubernetes/encryption-config.yaml \
  # ... other flags
```

### Secret スキャンとポリシー

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted-secrets
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  # Secret ボリュームの制限
  forbiddenSysctls:
    - '*'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## 🔗 3. 外部シークレット管理システム連携

### External Secrets Operator

```yaml
# external-secrets-operator.yaml
# SecretStore (AWS Secrets Manager)
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-west-2
      auth:
        secretRef:
          accessKeyID:
            name: aws-credentials
            key: access-key-id
          secretAccessKey:
            name: aws-credentials
            key: secret-access-key
---
# ExternalSecret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-external-secret
  namespace: production
spec:
  refreshInterval: 5m  # 5分間隔で同期
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-secrets-from-aws
    creationPolicy: Owner
    template:
      type: Opaque
      data:
        username: "{{ .username }}"
        password: "{{ .password }}"
        database-url: "postgresql://{{ .username }}:{{ .password }}@postgres:5432/myapp"
  data:
  - secretKey: username
    remoteRef:
      key: prod/myapp/database
      property: username
  - secretKey: password
    remoteRef:
      key: prod/myapp/database
      property: password
---
# ClusterSecretStore (HashiCorp Vault)
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          secretRef:
            name: vault-token
            key: token
---
# ExternalSecret for Vault
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vault-secret
  namespace: production
spec:
  refreshInterval: 10m
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: vault-app-secrets
    creationPolicy: Owner
  data:
  - secretKey: api-key
    remoteRef:
      key: secret/myapp
      property: api_key
  - secretKey: jwt-secret
    remoteRef:
      key: secret/myapp
      property: jwt_secret
```

### AWS Secrets Manager 直接連携

```yaml
# aws-secret-csi.yaml
# SecretProviderClass
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: app-aws-secrets
  namespace: production
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "prod/myapp/database"
        objectType: "secretsmanager"
        jmesPath:
        - path: "username"
          objectAlias: "db_username"
        - path: "password"
          objectAlias: "db_password"
      - objectName: "prod/myapp/api"
        objectType: "secretsmanager"
        jmesPath:
        - path: "api_key"
          objectAlias: "api_key"
  secretObjects:
  - secretName: aws-secret
    type: Opaque
    data:
    - objectName: "db_username"
      key: username
    - objectName: "db_password"
      key: password
    - objectName: "api_key"
      key: api-key
---
# Pod with CSI Secret Mount
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-csi-secrets
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: app-with-csi-secrets
  template:
    metadata:
      labels:
        app: app-with-csi-secrets
    spec:
      serviceAccountName: aws-secrets-sa
      containers:
      - name: app
        image: myapp:latest
        volumeMounts:
        - name: secrets-store
          mountPath: "/mnt/secrets"
          readOnly: true
        env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: aws-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aws-secret
              key: password
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: app-aws-secrets
```

## 🔄 4. Secret ローテーション

### 自動ローテーション Operator

```yaml
# secret-rotation-operator.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secret-rotator
  namespace: secret-management
spec:
  replicas: 1
  selector:
    matchLabels:
      app: secret-rotator
  template:
    metadata:
      labels:
        app: secret-rotator
    spec:
      containers:
      - name: rotator
        image: secret-rotator:latest
        env:
        - name: ROTATION_INTERVAL
          value: "24h"
        - name: AWS_REGION
          value: "us-west-2"
        volumeMounts:
        - name: config
          mountPath: /etc/config
      volumes:
      - name: config
        configMap:
          name: rotation-config
---
# Rotation Configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: rotation-config
  namespace: secret-management
data:
  rotation-policy.yaml: |
    secrets:
    - name: app-secrets
      namespace: production
      rotationPolicy:
        schedule: "0 2 * * 0"  # 毎週日曜日2時
        source: aws-secrets-manager
        sourceConfig:
          secretName: prod/myapp/database
          autoRotate: true
    - name: tls-secret
      namespace: production
      rotationPolicy:
        schedule: "0 3 1 */3 *"  # 3ヶ月ごと
        source: cert-manager
        sourceConfig:
          issuer: letsencrypt-prod
```

### CronJob による定期ローテーション

```yaml
# secret-rotation-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: secret-rotation
  namespace: production
spec:
  schedule: "0 2 * * 0"  # 毎週日曜日午前2時
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: secret-rotator-sa
          containers:
          - name: rotator
            image: secret-rotator:latest
            command:
            - /bin/bash
            - -c
            - |
              #!/bin/bash
              set -e
              
              echo "Starting secret rotation..."
              
              # AWS Secrets Managerから新しいシークレット取得
              NEW_PASSWORD=$(aws secretsmanager get-random-password \
                --password-length 32 \
                --exclude-characters '"@/\' \
                --output text --query RandomPassword)
              
              # Secrets Managerを更新
              aws secretsmanager update-secret \
                --secret-id prod/myapp/database \
                --secret-string "{\"username\":\"admin\",\"password\":\"$NEW_PASSWORD\"}"
              
              # Kubernetesシークレットを更新
              kubectl create secret generic app-secrets-new \
                --from-literal=username=admin \
                --from-literal=password="$NEW_PASSWORD" \
                --dry-run=client -o yaml | kubectl apply -f -
              
              # ローリング更新でアプリケーションを再起動
              kubectl rollout restart deployment/app-with-secrets
              
              # 古いシークレットのクリーンアップ（必要に応じて）
              echo "Secret rotation completed successfully"
            
            env:
            - name: AWS_REGION
              value: us-west-2
            
            resources:
              requests:
                memory: "64Mi"
                cpu: "50m"
              limits:
                memory: "128Mi"
                cpu: "100m"
          
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
```

## 🛡️ 5. セキュリティ監査と監視

### Secret アクセス監査

```yaml
# secret-audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Secret関連の操作をすべて記録
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]
  namespaces: ["production", "staging"]

# Secret を参照するPodの作成を記録
- level: Request
  resources:
  - group: ""
    resources: ["pods"]
  omitStages:
  - RequestReceived
```

### 監視とアラート

```yaml
# secret-monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: secret-monitoring-rules
  namespace: monitoring
data:
  secret-rules.yaml: |
    groups:
    - name: secret-monitoring
      rules:
      # Secret作成/更新の監視
      - alert: SecretModified
        expr: increase(apiserver_audit_total{objectRef_resource="secrets",verb=~"create|update|patch"}[5m]) > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "Secret has been modified"
          description: "Secret {{ $labels.objectRef_name }} in namespace {{ $labels.objectRef_namespace }} has been modified"
      
      # Secret削除の監視
      - alert: SecretDeleted
        expr: increase(apiserver_audit_total{objectRef_resource="secrets",verb="delete"}[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Secret has been deleted"
          description: "Secret {{ $labels.objectRef_name }} in namespace {{ $labels.objectRef_namespace }} has been deleted"
      
      # 異常なSecret アクセスパターン
      - alert: UnusualSecretAccess
        expr: rate(apiserver_audit_total{objectRef_resource="secrets",verb="get"}[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Unusual secret access pattern detected"
          description: "High rate of secret access detected: {{ $value }} requests per second"
```

## 🧪 実践演習

### 演習1: 基本的なSecret管理

```bash
# Secret作成
kubectl create secret generic my-secret \
  --from-literal=username=admin \
  --from-literal=password=secret123

# Secret確認
kubectl get secrets
kubectl describe secret my-secret

# Secret使用
kubectl create deployment test-app --image=nginx
kubectl set env deployment/test-app --from=secret/my-secret

# 動作確認
kubectl exec -it deployment/test-app -- env | grep -E "(username|password)"
```

### 演習2: 外部シークレット連携

```bash
# External Secrets Operatorのインストール
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# SecretStoreとExternalSecretの適用
kubectl apply -f external-secrets-operator.yaml

# 同期状況の確認
kubectl get externalsecrets -n production
kubectl describe externalsecret app-external-secret -n production
```

### 演習3: Secret ローテーション

```bash
# ローテーション用CronJobの実行
kubectl apply -f secret-rotation-cronjob.yaml

# 手動でのローテーションテスト
kubectl create job --from=cronjob/secret-rotation secret-rotation-manual

# ローテーション結果の確認
kubectl logs job/secret-rotation-manual
kubectl get secrets app-secrets -o yaml
```

## 🎯 ベストプラクティス

### セキュリティ原則

1. **最小権限の原則**
   ```yaml
   # 特定のSecretのみアクセス可能
   rules:
   - apiGroups: [""]
     resources: ["secrets"]
     verbs: ["get"]
     resourceNames: ["app-secrets"]
   ```

2. **Secret分離**
   ```yaml
   # 環境別・用途別のSecret分離
   metadata:
     name: prod-database-secrets  # 環境別
     name: api-auth-secrets       # 用途別
   ```

3. **暗号化の多層化**
   - etcd暗号化
   - 外部KMS使用
   - ネットワーク暗号化

### 運用プラクティス

1. **定期ローテーション**
   - データベースパスワード: 月次
   - API キー: 四半期
   - TLS証明書: 年次

2. **監査ログ**
   ```bash
   # Secret関連のアクセスログ確認
   kubectl logs -n kube-system kube-apiserver-xxx | grep secret
   ```

3. **バックアップ戦略**
   ```bash
   # Secretのバックアップ
   kubectl get secrets --all-namespaces -o yaml > secrets-backup.yaml
   ```

## 🚨 トラブルシューティング

### よくある問題

1. **Secret が読み込めない**
   ```bash
   # RBAC権限確認
   kubectl auth can-i get secrets --as=system:serviceaccount:default:app-sa
   
   # Secret存在確認
   kubectl get secrets -n production
   kubectl describe secret app-secrets -n production
   ```

2. **Base64デコードエラー**
   ```bash
   # Secret値の確認
   kubectl get secret app-secrets -o jsonpath='{.data.password}' | base64 -d
   
   # Secret作成時の文字化け確認
   echo -n 'password' | base64
   ```

3. **外部連携エラー**
   ```bash
   # External Secret状態確認
   kubectl describe externalsecret app-external-secret
   
   # Secret Store接続確認
   kubectl describe secretstore aws-secrets-manager
   ```

## 📚 参考リソース

- **[Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)**
- **[External Secrets Operator](https://external-secrets.io/)**
- **[AWS Secrets Manager CSI Driver](https://docs.aws.amazon.com/secretsmanager/latest/userguide/integrating_csi_driver.html)**
- **[HashiCorp Vault](https://www.vaultproject.io/docs/platform/k8s)**

---

**関連タスク**: [オブジェクト管理](./manage-objects.md) → [アプリケーション実行](./run-applications.md) → [セキュリティ設定](../setup/security-configuration.md)
