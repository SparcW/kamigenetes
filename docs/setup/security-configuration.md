# 🔐 Kubernetesセキュリティ設定ガイド

このガイドでは、AWS ECS経験者向けに、Kubernetesクラスターとアプリケーションのセキュリティ設定について詳しく解説します。RBAC、Pod Security、ネットワークセキュリティ、シークレット管理、イメージセキュリティなどの実装方法を学習します。

## 📋 目次

1. [AWS ECSとの対応関係](#aws-ecsとの対応関係)
2. [セキュリティアーキテクチャ](#セキュリティアーキテクチャ)
3. [RBAC設定](#rbac設定)
4. [Pod Security Standards](#pod-security-standards)
5. [ネットワークセキュリティ](#ネットワークセキュリティ)
6. [シークレット管理](#シークレット管理)
7. [イメージセキュリティ](#イメージセキュリティ)
8. [監査・コンプライアンス](#監査コンプライアンス)
9. [セキュリティ監視](#セキュリティ監視)
10. [実践演習](#実践演習)

## 🔄 AWS ECSとの対応関係

### セキュリティ機能マッピング

| AWS ECS/AWS | Kubernetes | 説明 |
|-------------|------------|------|
| **IAM Roles for Tasks** | **RBAC + Service Accounts** | Pod/コンテナレベルの権限管理 |
| **Security Groups** | **Network Policies** | ネットワークレベルアクセス制御 |
| **ECS Task Role** | **IRSA (IAM Roles for Service Accounts)** | AWS リソースへのアクセス権限 |
| **Parameter Store/Secrets Manager** | **Kubernetes Secrets + External Secrets** | 機密情報管理 |
| **CloudTrail** | **Audit Logs** | API操作ログ・監査 |
| **ECR Image Scanning** | **Admission Controllers + OPA** | コンテナイメージ脆弱性検査 |
| **VPC** | **Network Segmentation** | ネットワーク分離 |
| **AWS Config** | **Open Policy Agent (OPA)** | 設定コンプライアンス |

### セキュリティアプローチの違い

```yaml
# AWS ECS: IAM Role per Task
TaskDefinition:
  TaskRoleArn: arn:aws:iam::123456789012:role/ECSTaskRole
  ContainerDefinitions:
    - Name: my-app
      Image: my-app:latest
      Secrets:
        - Name: DB_PASSWORD
          ValueFrom: arn:aws:secretsmanager:region:account:secret:prod/db/password
```

```yaml
# Kubernetes: RBAC + Service Account + IRSA
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppRole
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      serviceAccountName: my-app-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: my-app
        image: my-app:latest
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
```

## 🏗 セキュリティアーキテクチャ

### 多層防御モデル

```
┌─────────────────────────────────────────────────────────────┐
│                    クラスターセキュリティ                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Ingress     │  │ API Server  │  │ etcd        │        │
│  │ Controller  │  │ (HTTPS/TLS) │  │ (Encrypted) │        │
│  │ (mTLS/TLS)  │  └─────────────┘  └─────────────┘        │
│  └─────────────┘                                           │
│        │                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                ネットワークレイヤー                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │   Ingress   │  │  Service    │  │  Pod-to-Pod │   │  │
│  │  │   Gateway   │  │   Mesh      │  │   Network   │   │  │
│  │  │ (TLS Term.) │  │   (mTLS)    │  │  Policies   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│        │                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Podセキュリティ                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │    RBAC     │  │Pod Security │  │  Security   │   │  │
│  │  │ (API Access)│  │  Standards  │  │  Context    │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│        │                                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                コンテナセキュリティ                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │ Image Scan  │  │  Runtime    │  │  Secrets    │   │  │
│  │  │& Admission  │  │ Protection  │  │ Management  │   │  │
│  │  │ Controller  │  │   (Falco)   │  │(External)   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### セキュリティ原則

1. **最小権限の原則**: 必要最小限の権限のみ付与
2. **深層防御**: 複数のセキュリティ層で保護
3. **ゼロトラスト**: 内部ネットワークでも信頼しない
4. **暗号化**: 保存時・転送時データの暗号化
5. **監査**: すべての操作をログ・監査

## 🔑 RBAC設定

### 1. 基本的なRBAC構成

```yaml
# rbac-basic.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-alpha
---
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: team-alpha-sa
  namespace: team-alpha
---
# Role: 名前空間内の権限定義
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: team-alpha
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "watch", "list"]
- apiGroups: [""]
  resources: ["services", "configmaps"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
---
# RoleBinding: RoleとSubjectの関連付け
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: team-alpha
subjects:
- kind: ServiceAccount
  name: team-alpha-sa
  namespace: team-alpha
- kind: User
  name: alice@mycompany.com
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: team-alpha
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### 2. ClusterRole・ClusterRoleBinding

```yaml
# cluster-rbac.yaml
# ClusterRole: クラスター全体の権限定義
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/status"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]
---
# 開発者用権限
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: developer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses", "networkpolicies"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["namespaces"]
  verbs: ["get", "list"]
  resourceNames: ["development", "staging"]  # 特定名前空間のみ
---
# オペレーター用権限
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-operator
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
- nonResourceURLs: ["/metrics", "/logs"]
  verbs: ["get"]
---
# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: developers
subjects:
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: developer
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cluster-operators
subjects:
- kind: Group
  name: sre-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-operator
  apiGroup: rbac.authorization.k8s.io
```

### 3. 段階的権限管理

```yaml
# progressive-rbac.yaml
# レベル1: 読み取り専用
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: read-only
rules:
- apiGroups: [""]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps", "extensions"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
---
# レベル2: アプリケーション開発者
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: app-developer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list", "create", "update", "patch"]  # delete除外
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["pods/exec", "pods/portforward"]
  verbs: ["create"]
---
# レベル3: インフラ管理者
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: infra-admin
rules:
- apiGroups: [""]
  resources: ["nodes", "persistentvolumes", "namespaces"]
  verbs: ["*"]
- apiGroups: ["storage.k8s.io"]
  resources: ["*"]
  verbs: ["*"]
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies", "ingresses"]
  verbs: ["*"]
```

### 4. IRSA (IAM Roles for Service Accounts)

```yaml
# irsa-setup.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-service-account
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/EKSServiceRole
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aws-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aws-app
  template:
    metadata:
      labels:
        app: aws-app
    spec:
      serviceAccountName: aws-service-account
      containers:
      - name: aws-app
        image: aws-app:latest
        env:
        # AWS SDKが自動的にIRSAトークンを使用
        - name: AWS_REGION
          value: us-west-2
        - name: AWS_DEFAULT_REGION
          value: us-west-2
```

```bash
# IRSA設定コマンド
# 1. IAMロール作成
eksctl create iamserviceaccount \
  --name aws-service-account \
  --namespace production \
  --cluster k8s-production \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --approve

# 2. 権限確認
kubectl describe sa aws-service-account -n production
```

## 🛡 Pod Security Standards

### 1. Pod Security Standards設定

```yaml
# pod-security-namespaces.yaml
# 制限レベル: restricted（最も厳しい）
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# 制限レベル: baseline（基本的なセキュリティ）
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# 制限レベル: privileged（制限なし）
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/audit: baseline
    pod-security.kubernetes.io/warn: baseline
```

### 2. セキュアなPod設定

```yaml
# secure-pod.yaml
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
      annotations:
        container.apparmor.security.beta.kubernetes.io/secure-app: runtime/default
    spec:
      serviceAccountName: secure-app-sa
      securityContext:
        # Pod レベルセキュリティ
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
        seccompProfile:
          type: RuntimeDefault
        supplementalGroups: [1000]
      containers:
      - name: secure-app
        image: secure-app:latest
        securityContext:
          # コンテナレベルセキュリティ
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          runAsGroup: 3000
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE  # ポート80,443バインド用
        resources:
          limits:
            cpu: 500m
            memory: 512Mi
            ephemeral-storage: 1Gi
          requests:
            cpu: 100m
            memory: 128Mi
            ephemeral-storage: 512Mi
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: cache-volume
          mountPath: /app/cache
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: cache-volume
        emptyDir:
          sizeLimit: 100Mi
```

### 3. Security Context詳細設定

```yaml
# security-context-examples.yaml
apiVersion: v1
kind: Pod
metadata:
  name: security-context-demo
spec:
  securityContext:
    # Pod全体のセキュリティ設定
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    fsGroupChangePolicy: "OnRootMismatch"
    seccompProfile:
      type: RuntimeDefault
    seLinuxOptions:
      level: "s0:c123,c456"
    sysctls:
    - name: net.core.somaxconn
      value: "1024"
    supplementalGroups: [1000, 2000]
  containers:
  - name: security-context-demo
    image: alpine:latest
    command: ["sh", "-c", "sleep 3600"]
    securityContext:
      # コンテナ固有のセキュリティ設定
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 2000
      runAsGroup: 3000
      capabilities:
        drop:
        - ALL
        add:
        - NET_ADMIN  # 特定のケースでのみ追加
      seccompProfile:
        type: Localhost
        localhostProfile: my-profiles/audit.json
      seLinuxOptions:
        level: "s0:c123,c456"
    volumeMounts:
    - name: writable-volume
      mountPath: /writable
  volumes:
  - name: writable-volume
    emptyDir: {}
```

## 🌐 ネットワークセキュリティ

### 1. Network Policy基本設定

```yaml
# network-policies.yaml
# デフォルト拒否ポリシー
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
# DNS通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
---
# Web層からAPI層への通信
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: web
    ports:
    - protocol: TCP
      port: 8080
---
# API層からDB層への通信
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-db
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: api
    ports:
    - protocol: TCP
      port: 5432
---
# 外部へのHTTPS通信許可
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-https
  namespace: production
spec:
  podSelector:
    matchLabels:
      external-access: "true"
  policyTypes:
  - Egress
  egress:
  - to: []  # すべての外部IP
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

### 2. 高度なNetwork Policy

```yaml
# advanced-network-policies.yaml
# 時間ベースアクセス制御（カスタムCNI必要）
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: time-based-access
  namespace: production
  annotations:
    policy.cilium.io/time-range: "09:00-17:00"
spec:
  podSelector:
    matchLabels:
      app: business-app
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: office-network
---
# 地理的制限（IPアドレスベース）
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: geo-restriction
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: region-restricted-app
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 203.0.113.0/24  # 日本IPレンジ例
        except:
        - 203.0.113.100/32  # 除外IP
---
# サービスメッシュ統合（Istio）
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: frontend-authz
  namespace: production
spec:
  selector:
    matchLabels:
      app: frontend
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account"]
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
  - when:
    - key: request.headers[authorization]
      values: ["Bearer *"]
```

### 3. セキュアなIngress設定

```yaml
# secure-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  namespace: production
  annotations:
    # SSL/TLS設定
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: letsencrypt-prod
    
    # セキュリティヘッダー
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Strict-Transport-Security: max-age=31536000; includeSubDomains";
      more_set_headers "Content-Security-Policy: default-src 'self'";
    
    # レート制限
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    
    # IP制限
    nginx.ingress.kubernetes.io/whitelist-source-range: "203.0.113.0/24,198.51.100.0/24"
    
    # Basic認証（開発環境）
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
spec:
  tls:
  - hosts:
    - secure.mycompany.com
    secretName: secure-tls-secret
  rules:
  - host: secure.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-app-service
            port:
              number: 80
```

## 🔐 シークレット管理

### 1. Kubernetes Secrets基本

```yaml
# secrets-basic.yaml
# 汎用Secret
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
type: Opaque
data:
  # base64エンコード済み
  database-password: cGFzc3dvcmQxMjM=
  api-key: YWJjZGVmZ2hpams=
stringData:
  # プレーンテキスト（自動でbase64エンコード）
  config.yaml: |
    database:
      host: db.example.com
      port: 5432
      username: myapp
---
# TLS Secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi... # base64エンコード済み証明書
  tls.key: LS0tLS1CRUdJTi... # base64エンコード済み秘密鍵
---
# Docker Registry Secret
apiVersion: v1
kind: Secret
metadata:
  name: registry-secret
  namespace: production
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: eyJhdXRocyI6eyJoYXJib3IubXljb21wYW55LmNvbSI6eyJ1c2VybmFtZSI6ImRlcGxveSIsInBhc3N3b3JkIjoicGFzc3dvcmQiLCJhdXRoIjoiWkdWd2JHOTVPbkJoYzNOM2IzSmsiLCJlbWFpbCI6ImRlcGxveUBteWNvbXBhbnkuY29tIn19fQ==
```

### 2. External Secrets統合

```yaml
# external-secrets.yaml
# External Secrets Operator
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-secrets
  namespace: external-secrets-system
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/ExternalSecretsRole
---
# AWS Secrets Manager統合
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
        serviceAccount:
          name: external-secrets
---
# External Secret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: production
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
  - secretKey: username
    remoteRef:
      key: prod/database/credentials
      property: username
  - secretKey: password
    remoteRef:
      key: prod/database/credentials
      property: password
---
# Vault統合
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.mycompany.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "external-secrets"
          serviceAccountRef:
            name: external-secrets
```

### 3. Secret暗号化・ローテーション

```yaml
# secret-encryption.yaml
# Sealed Secrets
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: sealed-secret-example
  namespace: production
spec:
  encryptedData:
    password: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEQAx...
  template:
    metadata:
      name: secret-example
      namespace: production
    type: Opaque
---
# Secret自動ローテーション
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: auto-rotate-secret
  namespace: production
spec:
  refreshInterval: 1h  # 1時間ごとに更新確認
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: rotating-secret
    creationPolicy: Owner
    deletionPolicy: Retain
  data:
  - secretKey: token
    remoteRef:
      key: prod/rotating-token
      property: current_token
```

### 4. Secret使用ベストプラクティス

```yaml
# secret-best-practices.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
  namespace: production
spec:
  template:
    spec:
      containers:
      - name: app
        image: secure-app:latest
        env:
        # 環境変数として設定
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        # ファイルとしてマウント
        volumeMounts:
        - name: app-secrets
          mountPath: /etc/secrets
          readOnly: true
        - name: tls-certs
          mountPath: /etc/ssl/certs
          readOnly: true
      volumes:
      - name: app-secrets
        secret:
          secretName: app-secrets
          defaultMode: 0400  # 読み取り専用
      - name: tls-certs
        secret:
          secretName: tls-secret
          defaultMode: 0400
          items:
          - key: tls.crt
            path: server.crt
          - key: tls.key
            path: server.key
```

## 🖼 イメージセキュリティ

### 1. イメージスキャン・検証

```yaml
# image-security.yaml
# OPA Gatekeeper制約
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredimagescan
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredImageScan
      validation:
        type: object
        properties:
          scanResults:
            type: array
            items:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredimagescan
        
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not image_has_scan_results(container.image)
          msg := sprintf("Image %v must have security scan results", [container.image])
        }
        
        image_has_scan_results(image) {
          # イメージスキャン結果の検証ロジック
          scan_annotation := input.review.object.metadata.annotations["security.scan/results"]
          scan_annotation != ""
        }
---
# スキャン結果制約
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredImageScan
metadata:
  name: must-have-image-scan
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
  parameters:
    scanResults: ["passed", "low-risk"]
```

### 2. Admission Controller設定

```yaml
# admission-controller.yaml
# イメージポリシー
apiVersion: v1
kind: ConfigMap
metadata:
  name: image-policy
  namespace: kube-system
data:
  policy.yaml: |
    imagePolicy:
      kubeConfigFile: /etc/kubernetes/image-policy-webhook-config
      allowTTL: 50
      denyTTL: 50
      retryBackoff: 500
      defaultAllow: false
---
# Webhook設定
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionWebhook
metadata:
  name: image-policy-webhook
webhooks:
- name: image-policy.example.com
  clientConfig:
    service:
      name: image-policy-webhook
      namespace: image-policy-system
      path: "/validate"
  rules:
  - operations: ["CREATE", "UPDATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  - operations: ["CREATE", "UPDATE"]
    apiGroups: ["apps"]
    apiVersions: ["v1"]
    resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
  admissionReviewVersions: ["v1", "v1beta1"]
```

### 3. Container Runtime Security

```yaml
# runtime-security.yaml
# Falco rules
apiVersion: v1
kind: ConfigMap
metadata:
  name: falco-rules
  namespace: falco-system
data:
  custom_rules.yaml: |
    - rule: Shell in Container
      desc: Notice shell activity within a container
      condition: >
        spawned_process and container and
        (proc.name in (bash, sh, zsh))
      output: >
        Shell spawned in container (user=%user.name container_id=%container.id
        container_name=%container.name shell=%proc.name parent=%proc.pname
        cmdline=%proc.cmdline)
      priority: WARNING
      tags: [container, shell]
    
    - rule: Unexpected Network Activity
      desc: Detect unexpected network connections
      condition: >
        inbound_outbound and container and
        not proc.name in (node, nginx, envoy)
      output: >
        Unexpected network activity (user=%user.name container_id=%container.id
        connection=%fd.name)
      priority: ERROR
      tags: [network, container]
```

### 4. コンテナイメージ最適化

```dockerfile
# Dockerfile - セキュアビルド例
# マルチステージビルド
FROM node:16-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:16-alpine AS runtime
# セキュリティ更新
RUN apk update && apk upgrade && apk add --no-cache dumb-init
# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
# アプリケーションファイル
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .
# セキュリティ設定
USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
# init プロセス使用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

## 📋 監査・コンプライアンス

### 1. 監査ログ設定

```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# 機密情報の完全ログ
- level: RequestResponse
  namespaces: ["production"]
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
  - group: "rbac.authorization.k8s.io"
    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]

# 重要リソースの操作ログ
- level: Request
  namespaces: ["production", "staging"]
  resources:
  - group: "apps"
    resources: ["deployments", "daemonsets", "replicasets", "statefulsets"]
  - group: ""
    resources: ["services", "persistentvolumes", "persistentvolumeclaims"]

# 認証・認可ログ
- level: Metadata
  omitStages:
  - RequestReceived
  resources:
  - group: ""
    resources: ["*"]
  namespaces: ["kube-system", "kube-public", "kube-node-lease"]

# その他のリソース
- level: Request
  omitStages:
  - RequestReceived
  resources:
  - group: ""
    resources: ["*"]
  - group: "admissionregistration.k8s.io"
    resources: ["*"]
  - group: "apiextensions.k8s.io"
    resources: ["*"]
  - group: "apiregistration.k8s.io"
    resources: ["*"]
  - group: "apps"
    resources: ["*"]
  - group: "authentication.k8s.io"
    resources: ["*"]
  - group: "authorization.k8s.io"
    resources: ["*"]
  - group: "autoscaling"
    resources: ["*"]
  - group: "batch"
    resources: ["*"]
  - group: "certificates.k8s.io"
    resources: ["*"]
  - group: "extensions"
    resources: ["*"]
  - group: "metrics.k8s.io"
    resources: ["*"]
  - group: "networking.k8s.io"
    resources: ["*"]
  - group: "policy"
    resources: ["*"]
  - group: "rbac.authorization.k8s.io"
    resources: ["*"]
  - group: "settings.k8s.io"
    resources: ["*"]
  - group: "storage.k8s.io"
    resources: ["*"]
```

### 2. コンプライアンス監視

```yaml
# compliance-monitoring.yaml
# CIS Kubernetes Benchmark
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-bench-config
  namespace: kube-system
data:
  config.yaml: |
    controls:
      groups:
      - id: 1
        text: "Master Node Security Configuration"
        checks:
        - id: 1.1.1
          text: "Ensure that the API server pod specification file permissions are set to 644 or more restrictive"
          audit: "stat -c %a /etc/kubernetes/manifests/kube-apiserver.yaml"
          tests:
            test_items:
            - flag: "644"
              compare:
                op: bitmask
                value: "644"
          remediation: "chmod 644 /etc/kubernetes/manifests/kube-apiserver.yaml"
          scored: true
---
# OPA Gatekeeper コンプライアンス
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        type: object
        properties:
          labels:
            type: array
            items:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels
        
        violation[{"msg": msg}] {
          required := input.parameters.labels
          provided := input.review.object.metadata.labels
          missing := required[_]
          not provided[missing]
          msg := sprintf("Missing required label: %v", [missing])
        }
---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: must-have-compliance-labels
spec:
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
  parameters:
    labels: ["environment", "owner", "cost-center", "compliance-level"]
```

### 3. セキュリティポリシー検証

```yaml
# security-policies.yaml
# Pod Security Policy（非推奨だが参考として）
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted-psp
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
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
---
# OPA Policy代替
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8spodserviceaccount
spec:
  crd:
    spec:
      names:
        kind: K8sPodServiceAccount
      validation:
        type: object
        properties:
          forbiddenServiceAccounts:
            type: array
            items:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8spodserviceaccount
        
        violation[{"msg": msg}] {
          forbidden_sa := input.parameters.forbiddenServiceAccounts[_]
          input.review.object.spec.serviceAccountName == forbidden_sa
          msg := sprintf("ServiceAccount %v is not allowed", [forbidden_sa])
        }
```

## 📊 セキュリティ監視

### 1. セキュリティメトリクス

```yaml
# security-monitoring.yaml
# Prometheus規則
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: security-alerts
  namespace: monitoring
spec:
  groups:
  - name: kubernetes-security
    rules:
    - alert: UnauthorizedAPIAccess
      expr: increase(apiserver_audit_total{objectRef_apiVersion!=""}[5m]) > 100
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "High number of API access attempts detected"
        description: "Unusual API access pattern detected - possible security incident"
    
    - alert: PrivilegedPodRunning
      expr: kube_pod_container_status_running{container=~".*privileged.*"} > 0
      for: 0m
      labels:
        severity: critical
      annotations:
        summary: "Privileged pod detected"
        description: "Pod {{ $labels.pod }} is running with privileged access"
    
    - alert: SecurityPolicyViolation
      expr: increase(gatekeeper_violations_total[5m]) > 0
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Security policy violation detected"
        description: "Gatekeeper policy violation: {{ $labels.kind }}/{{ $labels.name }}"
```

### 2. ログ監視・分析

```yaml
# log-monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-security
  namespace: kube-system
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off

    [INPUT]
        Name              tail
        Path              /var/log/audit/audit.log
        Parser            audit_log
        Tag               kubernetes.audit
        Refresh_Interval  5

    [FILTER]
        Name    grep
        Match   kubernetes.audit
        Regex   verb (create|update|delete|patch)

    [FILTER]
        Name    grep
        Match   kubernetes.audit
        Regex   objectRef.resource (secrets|roles|rolebindings)

    [OUTPUT]
        Name  cloudwatch_logs
        Match kubernetes.audit
        region us-west-2
        log_group_name /aws/eks/security-audit
        log_stream_prefix security-
```

## 🔧 実践演習

### 演習1: RBAC設定と検証

```bash
# 1. 開発者用名前空間・権限作成
kubectl create namespace team-dev

# 2. Service Account作成
kubectl create serviceaccount dev-user -n team-dev

# 3. Role・RoleBinding作成
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: team-dev
  name: developer-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: team-dev
subjects:
- kind: ServiceAccount
  name: dev-user
  namespace: team-dev
roleRef:
  kind: Role
  name: developer-role
  apiGroup: rbac.authorization.k8s.io
EOF

# 4. 権限テスト
kubectl auth can-i get pods --as=system:serviceaccount:team-dev:dev-user -n team-dev
kubectl auth can-i delete secrets --as=system:serviceaccount:team-dev:dev-user -n team-dev
```

### 演習2: Network Policy実装

```bash
# 1. テスト環境構築
kubectl create namespace security-test

# 2. テストアプリケーションデプロイ
kubectl apply -n security-test -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        tier: web
    spec:
      containers:
      - name: frontend
        image: nginx:alpine
        ports:
        - containerPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        tier: api
    spec:
      containers:
      - name: backend
        image: nginx:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 80
EOF

# 3. 通信テスト（Network Policy適用前）
kubectl exec -n security-test deployment/frontend -- wget -qO- backend-service

# 4. Network Policy適用
kubectl apply -n security-test -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: web
    ports:
    - protocol: TCP
      port: 80
EOF

# 5. 通信テスト（Network Policy適用後）
kubectl exec -n security-test deployment/frontend -- wget -qO- backend-service
```

### 演習3: シークレット管理実装

```bash
# 1. External Secrets Operator インストール
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace

# 2. AWS Secrets Manager統合
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: security-test
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-west-2
      auth:
        serviceAccount:
          name: external-secrets-sa
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-config
  namespace: security-test
spec:
  refreshInterval: 5m
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-config-secret
    creationPolicy: Owner
  data:
  - secretKey: database_url
    remoteRef:
      key: test/database/config
      property: connection_string
EOF

# 3. Secret使用確認
kubectl get secret app-config-secret -n security-test -o yaml
```

## 📚 ベストプラクティス

### 1. セキュリティチェックリスト

#### デプロイ前セキュリティ確認
- [ ] イメージスキャン完了・脆弱性なし
- [ ] 非rootユーザーで実行
- [ ] 読み取り専用ルートファイルシステム
- [ ] 最小権限のServiceAccount使用
- [ ] リソース制限設定済み
- [ ] Network Policy適用済み

#### 運用時セキュリティ確認
- [ ] 監査ログが出力されている
- [ ] セキュリティアラートが設定済み
- [ ] 定期的な権限レビュー実施
- [ ] Secret自動ローテーション機能
- [ ] インシデント対応手順確立

### 2. セキュリティ自動化

```yaml
# security-automation.yaml
# セキュリティスキャン自動化
apiVersion: batch/v1
kind: CronJob
metadata:
  name: security-scan
  namespace: security-tools
spec:
  schedule: "0 2 * * *"  # 毎日午前2時
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kube-bench
            image: aquasec/kube-bench:latest
            command:
            - sh
            - -c
            - |
              kube-bench --json > /tmp/results.json
              # 結果をSlack/メール通知
              curl -X POST $SLACK_WEBHOOK -d @/tmp/results.json
          restartPolicy: OnFailure
```

---

**AWS ECS管理者へのアドバイス**: 
Kubernetesのセキュリティは多層防御が基本です。AWS ECSでのIAM Role for Tasksの知識は、KubernetesのRBAC + IRSAの理解に役立ちます。まずは基本的なRBAC設定から始め、段階的にNetwork Policy、Pod Security Standards、シークレット管理を導入していくことをお勧めします。セキュリティは継続的な改善が重要なので、定期的な監査と見直しを行ってください。
