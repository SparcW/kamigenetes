# Phase 4: Secrets管理とデータ保護演習

## 概要

この演習では、Kubernetes Secrets の管理とデータ保護について学習します。AWS ECSのSecrets ManagerやParameter Storeと比較しながら、Kubernetesでの機密データ管理を理解しましょう。

## 学習目標

1. **Kubernetes Secrets**の基本概念と作成方法
2. **etcd暗号化**の設定と確認
3. **外部シークレット管理**ツールとの連携
4. **Secrets のライフサイクル管理**
5. AWS Secrets Manager/Parameter Store との比較理解

## AWS ECS vs Kubernetes Secrets比較

| 機密データ管理 | AWS ECS | Kubernetes |
|---------------|---------|------------|
| 保存場所 | Secrets Manager / Parameter Store | etcd (暗号化) |
| 注入方法 | Task Definition secrets | Volume Mount / Env Var |
| アクセス制御 | IAM Policy | RBAC + ServiceAccount |
| 暗号化 | AWS KMS | etcd encryption at rest |
| ローテーション | 自動ローテーション | 手動 / External Secrets |
| 監査 | CloudTrail | Audit Logs |
| コスト | 使用量課金 | クラスター内無料 |

## Kubernetes Secrets の種類

### 1. Generic Secrets
```yaml
# 一般的な機密データ
apiVersion: v1
kind: Secret
type: Opaque
data:
  username: base64-encoded-value
  password: base64-encoded-value
```

### 2. TLS Secrets
```yaml
# TLS証明書とプライベートキー
apiVersion: v1
kind: Secret
type: kubernetes.io/tls
data:
  tls.crt: base64-encoded-cert
  tls.key: base64-encoded-key
```

### 3. Docker Registry Secrets
```yaml
# コンテナレジストリ認証
apiVersion: v1
kind: Secret
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: base64-encoded-config
```

### 4. Service Account Token Secrets
```yaml
# ServiceAccount トークン
apiVersion: v1
kind: Secret
type: kubernetes.io/service-account-token
```

## 実践演習の流れ

### 1. 基本的なSecrets作成
```bash
kubectl apply -f 01-basic-secrets.yaml
```

### 2. TLS証明書管理
```bash
kubectl apply -f 02-tls-secrets.yaml
```

### 3. アプリケーションでのSecrets使用
```bash
kubectl apply -f 03-app-with-secrets.yaml
```

### 4. 外部シークレット管理
```bash
kubectl apply -f 04-external-secrets.yaml
```

### 5. セキュリティテスト実行
```bash
./test-secrets.sh
```

## 演習シナリオ

### シナリオ: マイクロサービスの機密データ管理

AWS ECSで運用していたマイクロサービスをKubernetesに移行する際の、機密データ管理戦略を学習します。

**管理対象データ:**
- データベース接続情報
- 外部API キー
- TLS証明書
- JWT署名キー
- 暗号化キー

**セキュリティ要件:**
- 機密データの暗号化保存
- アクセス権限の最小化
- 定期的なローテーション
- 監査ログの記録

## Secrets のベストプラクティス

### 1. 作成時のセキュリティ
```bash
# ファイルから作成（履歴に残らない）
kubectl create secret generic app-secrets \
  --from-file=db-password=/path/to/password.txt \
  --from-literal=api-key="$(cat /path/to/api-key.txt)"

# YAML ファイル使用時の注意
# - base64エンコードを忘れずに
# - ファイルの権限を適切に設定 (600)
# - GitリポジトリにCommitしない
```

### 2. 使用時のセキュリティ
```yaml
# Volume Mount（推奨）
volumeMounts:
- name: secret-volume
  mountPath: /etc/secrets
  readOnly: true

# 環境変数（機密度の低いデータのみ）
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-secrets
      key: password
```

### 3. etcd暗号化設定
```yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: base64-encoded-32-byte-key
  - identity: {}
```

### 4. RBAC によるアクセス制御
```yaml
# Secrets読み取り専用Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
  resourceNames: ["app-secrets"]  # 特定のSecretのみ
```

## 外部シークレット管理ツール

### 1. External Secrets Operator
```yaml
# AWS Secrets Manager連携
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
        secretRef:
          accessKeyID:
            name: aws-credentials
            key: access-key-id
          secretAccessKey:
            name: aws-credentials
            key: secret-access-key
```

### 2. HashiCorp Vault
```yaml
# Vault連携
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
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
          role: "app-role"
```

### 3. Azure Key Vault
```yaml
# Azure Key Vault連携
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-keyvault
spec:
  provider:
    azurekv:
      vaultUrl: "https://vault.vault.azure.net"
      authType: ServicePrincipal
      clientId: "client-id"
      clientSecret:
        name: azure-credentials
        key: client-secret
```

## セキュリティ検証

### 1. Secrets暗号化確認
```bash
# etcd内のSecrets確認（暗号化されていることを確認）
kubectl get secrets -o yaml | grep -A 5 -B 5 data:

# etcd直接アクセス（管理者のみ）
ETCDCTL_API=3 etcdctl get /registry/secrets/default/my-secret
```

### 2. アクセス権限テスト
```bash
# 特定のServiceAccountでのSecrets アクセステスト
kubectl auth can-i get secrets \
  --as=system:serviceaccount:default:app-sa

# Pod内からのSecrets アクセステスト
kubectl exec app-pod -- cat /etc/secrets/password
```

### 3. Secrets ローテーション
```bash
# Secretsの更新
kubectl create secret generic app-secrets \
  --from-literal=password=new-password \
  --dry-run=client -o yaml | kubectl apply -f -

# Pod の再起動（Secretsの反映）
kubectl rollout restart deployment/app-deployment
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Base64エンコード/デコードエラー
```bash
# エンコード
echo -n "my-password" | base64

# デコード
echo "bXktcGFzc3dvcmQ=" | base64 -d

# 改行文字に注意
echo -n "password" | base64  # 正しい
echo "password" | base64     # 改行文字が含まれる
```

#### 2. Pod からSecrets が読み取れない
```bash
# Secrets存在確認
kubectl get secrets

# Pod のServiceAccount確認
kubectl get pod <pod-name> -o yaml | grep serviceAccount

# RBAC権限確認
kubectl auth can-i get secrets --as=system:serviceaccount:default:app-sa
```

#### 3. Volume Mount されない
```yaml
# 正しいVolume Mount設定
volumeMounts:
- name: secret-volume
  mountPath: /etc/secrets
  readOnly: true
volumes:
- name: secret-volume
  secret:
    secretName: app-secrets
    defaultMode: 0400  # 読み取り専用
```

## AWS ECS 移行ガイド

### ECS Secrets → K8s Secrets 変換例

#### 1. ECS Task Definition
```json
{
  "secrets": [
    {
      "name": "DB_PASSWORD",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-password"
    }
  ]
}
```

#### 2. Kubernetes Secret + Pod
```yaml
# Secret作成
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
data:
  password: base64-encoded-password

# Pod でのSecret使用
spec:
  containers:
  - name: app
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
```

### 移行時の考慮点
1. **暗号化**: AWS KMS → etcd encryption
2. **アクセス制御**: IAM → RBAC
3. **ローテーション**: 自動 → 手動/External Secrets
4. **監査**: CloudTrail → K8s Audit Logs
5. **統合**: ECS ← → Secrets Manager → External Secrets ← → K8s

## 次のPhase への準備

Phase 4完了後、以下を確認してください：

1. ✅ Kubernetes Secrets の基本操作
2. ✅ セキュアなSecrets 管理方法
3. ✅ AWS Secrets Manager との違いの理解
4. ✅ 外部シークレット管理ツールの連携方法

**次のPhase**: セキュリティスキャンと監査

## 参考資料

- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Encrypting Secret Data at Rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/)
- [External Secrets Operator](https://external-secrets.io/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [HashiCorp Vault](https://www.vaultproject.io/docs/platform/k8s)
