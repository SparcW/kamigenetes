# Kubernetesセキュリティ完全学習ガイド

## 目次
1. [学習概要と前提知識](#学習概要と前提知識)
2. [AWS ECSからKubernetesセキュリティへの移行視点](#aws-ecsからkubernetesセキュリティへの移行視点)
3. [Kubernetesセキュリティの基本概念](#kubernetesセキュリティの基本概念)
4. [RBAC（Role-Based Access Control）](#rbacRole-based-access-control)
5. [Pod Security Standards](#pod-security-standards)
6. [Network Policies とマイクロセグメンテーション](#network-policies-とマイクロセグメンテーション)
7. [Secrets管理とデータ暗号化](#secrets管理とデータ暗号化)
8. [セキュリティスキャンと脆弱性対策](#セキュリティスキャンと脆弱性対策)
9. [監査・ログ・インシデント対応](#監査ログインシデント対応)
10. [本番運用セキュリティ](#本番運用セキュリティ)

---

## 学習概要と前提知識

### 🎯 学習目標

この包括的なガイドでは、AWS ECS管理者がKubernetesのセキュリティ対策を完全にマスターし、安全なクラスター運用を実現できるようになることを目指します。

**習得スキル**:
- Kubernetesセキュリティモデルの完全理解
- RBAC設計と実装
- Pod Security Standardsの活用
- Network Policiesによるマイクロセグメンテーション
- Secrets管理とデータ保護
- セキュリティ監査と脅威対応

### 📋 前提知識チェックリスト

- [ ] Kubernetesの基本概念（Pod、Service、Deployment、Namespace）
- [ ] kubectl基本操作
- [ ] YAML設定ファイルの理解
- [ ] AWS ECSでのセキュリティ運用経験
- [ ] ネットワークとファイアウォールの基本知識

### 🕐 推定学習時間

- **理論学習**: 6-8時間
- **実践演習**: 16-20時間
- **セキュリティ監査**: 4-6時間
- **総計**: 26-34時間（4-5日間）

---

## AWS ECSからKubernetesセキュリティへの移行視点

### ECSセキュリティとKubernetesの対比

#### AWS ECS でのセキュリティ
```json
{
  "taskDefinition": {
    "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["EC2", "FARGATE"],
    "placementConstraints": [
      {
        "type": "memberOf",
        "expression": "attribute:ecs.instance-type =~ t3.*"
      }
    ]
  },
  "service": {
    "networkConfiguration": {
      "awsvpcConfiguration": {
        "securityGroups": ["sg-12345678"],
        "subnets": ["subnet-12345678"]
      }
    }
  }
}
```

#### Kubernetes での同等実装
```yaml
# ServiceAccount（IAMロール相当）
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/K8sAppRole
---
# SecurityContext（実行権限制御）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: secure-app
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      serviceAccountName: app-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: app
        image: my-secure-app:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# NetworkPolicy（セキュリティグループ相当）
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: secure-app-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: secure-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: database
    ports:
    - protocol: TCP
      port: 5432
```

### 重要な概念マッピング

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| IAM Role | ServiceAccount + RBAC | 権限管理 |
| Security Groups | NetworkPolicy | ネットワークセキュリティ |
| Secrets Manager | Secret + 暗号化 | 機密情報管理 |
| CloudTrail | Audit Logs | 監査ログ |
| GuardDuty | Falco + セキュリティツール | 脅威検知 |
| VPC設定 | Network Policies | ネットワーク分離 |

---

## Kubernetesセキュリティの基本概念

### セキュリティの4つの柱

#### 1. 認証（Authentication）
```yaml
# Certificate-based認証設定例
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTi...
    server: https://k8s-cluster.example.com
  name: secure-cluster
users:
- name: secure-user
  user:
    client-certificate-data: LS0tLS1CRUdJTi...
    client-key-data: LS0tLS1CRUdJTi...
contexts:
- context:
    cluster: secure-cluster
    user: secure-user
    namespace: production
  name: secure-context
current-context: secure-context
```

#### 2. 認可（Authorization）
```yaml
# RBAC設定例
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: app-operator
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-operator-binding
  namespace: production
subjects:
- kind: User
  name: app-developer
  apiGroup: rbac.authorization.k8s.io
- kind: ServiceAccount
  name: app-service-account
  namespace: production
roleRef:
  kind: Role
  name: app-operator
  apiGroup: rbac.authorization.k8s.io
```

#### 3. アドミッション制御（Admission Control）
```yaml
# PodSecurityPolicy（非推奨）の代替 - Pod Security Standards
apiVersion: v1
kind: Namespace
metadata:
  name: restricted-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# OPA Gatekeeper制約例
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredsecuritycontext
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredSecurityContext
      validation:
        type: object
        properties:
          requiredDropCapabilities:
            type: array
            items:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredsecuritycontext
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.securityContext.capabilities.drop
          msg := "コンテナにcapabilities.dropが設定されていません"
        }
```

#### 4. 監査（Auditing）
```yaml
# 監査ポリシー設定
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# 重要なリソースの変更を記録
- level: Metadata
  namespaces: ["production", "staging"]
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
  - group: "apps"
    resources: ["deployments", "statefulsets"]
  omitStages: ["RequestReceived"]

# セキュリティ関連の操作を詳細記録
- level: Request
  users: ["system:serviceaccount:kube-system:*"]
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["*"]

# システム全体の概要を記録
- level: Metadata
  omitStages: ["RequestReceived"]
```

---

## RBAC（Role-Based Access Control）

### RBAC設計の基本原則

#### 最小権限の原則
```yaml
# 悪い例：過度な権限付与
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: bad-developer-role
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]  # すべての操作を許可（危険）

---
# 良い例：必要最小限の権限
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: good-developer-role
rules:
# アプリケーションの管理のみ
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
# ログの閲覧のみ
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get", "list"]
# Secretの作成・更新は不可、参照のみ
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
```

#### 組織別RBAC設計パターン

```yaml
# 開発チーム用Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: team-alpha-dev
  name: developer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "persistentvolumeclaims"]
  verbs: ["*"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "statefulsets"]
  verbs: ["*"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]  # Secretは読み取りのみ
---
# SREチーム用ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: sre-operator
rules:
# 全NamespaceのPodとServiceの管理
- apiGroups: [""]
  resources: ["pods", "services", "nodes"]
  verbs: ["get", "list", "watch", "delete"]
# モニタリング関連
- apiGroups: ["metrics.k8s.io"]
  resources: ["*"]
  verbs: ["get", "list"]
# ログの確認
- apiGroups: [""]
  resources: ["pods/log", "pods/exec"]
  verbs: ["get", "list", "create"]
---
# セキュリティチーム用監査Role
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: security-auditor
rules:
# 設定の確認（変更不可）
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
# RBAC設定の確認
- apiGroups: ["rbac.authorization.k8s.io"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
```

#### ServiceAccount ベストプラクティス

```yaml
# アプリケーション専用ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-service-account
  namespace: production
  labels:
    app: payment-service
    team: backend
  annotations:
    # AWS EKSでのIAM連携
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/PaymentServiceRole
automountServiceAccountToken: false  # 不要な場合は無効化
---
# 必要最小限の権限設定
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: payment-service-role
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["payment-config"]  # 特定のConfigMapのみ
  verbs: ["get"]
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["payment-secrets"]  # 特定のSecretのみ
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: payment-service-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: payment-service-account
  namespace: production
roleRef:
  kind: Role
  name: payment-service-role
  apiGroup: rbac.authorization.k8s.io
```

---

## Pod Security Standards

### Pod Security Standardsの3つのレベル

#### 1. Privileged レベル（制限なし）
```yaml
# 特権コンテナが必要な場合（システムレベルツール）
apiVersion: v1
kind: Namespace
metadata:
  name: system-tools
  labels:
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/audit: privileged
    pod-security.kubernetes.io/warn: privileged
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: system-tools
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:latest
        securityContext:
          privileged: true  # 特権モードが必要
        volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: sys
          mountPath: /host/sys
          readOnly: true
      volumes:
      - name: proc
        hostPath:
          path: /proc
      - name: sys
        hostPath:
          path: /sys
```

#### 2. Baseline レベル（基本的な制限）
```yaml
# 一般的なアプリケーション用
apiVersion: v1
kind: Namespace
metadata:
  name: applications
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: baseline
    pod-security.kubernetes.io/warn: baseline
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: applications
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        supplementalGroups: [2000]
      containers:
      - name: app
        image: nginx:alpine
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE  # ポート80,443バインドに必要
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
```

#### 3. Restricted レベル（最高レベルの制限）
```yaml
# 高セキュリティ環境用
apiVersion: v1
kind: Namespace
metadata:
  name: secure-zone
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-api
  namespace: secure-zone
spec:
  replicas: 3
  selector:
    matchLabels:
      app: secure-api
  template:
    metadata:
      labels:
        app: secure-api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: api
        image: my-secure-api:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: var-run
          mountPath: /var/run
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "200m"
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: var-run
        emptyDir: {}
```

### カスタムAdmission Controller

```yaml
# OPA Gatekeeper による追加セキュリティ制約
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresources
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResources
      validation:
        type: object
        properties:
          cpu:
            type: string
          memory:
            type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredresources
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.requests.cpu
          msg := "CPUリクエストが設定されていません"
        }
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.requests.memory
          msg := "メモリリクエストが設定されていません"
        }
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.cpu
          msg := "CPU制限が設定されていません"
        }
---
# 制約の適用
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResources
metadata:
  name: must-have-resources
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    excludedNamespaces: ["kube-system", "gatekeeper-system"]
  parameters:
    cpu: "100m"
    memory: "128Mi"
```

---

## Network Policies とマイクロセグメンテーション

### デフォルト拒否ポリシー

```yaml
# すべての通信を拒否（ホワイトリスト方式）
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
# 明示的に必要な通信のみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-to-api-only
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web-frontend
    ports:
    - protocol: TCP
      port: 8080
```

### 3層アーキテクチャの Network Policy

```yaml
# フロントエンド層：外部からのアクセスのみ許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from: []  # 外部からのアクセス許可
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - protocol: TCP
      port: 8080
  # DNS解決とHTTPS通信を許可
  - to: []
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 443
---
# バックエンド層：フロントエンドからのアクセスのみ
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          tier: database
    ports:
    - protocol: TCP
      port: 5432
  # DNS解決を許可
  - to: []
    ports:
    - protocol: UDP
      port: 53
---
# データベース層：バックエンドからのアクセスのみ
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: database
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
    ports:
    - protocol: TCP
      port: 5432
  egress:
  # DNS解決のみ許可
  - to: []
    ports:
    - protocol: UDP
      port: 53
```

### 名前空間間の分離

```yaml
# 本番環境の分離
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: production-isolation
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # 同じ名前空間からのアクセスのみ許可
  - from:
    - namespaceSelector:
        matchLabels:
          name: production
  # Ingress Controllerからのアクセス許可
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  egress:
  # 同じ名前空間内の通信
  - to:
    - namespaceSelector:
        matchLabels:
          name: production
  # 外部API呼び出し（HTTPS）
  - to: []
    ports:
    - protocol: TCP
      port: 443
  # DNS解決
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
---
# モニタリング用アクセス許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-access
  namespace: production
spec:
  podSelector:
    matchLabels:
      monitoring: enabled
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090  # Prometheusメトリクス
```

---

## Secrets管理とデータ暗号化

### Kubernetes Secrets の適切な使用

#### Secret の作成と管理
```yaml
# 基本的なSecret作成
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: production
  labels:
    app: database
type: Opaque
data:
  # base64エンコード済み
  username: cG9zdGdyZXM=
  password: c3VwZXJzZWNyZXRwYXNzd29yZA==
---
# TLS証明書Secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi...  # 証明書
  tls.key: LS0tLS1CRUdJTi...  # 秘密鍵
---
# Docker Registry認証
apiVersion: v1
kind: Secret
metadata:
  name: registry-secret
  namespace: production
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: eyJhdXRocyI6...
```

#### Secretの安全な使用方法
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: secure-app
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      serviceAccountName: secure-app-sa
      containers:
      - name: app
        image: my-app:latest
        # 環境変数としてSecretを使用（推奨しない方法）
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: password
        # Volumeマウント（推奨方法）
        volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
        # TLS証明書のマウント
        - name: tls-volume
          mountPath: /etc/tls
          readOnly: true
      volumes:
      # Secretのボリュームマウント
      - name: secret-volume
        secret:
          secretName: database-credentials
          defaultMode: 0400  # 読み取り専用
      - name: tls-volume
        secret:
          secretName: tls-secret
          defaultMode: 0400
      # イメージ取得用Secret
      imagePullSecrets:
      - name: registry-secret
```

### 暗号化設定

#### etcd暗号化の設定
```yaml
# 暗号化設定ファイル（encryption-config.yaml）
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
        secret: c2VjcmV0IGVuY3J5cHRpb24ga2V5
  - identity: {}  # 暗号化なし（移行時用）
```

#### AWS KMS統合（EKS）
```yaml
# KMS暗号化を使用したSecret
apiVersion: v1
kind: Secret
metadata:
  name: kms-encrypted-secret
  namespace: production
  annotations:
    # KMSキーの指定
    kms.amazonaws.com/key-id: "arn:aws:kms:region:account:key/key-id"
type: Opaque
data:
  sensitive-data: base64-encoded-data
---
# 外部Secrets Operator設定例
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: production
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
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-secret
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: database-credentials
    creationPolicy: Owner
  data:
  - secretKey: password
    remoteRef:
      key: prod/database/postgres
      property: password
```

### Sealed Secrets による GitOps対応

```yaml
# Sealed Secret 作成例
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: sealed-database-secret
  namespace: production
spec:
  encryptedData:
    username: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEQAx...
    password: AgBi7i4OJSWK+PiTySYZZA9rO43cGDEQAx...
  template:
    metadata:
      name: database-secret
      namespace: production
    type: Opaque
```

---

## セキュリティスキャンと脆弱性対策

### コンテナイメージセキュリティ

#### セキュアなDockerfile作成
```dockerfile
# セキュアなDockerfile例
FROM node:16-alpine AS builder

# 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 依存関係の管理
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# アプリケーションコードのコピー
COPY --chown=nextjs:nodejs . .
RUN npm run build

# 本番用イメージ
FROM node:16-alpine AS runner
WORKDIR /app

# セキュリティアップデート
RUN apk --no-cache add dumb-init && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

# 非rootユーザーの作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 必要なファイルのみコピー
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# 非rootユーザーで実行
USER nextjs

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["dumb-init", "node", "server.js"]
```

#### イメージスキャン設定
```yaml
# Trivy でのイメージスキャン Job
apiVersion: batch/v1
kind: Job
metadata:
  name: image-security-scan
  namespace: security
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: trivy
        image: aquasec/trivy:latest
        command:
        - trivy
        args:
        - image
        - --exit-code=1  # 脆弱性発見時は異常終了
        - --severity=HIGH,CRITICAL
        - --no-progress
        - my-app:latest
        volumeMounts:
        - name: trivy-cache
          mountPath: /root/.cache
      volumes:
      - name: trivy-cache
        emptyDir: {}
---
# Falco による実行時セキュリティ監視
apiVersion: v1
kind: ConfigMap
metadata:
  name: falco-config
  namespace: security
data:
  falco.yaml: |
    rules_file:
      - /etc/falco/falco_rules.yaml
      - /etc/falco/k8s_audit_rules.yaml
      - /etc/falco/rules.d
    
    json_output: true
    json_include_output_property: true
    
    # カスタムルール
    - rule: Detect crypto miners
      desc: Detect cryptocurrency miners
      condition: spawned_process and proc.name in (xmrig, cryptonight)
      output: Cryptocurrency miner detected (user=%user.name command=%proc.cmdline container=%container.name)
      priority: CRITICAL
```

### 実行時セキュリティ監視

#### Falco ルール設定
```yaml
# カスタムFalcoルール
apiVersion: v1
kind: ConfigMap
metadata:
  name: custom-falco-rules
  namespace: security
data:
  custom_rules.yaml: |
    - rule: Suspicious File Access
      desc: ファイルシステムへの疑わしいアクセス
      condition: >
        open_read and
        fd.filename startswith /etc/ and
        not proc.name in (systemd, kubelet, dockerd)
      output: >
        Suspicious file access
        (user=%user.name command=%proc.cmdline file=%fd.name container=%container.name)
      priority: WARNING
    
    - rule: Privilege Escalation Attempt
      desc: 権限昇格の試行を検出
      condition: >
        spawned_process and
        proc.name in (sudo, su, doas) and
        container.id != host
      output: >
        Privilege escalation attempt
        (user=%user.name command=%proc.cmdline container=%container.name)
      priority: CRITICAL
    
    - rule: Network Connection to Suspicious Domain
      desc: 疑わしいドメインへの接続
      condition: >
        outbound and
        fd.sip.name contains ".onion" or
        fd.sip.name contains "tor2web"
      output: >
        Connection to suspicious domain
        (command=%proc.cmdline domain=%fd.sip.name container=%container.name)
      priority: HIGH
---
# Falco DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: falco
  namespace: security
spec:
  selector:
    matchLabels:
      app: falco
  template:
    metadata:
      labels:
        app: falco
    spec:
      serviceAccount: falco
      hostNetwork: true
      hostPID: true
      containers:
      - name: falco
        image: falcosecurity/falco:latest
        args:
        - /usr/bin/falco
        - --cri=/run/containerd/containerd.sock
        - --k8s-api=https://kubernetes.default.svc.cluster.local
        securityContext:
          privileged: true
        volumeMounts:
        - name: boot-vol
          mountPath: /host/boot
          readOnly: true
        - name: lib-modules
          mountPath: /host/lib/modules
          readOnly: true
        - name: usr-vol
          mountPath: /host/usr
          readOnly: true
        - name: etc-vol
          mountPath: /host/etc
          readOnly: true
        - name: custom-rules
          mountPath: /etc/falco/rules.d
      volumes:
      - name: boot-vol
        hostPath:
          path: /boot
      - name: lib-modules
        hostPath:
          path: /lib/modules
      - name: usr-vol
        hostPath:
          path: /usr
      - name: etc-vol
        hostPath:
          path: /etc
      - name: custom-rules
        configMap:
          name: custom-falco-rules
```

### セキュリティベンチマーク

#### kube-bench による CIS ベンチマーク
```yaml
# kube-bench Job
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench-master
  namespace: security
spec:
  template:
    spec:
      hostPID: true
      nodeSelector:
        node-role.kubernetes.io/master: ""
      tolerations:
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      restartPolicy: Never
      containers:
      - name: kube-bench
        image: aquasec/kube-bench:latest
        command: ["kube-bench", "master"]
        volumeMounts:
        - name: var-lib-etcd
          mountPath: /var/lib/etcd
          readOnly: true
        - name: etc-kubernetes
          mountPath: /etc/kubernetes
          readOnly: true
      volumes:
      - name: var-lib-etcd
        hostPath:
          path: "/var/lib/etcd"
      - name: etc-kubernetes
        hostPath:
          path: "/etc/kubernetes"
```

---

## 監査・ログ・インシデント対応

### 監査ログ設定

#### 包括的な監査ポリシー
```yaml
# 詳細な監査ポリシー設定
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# セキュリティクリティカルな操作
- level: RequestResponse
  users: ["system:admin"]
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["*"]
  namespaces: ["kube-system", "production"]

# Secret・ConfigMapの操作
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
  omitStages: ["RequestReceived"]

# Pod作成・削除
- level: Request
  resources:
  - group: ""
    resources: ["pods"]
  verbs: ["create", "delete", "update", "patch"]

# ネットワークポリシーの変更
- level: RequestResponse
  resources:
  - group: "networking.k8s.io"
    resources: ["networkpolicies"]

# 失敗したリクエスト
- level: Request
  omitStages: ["RequestReceived"]
  resources:
  - group: ""
    resources: ["*"]
  namespaces: ["production"]
  filter: |
    {
      "verb": {"not": "get"},
      "responseStatus": {"code": {"gte": 400}}
    }

# システムコンポーネントの重要な操作
- level: Metadata
  users: 
  - "system:serviceaccount:kube-system:*"
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["nodes", "services", "endpoints"]
```

### セキュリティイベント監視

#### Prometheus + Alertmanager によるセキュリティアラート
```yaml
# セキュリティメトリクス収集
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: falco-metrics
  namespace: security
spec:
  selector:
    matchLabels:
      app: falco
  endpoints:
  - port: metrics
---
# セキュリティアラートルール
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: security-alerts
  namespace: security
spec:
  groups:
  - name: security.rules
    rules:
    # 権限昇格の検出
    - alert: PrivilegeEscalationDetected
      expr: increase(falco_events_total{rule_name="Privilege Escalation Attempt"}[5m]) > 0
      for: 0m
      labels:
        severity: critical
        category: security
      annotations:
        summary: "権限昇格の試行が検出されました"
        description: "Pod {{ $labels.container_name }} で権限昇格の試行が検出されました"
    
    # 異常なネットワーク通信
    - alert: SuspiciousNetworkActivity
      expr: increase(falco_events_total{rule_name="Network Connection to Suspicious Domain"}[5m]) > 0
      for: 0m
      labels:
        severity: high
        category: security
      annotations:
        summary: "疑わしいネットワーク通信が検出されました"
        description: "{{ $labels.container_name }} から疑わしいドメインへの接続が検出されました"
    
    # 失敗した認証試行
    - alert: AuthenticationFailures
      expr: increase(apiserver_audit_total{verb="create",objectRef_resource="tokenreviews",responseStatus_code=~"4.."}[5m]) > 10
      for: 2m
      labels:
        severity: warning
        category: security
      annotations:
        summary: "認証失敗が多発しています"
        description: "過去5分間で{{ $value }}回の認証失敗が発生しました"
    
    # RBAC権限の変更
    - alert: RBACModification
      expr: increase(apiserver_audit_total{objectRef_apiGroup="rbac.authorization.k8s.io",verb=~"create|update|delete"}[5m]) > 0
      for: 0m
      labels:
        severity: high
        category: security
      annotations:
        summary: "RBAC設定が変更されました"
        description: "ユーザー {{ $labels.user_username }} がRBAC設定を変更しました"
```

### インシデント対応プレイブック

#### 自動対応アクション
```yaml
# 緊急時の自動Pod隔離
apiVersion: batch/v1
kind: Job
metadata:
  name: quarantine-pod
  namespace: security
spec:
  template:
    spec:
      serviceAccountName: incident-responder
      restartPolicy: Never
      containers:
      - name: quarantine
        image: bitnami/kubectl:latest
        command:
        - /bin/bash
        - -c
        - |
          # 感染が疑われるPodを隔離
          POD_NAME="${SUSPICIOUS_POD}"
          NAMESPACE="${POD_NAMESPACE}"
          
          # NetworkPolicyで通信を遮断
          cat <<EOF | kubectl apply -f -
          apiVersion: networking.k8s.io/v1
          kind: NetworkPolicy
          metadata:
            name: quarantine-${POD_NAME}
            namespace: ${NAMESPACE}
          spec:
            podSelector:
              matchLabels:
                quarantine: "${POD_NAME}"
            policyTypes:
            - Ingress
            - Egress
          EOF
          
          # Podにラベルを追加して隔離
          kubectl label pod ${POD_NAME} -n ${NAMESPACE} quarantine=${POD_NAME}
          
          # アラート送信
          curl -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Security Alert: Pod ${POD_NAME} has been quarantined\"}"
        env:
        - name: SUSPICIOUS_POD
          value: "compromised-app-12345"
        - name: POD_NAMESPACE
          value: "production"
        - name: SLACK_WEBHOOK_URL
          valueFrom:
            secretKeyRef:
              name: incident-response-secrets
              key: slack-webhook
---
# インシデント対応用ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: incident-responder
  namespace: security
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: incident-responder
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch", "update", "patch", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies"]
  verbs: ["create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["events"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: incident-responder-binding
subjects:
- kind: ServiceAccount
  name: incident-responder
  namespace: security
roleRef:
  kind: ClusterRole
  name: incident-responder
  apiGroup: rbac.authorization.k8s.io
```

---

## 本番運用セキュリティ

### セキュリティチェックリスト

#### デプロイ前チェックリスト
```yaml
# セキュリティ検証用テンプレート
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-checklist
  namespace: security
data:
  checklist.yaml: |
    security_checks:
      rbac:
        - description: "ServiceAccountが設定されているか"
          check: "spec.serviceAccountName != 'default'"
          severity: "high"
        - description: "最小権限の原則が適用されているか"
          check: "RBAC rules review"
          severity: "critical"
      
      pod_security:
        - description: "非rootユーザーで実行されるか"
          check: "spec.securityContext.runAsNonRoot == true"
          severity: "high"
        - description: "特権モードが無効か"
          check: "spec.containers[].securityContext.privileged != true"
          severity: "critical"
        - description: "読み取り専用ルートファイルシステムか"
          check: "spec.containers[].securityContext.readOnlyRootFilesystem == true"
          severity: "medium"
        - description: "不要なCapabilityが削除されているか"
          check: "spec.containers[].securityContext.capabilities.drop contains 'ALL'"
          severity: "high"
      
      network:
        - description: "NetworkPolicyが設定されているか"
          check: "NetworkPolicy exists in namespace"
          severity: "high"
        - description: "デフォルト拒否ポリシーが適用されているか"
          check: "Default deny NetworkPolicy exists"
          severity: "critical"
      
      secrets:
        - description: "Secretが適切にマウントされているか"
          check: "Secret volumes have mode 0400"
          severity: "medium"
        - description: "不要なSecret自動マウントが無効か"
          check: "automountServiceAccountToken == false"
          severity: "low"
      
      resources:
        - description: "リソース制限が設定されているか"
          check: "resources.limits defined"
          severity: "medium"
        - description: "リソース要求が設定されているか"
          check: "resources.requests defined"
          severity: "medium"
```

#### 継続的セキュリティ監視
```yaml
# セキュリティスキャンCronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: security-scan
  namespace: security
spec:
  schedule: "0 2 * * *"  # 毎日午前2時
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: security-scanner
            image: security-scanner:latest
            command:
            - /bin/bash
            - -c
            - |
              #!/bin/bash
              
              echo "=== Daily Security Scan Starting ==="
              
              # 1. kube-benchでCISベンチマーク実行
              echo "Running CIS Kubernetes Benchmark..."
              kube-bench run --json > /tmp/benchmark-results.json
              
              # 2. 全Podのセキュリティ設定確認
              echo "Checking Pod security configurations..."
              kubectl get pods --all-namespaces -o json | jq -r '
                .items[] |
                select(.spec.securityContext.runAsRoot == true or .spec.securityContext.runAsNonRoot != true) |
                "\(.metadata.namespace)/\(.metadata.name): Running as root"
              ' > /tmp/root-pods.txt
              
              # 3. 過度な権限を持つServiceAccount確認
              echo "Checking for overprivileged ServiceAccounts..."
              kubectl get clusterrolebindings -o json | jq -r '
                .items[] |
                select(.roleRef.name == "cluster-admin") |
                "\(.metadata.name): Has cluster-admin role"
              ' > /tmp/admin-bindings.txt
              
              # 4. NetworkPolicy未適用のNamespace確認
              echo "Checking for namespaces without NetworkPolicies..."
              for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
                if [ $(kubectl get networkpolicy -n $ns --no-headers | wc -l) -eq 0 ]; then
                  echo "$ns: No NetworkPolicy found" >> /tmp/no-netpol.txt
                fi
              done
              
              # 5. 結果をSlackに送信
              REPORT=$(cat <<EOF
              🔒 **Daily Security Scan Report**
              
              **Root Pods Found:**
              $(cat /tmp/root-pods.txt || echo "None")
              
              **Cluster Admin Bindings:**
              $(cat /tmp/admin-bindings.txt || echo "None")
              
              **Namespaces without NetworkPolicy:**
              $(cat /tmp/no-netpol.txt || echo "None")
              EOF
              )
              
              curl -X POST "${SLACK_WEBHOOK_URL}" \
                -H 'Content-type: application/json' \
                --data "{\"text\":\"$REPORT\"}"
              
              echo "=== Security Scan Completed ==="
            env:
            - name: SLACK_WEBHOOK_URL
              valueFrom:
                secretKeyRef:
                  name: security-notifications
                  key: slack-webhook
          serviceAccountName: security-scanner
---
# セキュリティスキャナー用権限
apiVersion: v1
kind: ServiceAccount
metadata:
  name: security-scanner
  namespace: security
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: security-scanner
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: security-scanner-binding
subjects:
- kind: ServiceAccount
  name: security-scanner
  namespace: security
roleRef:
  kind: ClusterRole
  name: security-scanner
  apiGroup: rbac.authorization.k8s.io
```

### 災害復旧とビジネス継続性

#### セキュリティインシデント対応計画
```yaml
# インシデント対応用ツールセット
apiVersion: apps/v1
kind: Deployment
metadata:
  name: incident-response-toolkit
  namespace: security
spec:
  replicas: 1
  selector:
    matchLabels:
      app: incident-response
  template:
    metadata:
      labels:
        app: incident-response
    spec:
      serviceAccountName: incident-responder
      containers:
      - name: toolkit
        image: incident-response:latest
        command: ["/bin/sleep", "infinity"]
        volumeMounts:
        - name: forensics-storage
          mountPath: /forensics
        - name: scripts
          mountPath: /scripts
        env:
        - name: CLUSTER_NAME
          value: "production-cluster"
        - name: INCIDENT_WEBHOOK
          valueFrom:
            secretKeyRef:
              name: incident-response-secrets
              key: webhook-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: forensics-storage
        persistentVolumeClaim:
          claimName: forensics-pvc
      - name: scripts
        configMap:
          name: incident-response-scripts
          defaultMode: 0755
---
# インシデント対応スクリプト
apiVersion: v1
kind: ConfigMap
metadata:
  name: incident-response-scripts
  namespace: security
data:
  isolate-pod.sh: |
    #!/bin/bash
    # Pod緊急隔離スクリプト
    POD_NAME=$1
    NAMESPACE=$2
    
    if [ -z "$POD_NAME" ] || [ -z "$NAMESPACE" ]; then
      echo "Usage: $0 <pod-name> <namespace>"
      exit 1
    fi
    
    echo "Isolating pod $POD_NAME in namespace $NAMESPACE"
    
    # NetworkPolicyで通信遮断
    kubectl apply -f - <<EOF
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata:
      name: isolate-$POD_NAME
      namespace: $NAMESPACE
    spec:
      podSelector:
        matchLabels:
          name: $POD_NAME
      policyTypes:
      - Ingress
      - Egress
    EOF
    
    # ラベル追加
    kubectl label pod $POD_NAME -n $NAMESPACE status=isolated
    
    # 証跡保存
    kubectl describe pod $POD_NAME -n $NAMESPACE > /forensics/pod-$POD_NAME-$(date +%Y%m%d-%H%M%S).txt
    kubectl logs $POD_NAME -n $NAMESPACE --previous > /forensics/logs-$POD_NAME-$(date +%Y%m%d-%H%M%S).txt
    
    echo "Pod $POD_NAME has been isolated and forensics data saved"
  
  collect-evidence.sh: |
    #!/bin/bash
    # 証跡収集スクリプト
    INCIDENT_ID=$1
    
    if [ -z "$INCIDENT_ID" ]; then
      echo "Usage: $0 <incident-id>"
      exit 1
    fi
    
    EVIDENCE_DIR="/forensics/incident-$INCIDENT_ID"
    mkdir -p $EVIDENCE_DIR
    
    echo "Collecting evidence for incident $INCIDENT_ID"
    
    # クラスター状態
    kubectl get all --all-namespaces > $EVIDENCE_DIR/cluster-state.txt
    kubectl get events --all-namespaces --sort-by='.lastTimestamp' > $EVIDENCE_DIR/events.txt
    
    # セキュリティ設定
    kubectl get networkpolicies --all-namespaces -o yaml > $EVIDENCE_DIR/networkpolicies.yaml
    kubectl get rolebindings,clusterrolebindings --all-namespaces -o yaml > $EVIDENCE_DIR/rbac.yaml
    
    # ノード情報
    kubectl describe nodes > $EVIDENCE_DIR/nodes.txt
    
    # 圧縮
    tar -czf /forensics/evidence-$INCIDENT_ID-$(date +%Y%m%d-%H%M%S).tar.gz -C /forensics incident-$INCIDENT_ID
    
    echo "Evidence collected and compressed"
```

### まとめ

このガイドでは、AWS ECS管理者向けにKubernetesでのセキュリティ対策を包括的に学習する内容をお伝えしました。

**主要な学習ポイント**:

1. **多層防御アプローチ**: 認証・認可・ネットワーク・実行時の各レイヤーでのセキュリティ
2. **実践重視**: 実際のセキュリティ脅威に対応できる具体的な設定例
3. **ECS比較**: 既存のAWSセキュリティ知識を活かした移行アプローチ
4. **自動化対応**: CI/CDパイプラインに組み込めるセキュリティチェック
5. **継続監視**: 運用中の脅威検知とインシデント対応

### 🚀 実践的な学習を始めよう

理論の学習が完了したら、ぜひ実際に手を動かして学習を深めてください。

**ハンズオン演習の場所**:
```bash
cd hands-on/k8s-security/
./scripts/setup.sh
```

**段階的な演習内容**:
- **Phase 1**: RBAC設計と実装（90-120分）
- **Phase 2**: Pod Security Standards適用（90-120分）
- **Phase 3**: Network Policies実装（120-150分）
- **Phase 4**: Secrets管理と暗号化（90-120分）
- **Phase 5**: セキュリティスキャンと監視（120-150分）
- **Phase 6**: インシデント対応演習（90-120分）

次のステップとして、実際の環境でこれらのセキュリティ対策を実装し、自社のセキュリティ要件に適用してみてください。継続的なセキュリティ向上により、安全で信頼性の高いKubernetesクラスター運用を実現できるでしょう。
