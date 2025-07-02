# 🔐 セキュリティ実装 - RBAC、Pod Security、NetworkPolicy

このチュートリアルでは、Kubernetesにおけるセキュリティの実装方法を学習します。AWS ECS経験者向けに、IAMやSecurity Groupsとの比較を交えて、RBAC、Pod Security、NetworkPolicyの実践的な活用法を解説します。

## 🎯 学習目標

- **RBAC**: 役割ベースアクセス制御の実装
- **Pod Security**: Podレベルのセキュリティ強化
- **NetworkPolicy**: ネットワークレベルの分離
- **SecurityContext**: コンテナのセキュリティ設定

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 移行のポイント |
|------|---------|------------|---------------|
| **認証・認可** | IAM Roles/Policies | RBAC | より細かい粒度での制御 |
| **ネットワーク分離** | Security Groups | NetworkPolicy | ポッドレベルでの制御 |
| **コンテナセキュリティ** | Task Role | SecurityContext | 実行時セキュリティの強化 |
| **シークレット管理** | Secrets Manager | Secret + RBAC | アクセス制御の組み合わせ |

## 🔑 1. RBAC（Role-Based Access Control）

### 基本概念

RBACは以下の4つの要素で構成されます：

- **User/ServiceAccount**: 認証されたエンティティ
- **Role/ClusterRole**: 権限の定義
- **RoleBinding/ClusterRoleBinding**: UserとRoleの紐付け

### ServiceAccount の作成

```yaml
# service-accounts.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: production
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-service-account
  namespace: monitoring
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backup-service-account
  namespace: default
```

### Role の定義

```yaml
# roles.yaml
# アプリケーション用Role（Namespace内）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: app-role
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]
---
# 監視用Role（クラスター全体）
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-role
rules:
- apiGroups: [""]
  resources: ["nodes", "pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["nodes", "pods"]
  verbs: ["get", "list"]
---
# バックアップ用Role
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: backup-role
rules:
- apiGroups: [""]
  resources: ["persistentvolumes", "persistentvolumeclaims"]
  verbs: ["get", "list", "create", "delete"]
- apiGroups: ["snapshot.storage.k8s.io"]
  resources: ["volumesnapshots"]
  verbs: ["get", "list", "create", "delete"]
```

### RoleBinding の作成

```yaml
# role-bindings.yaml
# アプリケーション用バインディング
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-role-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: app-service-account
  namespace: production
roleRef:
  kind: Role
  name: app-role
  apiGroup: rbac.authorization.k8s.io
---
# 監視用バインディング
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-role-binding
subjects:
- kind: ServiceAccount
  name: monitoring-service-account
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: monitoring-role
  apiGroup: rbac.authorization.k8s.io
---
# 特定ユーザーへの権限付与
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: development
subjects:
- kind: User
  name: developer@example.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer-role
  apiGroup: rbac.authorization.k8s.io
```

### 実践的なRBACパターン

```yaml
# practical-rbac.yaml
# 開発者用Role（開発環境のフルアクセス）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: developer-role
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
- apiGroups: [""]
  resources: ["persistentvolumes"]
  verbs: [] # PVへのアクセスは制限
---
# 本番運用者用Role（読み取り専用 + 特定操作）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: production
  name: operator-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "patch"] # スケールのみ許可
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: [] # 実行は制限
---
# 監査用Role（読み取り専用）
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: auditor-role
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: [] # Secretへのアクセスは制限
```

## 🛡️ 2. Pod Security

### Pod Security Standards

Kubernetesでは3つのセキュリティレベルを定義：

- **Privileged**: 制限なし
- **Baseline**: 基本的なセキュリティ制限
- **Restricted**: 厳格なセキュリティ制限

### Pod Security Policy の実装

```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted-psp
spec:
  # 特権コンテナを禁止
  privileged: false
  
  # ホストネットワークを禁止
  hostNetwork: false
  hostIPC: false
  hostPID: false
  
  # ボリュームタイプの制限
  volumes:
  - 'configMap'
  - 'emptyDir'
  - 'projected'
  - 'secret'
  - 'downwardAPI'
  - 'persistentVolumeClaim'
  
  # ユーザーID制限
  runAsUser:
    rule: 'MustRunAsNonRoot'
  
  # グループID制限
  runAsGroup:
    rule: 'RunAsAny'
  
  # ファイルシステムグループ制限
  fsGroup:
    rule: 'RunAsAny'
  
  # SELinux制限
  seLinux:
    rule: 'RunAsAny'
  
  # 追加Capabilities制限
  allowedCapabilities: []
  defaultAddCapabilities: []
  requiredDropCapabilities:
  - ALL
  
  # 読み取り専用ルートファイルシステム
  readOnlyRootFilesystem: false
  
  # ホストポートを禁止
  hostPorts:
  - min: 0
    max: 0
```

### SecurityContext の設定

```yaml
# secure-deployment.yaml
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
      
      # Pod レベルのSecurityContext
      securityContext:
        # 非rootユーザーで実行
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 3000
        fsGroup: 2000
        
        # SELinux設定
        seLinuxOptions:
          level: "s0:c123,c456"
      
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        
        # コンテナレベルのSecurityContext
        securityContext:
          # 読み取り専用ルートファイルシステム
          readOnlyRootFilesystem: true
          # 特権昇格の禁止
          allowPrivilegeEscalation: false
          # Capabilities制限
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE
          
          # ユーザー設定
          runAsNonRoot: true
          runAsUser: 1000
        
        # リソース制限
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # ヘルスチェック
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
        
        # 読み取り専用対応のボリューム
        volumeMounts:
        - name: app-config
          mountPath: /app/config
          readOnly: true
        - name: tmp-volume
          mountPath: /tmp
        - name: cache-volume
          mountPath: /app/cache
      
      volumes:
      - name: app-config
        configMap:
          name: app-config
      - name: tmp-volume
        emptyDir: {}
      - name: cache-volume
        emptyDir: {}
```

### Pod Security Admission

```yaml
# namespace-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: secure-namespace
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## 🌐 3. NetworkPolicy

### 基本的なNetworkPolicy

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
# Webアプリケーション用ポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-app-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: web-app
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # ロードバランサーからのアクセス許可
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  
  egress:
  # APIサーバーへのアクセス許可
  - to:
    - podSelector:
        matchLabels:
          app: api-server
    ports:
    - protocol: TCP
      port: 8080
  
  # DNS解決の許可
  - to: []
    ports:
    - protocol: UDP
      port: 53
---
# データベース用ポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  
  ingress:
  # アプリケーションからのみアクセス許可
  - from:
    - podSelector:
        matchLabels:
          app: api-server
    - podSelector:
        matchLabels:
          app: web-app
    ports:
    - protocol: TCP
      port: 5432
```

### 高度なNetworkPolicy パターン

```yaml
# advanced-network-policies.yaml
# 環境間分離ポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: environment-isolation
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  
  ingress:
  # 同一環境からのみアクセス許可
  - from:
    - namespaceSelector:
        matchLabels:
          environment: production
---
# 外部サービスアクセス制限
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: external-access-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Egress
  
  egress:
  # 内部サービスへのアクセス
  - to:
    - podSelector: {}
  
  # 特定外部サービスへのアクセス（例：AWS Services）
  - to: []
    ports:
    - protocol: TCP
      port: 443
    # AWS API endpoints
  
  # DNS解決
  - to: []
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
---
# 監視システム用ポリシー
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-policy
  namespace: monitoring
spec:
  podSelector:
    matchLabels:
      app: prometheus
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # Grafanaからのアクセス許可
  - from:
    - podSelector:
        matchLabels:
          app: grafana
    ports:
    - protocol: TCP
      port: 9090
  
  egress:
  # 全Namespaceのメトリクス収集
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 9090
    - protocol: TCP
      port: 8080
```

## 🔐 4. 包括的なセキュリティ実装

### セキュアなアプリケーションのデプロイ

```yaml
# secure-application-stack.yaml
# Namespace with security labels
apiVersion: v1
kind: Namespace
metadata:
  name: secure-production
  labels:
    environment: production
    security-level: high
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: secure-app-sa
  namespace: secure-production
automountServiceAccountToken: false  # 自動マウント無効化
---
# RBAC Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: secure-production
  name: secure-app-role
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["app-secrets"]  # 特定のSecretのみ
---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: secure-app-binding
  namespace: secure-production
subjects:
- kind: ServiceAccount
  name: secure-app-sa
  namespace: secure-production
roleRef:
  kind: Role
  name: secure-app-role
  apiGroup: rbac.authorization.k8s.io
---
# Deployment with comprehensive security
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-application
  namespace: secure-production
  labels:
    app: secure-application
    security-scan: passed
spec:
  replicas: 3
  selector:
    matchLabels:
      app: secure-application
  template:
    metadata:
      labels:
        app: secure-application
      annotations:
        # セキュリティスキャン結果
        security.scan/timestamp: "2023-01-01T00:00:00Z"
        security.scan/status: "passed"
    spec:
      serviceAccountName: secure-app-sa
      automountServiceAccountToken: false
      
      # Pod security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      
      containers:
      - name: app
        image: secure-app:1.2.3  # 固定バージョン
        ports:
        - containerPort: 8080
          name: http
        
        # Container security context
        securityContext:
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
          runAsNonRoot: true
          runAsUser: 10001
          runAsGroup: 10001
        
        # Resource limits
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
            ephemeral-storage: "1Gi"
          limits:
            memory: "512Mi"
            cpu: "500m"
            ephemeral-storage: "2Gi"
        
        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        # Environment variables
        env:
        - name: APP_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "warn"
        
        # Volume mounts
        volumeMounts:
        - name: app-config
          mountPath: /app/config
          readOnly: true
        - name: tmp-dir
          mountPath: /tmp
        - name: cache-dir
          mountPath: /app/cache
        - name: app-secrets
          mountPath: /app/secrets
          readOnly: true
      
      volumes:
      - name: app-config
        configMap:
          name: secure-app-config
          defaultMode: 0444
      - name: tmp-dir
        emptyDir:
          sizeLimit: "1Gi"
      - name: cache-dir
        emptyDir:
          sizeLimit: "500Mi"
      - name: app-secrets
        secret:
          secretName: secure-app-secrets
          defaultMode: 0400
---
# NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: secure-app-network-policy
  namespace: secure-production
spec:
  podSelector:
    matchLabels:
      app: secure-application
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  
  egress:
  # DNS
  - to: []
    ports:
    - protocol: UDP
      port: 53
  # HTTPS外部通信
  - to: []
    ports:
    - protocol: TCP
      port: 443
```

## 🧪 実践演習

### 演習1: RBAC の実装

1. **開発環境でのRBAC設定**
   ```bash
   # 開発者用ServiceAccount作成
   kubectl create serviceaccount developer-sa -n development
   
   # 開発者用Role作成
   kubectl create role developer-role \
     --verb=get,list,create,update,delete \
     --resource=pods,deployments,services \
     -n development
   
   # RoleBinding作成
   kubectl create rolebinding developer-binding \
     --role=developer-role \
     --serviceaccount=development:developer-sa \
     -n development
   ```

2. **権限の確認**
   ```bash
   # 権限確認
   kubectl auth can-i create pods --as=system:serviceaccount:development:developer-sa -n development
   kubectl auth can-i delete secrets --as=system:serviceaccount:development:developer-sa -n development
   ```

### 演習2: Pod Security の実装

1. **セキュアなPodの作成**
   ```yaml
   # 上記のsecure-deployment.yamlを使用
   kubectl apply -f secure-deployment.yaml
   ```

2. **セキュリティ設定の確認**
   ```bash
   # Pod のセキュリティ設定確認
   kubectl get pod secure-app-xxx -o yaml | grep -A 20 securityContext
   
   # 実行ユーザーの確認
   kubectl exec -it secure-app-xxx -- id
   ```

### 演習3: NetworkPolicy の実装

1. **ネットワーク分離の確認**
   ```bash
   # テスト用Pod作成
   kubectl run test-pod --image=busybox -it --rm -- sh
   
   # 接続テスト（NetworkPolicy適用前後で確認）
   wget -qO- http://secure-app-service:8080/health
   ```

## 🎯 ベストプラクティス

### セキュリティ設計原則

1. **最小権限の原則**
   - 必要最小限の権限のみ付与
   - 定期的な権限の見直し

2. **深層防御**
   - 複数レイヤーでのセキュリティ実装
   - RBAC + NetworkPolicy + Pod Security

3. **セキュリティの継続的改善**
   - 定期的なセキュリティ監査
   - 脆弱性スキャンの自動化

### 運用でのセキュリティ

```yaml
# 継続的セキュリティ監視
apiVersion: batch/v1
kind: CronJob
metadata:
  name: security-audit
spec:
  schedule: "0 2 * * *"  # 毎日2時
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: audit
            image: security-auditor:latest
            command:
            - /bin/sh
            - -c
            - |
              # RBAC権限の監査
              kubectl auth can-i --list --as=system:serviceaccount:default:app-sa
              
              # 脆弱なPodの検出
              kubectl get pods --all-namespaces -o json | jq '.items[] | select(.spec.securityContext.runAsRoot == true)'
              
              # NetworkPolicyの確認
              kubectl get networkpolicy --all-namespaces
          restartPolicy: OnFailure
```

## 🚨 トラブルシューティング

### よくあるセキュリティ問題

1. **RBAC権限エラー**
   ```bash
   # 権限の確認
   kubectl auth can-i create pods --as=system:serviceaccount:default:app-sa
   
   # 現在の権限の一覧
   kubectl auth can-i --list --as=system:serviceaccount:default:app-sa
   ```

2. **Pod起動エラー**
   ```bash
   # セキュリティ関連エラーの確認
   kubectl describe pod failing-pod
   
   # イベントの確認
   kubectl get events --sort-by=.metadata.creationTimestamp
   ```

3. **ネットワーク接続エラー**
   ```bash
   # NetworkPolicyの確認
   kubectl describe networkpolicy -n production
   
   # ネットワーク接続テスト
   kubectl exec -it test-pod -- nc -zv target-service 8080
   ```

## 📚 参考リソース

- **[RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)**
- **[Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)**
- **[Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)**
- **[Security Best Practices](https://kubernetes.io/docs/concepts/security/)**

---

**次のステップ**: [実践タスク](../tasks/) → [ハンズオンラボ](../../hands-on-labs/) → [本番運用](../../hands-on-labs/production/)
