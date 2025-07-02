# 📦 オブジェクト管理 - 宣言的・命令的管理

このタスクガイドでは、Kubernetesオブジェクトの効果的な管理方法を解説します。AWS ECS経験者向けに、宣言的管理と命令的管理の使い分け、GitOpsワークフロー、リソースの更新・削除戦略について実践的に説明します。

## 🎯 対象タスク

- **宣言的管理**: YAMLファイルによるリソース管理
- **命令的管理**: kubectlコマンドによる直接操作
- **リソース更新**: Rolling Update、Blue/Green デプロイ
- **状態管理**: Git連携とバージョン管理

## 📊 AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes | 管理のポイント |
|------|---------|------------|---------------|
| **設定管理** | Task Definition | YAML Manifest | 宣言的な状態管理 |
| **更新方式** | Service Update | kubectl apply | より柔軟な更新戦略 |
| **バージョン管理** | Revision | Git + GitOps | ソースコードとの一元管理 |
| **ロールバック** | Previous Revision | kubectl rollout | 簡単な履歴管理 |

## 📝 1. 宣言的管理の基本

### YAMLマニフェストの基本構造

```yaml
# basic-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  namespace: default
  labels:
    app: sample-app
    version: v1.0.0
    environment: production
  annotations:
    description: "Sample application for demonstrating object management"
    deployment.kubernetes.io/revision: "1"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
        version: v1.0.0
    spec:
      containers:
      - name: app
        image: nginx:1.21
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: sample-app-service
  labels:
    app: sample-app
spec:
  selector:
    app: sample-app
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  type: ClusterIP
```

### 複数リソースの管理

```yaml
# complete-stack.yaml
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: myapp
  labels:
    environment: production
---
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: myapp
data:
  database_url: "postgresql://postgres:5432/myapp"
  cache_ttl: "3600"
  log_level: "info"
---
# Secret
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: myapp
type: Opaque
data:
  username: YWRtaW4=  # admin
  password: cGFzc3dvcmQ=  # password
---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
  namespace: myapp
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: myapp
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

### Kustomization による管理

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# 基本リソース
resources:
- namespace.yaml
- configmap.yaml
- secret.yaml
- deployment.yaml
- service.yaml
- ingress.yaml

# 名前プレフィックス
namePrefix: myapp-

# ラベル追加
commonLabels:
  app: myapp
  version: v1.0.0
  environment: production

# アノテーション追加
commonAnnotations:
  managed-by: kustomize
  
# イメージ置換
images:
- name: myapp
  newTag: v1.2.3

# ConfigMap生成
configMapGenerator:
- name: env-config
  literals:
  - ENVIRONMENT=production
  - DEBUG=false

# Secret生成
secretGenerator:
- name: app-secrets
  literals:
  - DATABASE_PASSWORD=secretpassword
  type: Opaque

# パッチ適用
patches:
- target:
    kind: Deployment
    name: myapp
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 5
```

## ⚡ 2. 命令的管理の活用

### 基本的なkubectlコマンド

```bash
# リソース作成
kubectl create namespace development
kubectl create deployment nginx --image=nginx:1.21
kubectl create service clusterip nginx --tcp=80:80

# リソース取得
kubectl get pods
kubectl get deployments
kubectl get services
kubectl get all

# 詳細情報確認
kubectl describe pod nginx-xxx
kubectl describe deployment nginx
kubectl describe service nginx

# ログ確認
kubectl logs nginx-xxx
kubectl logs -f deployment/nginx
kubectl logs --previous nginx-xxx

# リソース編集
kubectl edit deployment nginx
kubectl edit service nginx

# スケーリング
kubectl scale deployment nginx --replicas=5

# ポートフォワード
kubectl port-forward service/nginx 8080:80
kubectl port-forward pod/nginx-xxx 8080:80

# 実行
kubectl exec -it nginx-xxx -- /bin/bash
kubectl exec nginx-xxx -- ls -la

# ファイルコピー
kubectl cp nginx-xxx:/var/log/nginx/access.log ./access.log
kubectl cp ./config.conf nginx-xxx:/etc/nginx/
```

### 高度なkubectlコマンド

```bash
# JSONPath使用
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get pods -o jsonpath='{.items[*].status.phase}'

# カスタムカラム
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,IP:.status.podIP

# ラベルセレクター
kubectl get pods -l app=nginx
kubectl get pods -l 'environment in (production,staging)'
kubectl get pods -l 'app=nginx,version!=v1.0'

# フィールドセレクター
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector metadata.namespace=default

# 監視
kubectl get pods -w
kubectl get events --sort-by=.metadata.creationTimestamp

# デバッグ
kubectl top pods
kubectl top nodes
kubectl describe node

# パッチ適用
kubectl patch deployment nginx -p '{"spec":{"replicas":3}}'
kubectl patch service nginx -p '{"spec":{"type":"LoadBalancer"}}'

# ドライラン
kubectl apply -f deployment.yaml --dry-run=client
kubectl apply -f deployment.yaml --dry-run=server

# リソース削除
kubectl delete pod nginx-xxx
kubectl delete deployment nginx
kubectl delete -f deployment.yaml
kubectl delete all -l app=nginx
```

## 🔄 3. リソース更新戦略

### Rolling Update

```yaml
# rolling-update-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rolling-update-app
  labels:
    app: rolling-update-app
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 2    # 同時に停止できるPod数
      maxSurge: 2          # 同時に追加できるPod数
  selector:
    matchLabels:
      app: rolling-update-app
  template:
    metadata:
      labels:
        app: rolling-update-app
    spec:
      containers:
      - name: app
        image: myapp:v1.0.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

```bash
# Rolling Updateの実行
kubectl set image deployment/rolling-update-app app=myapp:v1.1.0

# 更新状況の監視
kubectl rollout status deployment/rolling-update-app

# 更新履歴の確認
kubectl rollout history deployment/rolling-update-app

# ロールバック
kubectl rollout undo deployment/rolling-update-app
kubectl rollout undo deployment/rolling-update-app --to-revision=2

# 更新の一時停止・再開
kubectl rollout pause deployment/rolling-update-app
kubectl rollout resume deployment/rolling-update-app
```

### Blue/Green デプロイメント

```yaml
# blue-green-deployment.yaml
# Blue環境（現在稼働中）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  labels:
    app: myapp
    version: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
      - name: app
        image: myapp:v1.0.0
        ports:
        - containerPort: 8080
---
# Green環境（新バージョン）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  labels:
    app: myapp
    version: green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
      - name: app
        image: myapp:v1.1.0
        ports:
        - containerPort: 8080
---
# Service（トラフィック制御）
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
    version: blue  # 最初はblueにトラフィック
  ports:
  - port: 80
    targetPort: 8080
```

```bash
# Blue/Greenデプロイの手順

# 1. Green環境をデプロイ
kubectl apply -f blue-green-deployment.yaml

# 2. Green環境の動作確認
kubectl get pods -l version=green
kubectl port-forward service/myapp-service 8080:80

# 3. トラフィックをGreenに切り替え
kubectl patch service myapp-service -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 動作確認後、Blue環境を削除
kubectl delete deployment myapp-blue
```

### Canary デプロイメント

```yaml
# canary-deployment.yaml
# メイン（安定版）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  labels:
    app: myapp
    version: stable
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
      - name: app
        image: myapp:v1.0.0
        ports:
        - containerPort: 8080
---
# Canary（新バージョン）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  labels:
    app: myapp
    version: canary
spec:
  replicas: 1  # 10%のトラフィック
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
      - name: app
        image: myapp:v1.1.0
        ports:
        - containerPort: 8080
---
# Service（両方のDeploymentにトラフィック分散）
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp  # versionラベルは指定しない
  ports:
  - port: 80
    targetPort: 8080
```

## 🏗️ 4. 高度なオブジェクト管理

### Helm Chart

```yaml
# Chart.yaml
apiVersion: v2
name: myapp
description: A Helm chart for my application
type: application
version: 0.1.0
appVersion: "1.0.0"

dependencies:
- name: postgresql
  version: 11.6.12
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled
```

```yaml
# values.yaml
replicaCount: 3

image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  annotations: {}
  hosts:
  - host: myapp.local
    paths:
    - path: /
      pathType: ImplementationSpecific

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

postgresql:
  enabled: true
  auth:
    postgresPassword: secretpassword
    database: myapp
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "myapp.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.service.targetPort }}
          protocol: TCP
        livenessProbe:
          httpGet:
            path: /
            port: http
        readinessProbe:
          httpGet:
            path: /
            port: http
        resources:
          {{- toYaml .Values.resources | nindent 12 }}
```

```bash
# Helmコマンド
helm create myapp
helm install myapp ./myapp
helm upgrade myapp ./myapp
helm rollback myapp 1
helm uninstall myapp
helm list
helm status myapp
```

### ArgoCD による GitOps

```yaml
# application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/k8s-manifests
    targetRevision: HEAD
    path: myapp
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## 🧪 実践演習

### 演習1: 宣言的管理の実践

```bash
# YAMLマニフェストの適用
kubectl apply -f complete-stack.yaml

# リソース状態の確認
kubectl get all -n myapp

# リソースの更新
# complete-stack.yamlを編集（replicas: 3 → 5）
kubectl apply -f complete-stack.yaml

# 変更差分の確認
kubectl diff -f complete-stack.yaml
```

### 演習2: Rolling Updateの実践

```bash
# 初期デプロイ
kubectl apply -f rolling-update-deployment.yaml

# イメージ更新
kubectl set image deployment/rolling-update-app app=myapp:v1.1.0

# 更新の監視
kubectl rollout status deployment/rolling-update-app -w

# 履歴確認
kubectl rollout history deployment/rolling-update-app

# ロールバック
kubectl rollout undo deployment/rolling-update-app
```

### 演習3: Canaryデプロイの実践

```bash
# Canaryデプロイ
kubectl apply -f canary-deployment.yaml

# トラフィック分散の確認
for i in {1..10}; do
  curl http://myapp-service/version
done

# Canaryの段階的拡大
kubectl scale deployment myapp-canary --replicas=3
kubectl scale deployment myapp-stable --replicas=7

# 本格移行
kubectl scale deployment myapp-canary --replicas=10
kubectl scale deployment myapp-stable --replicas=0
```

## 🎯 ベストプラクティス

### マニフェスト管理

1. **ディレクトリ構造**
   ```
   k8s-manifests/
   ├── base/
   │   ├── deployment.yaml
   │   ├── service.yaml
   │   └── kustomization.yaml
   ├── overlays/
   │   ├── development/
   │   │   ├── kustomization.yaml
   │   │   └── patch-replicas.yaml
   │   ├── staging/
   │   └── production/
   └── README.md
   ```

2. **ラベルとアノテーション**
   ```yaml
   metadata:
     labels:
       app: myapp
       version: v1.0.0
       component: frontend
       environment: production
     annotations:
       description: "Frontend application"
       maintainer: "team@example.com"
       last-updated: "2023-01-01T00:00:00Z"
   ```

### 更新戦略

1. **適切な戦略選択**
   - **Rolling Update**: 一般的なアプリケーション
   - **Blue/Green**: ダウンタイムが許されない場合
   - **Canary**: リスクを最小化したい場合

2. **ヘルスチェック**
   ```yaml
   readinessProbe:
     httpGet:
       path: /ready
       port: 8080
     initialDelaySeconds: 5
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 3
   ```

## 🚨 トラブルシューティング

### よくある問題

1. **リソース適用エラー**
   ```bash
   # YAML構文確認
   kubectl apply -f deployment.yaml --dry-run=client
   
   # サーバー側バリデーション
   kubectl apply -f deployment.yaml --dry-run=server
   
   # エラー詳細確認
   kubectl describe deployment myapp
   ```

2. **更新が進まない**
   ```bash
   # Pod状態確認
   kubectl get pods -l app=myapp
   
   # イベント確認
   kubectl get events --sort-by=.metadata.creationTimestamp
   
   # ロールアウト状況確認
   kubectl rollout status deployment/myapp
   ```

3. **ロールバックが必要**
   ```bash
   # 履歴確認
   kubectl rollout history deployment/myapp
   
   # 特定リビジョンの詳細
   kubectl rollout history deployment/myapp --revision=2
   
   # ロールバック実行
   kubectl rollout undo deployment/myapp --to-revision=2
   ```

## 📚 参考リソース

- **[Managing Kubernetes Objects](https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/)**
- **[Kustomize](https://kustomize.io/)**
- **[Helm](https://helm.sh/docs/)**
- **[ArgoCD](https://argo-cd.readthedocs.io/)**

---

**関連タスク**: [Secret管理](./manage-secrets.md) → [アプリケーション実行](./run-applications.md) → [ネットワーキング](./networking.md)
