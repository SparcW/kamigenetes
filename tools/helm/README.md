# 📦 Helm - Kubernetesパッケージマネージャー

HelmはKubernetesのパッケージマネージャーです。AWS ECS管理者にとって、CloudFormationテンプレートのような役割を果たし、複雑なKubernetesアプリケーションを簡単に管理できます。

## 🎯 この章で学ぶこと

- Helmの基本概念とアーキテクチャ
- Chartの構造と作成方法
- AWS ECSとの対応関係
- 実践的な運用方法

## 🔍 Helmとは

Helmは「Kubernetesのパッケージマネージャー」として、以下の機能を提供します：

### 主要機能

| 機能 | 説明 | AWS対応 |
|------|------|---------|
| **パッケージ管理** | アプリケーションのテンプレート化 | CloudFormationテンプレート |
| **依存関係管理** | Chart間の依存関係解決 | NestedStack |
| **バージョン管理** | リリース履歴とロールバック | CodeDeploy履歴 |
| **設定の分離** | 環境別パラメータ管理 | Parameter Store |
| **リポジトリ管理** | Chart配布とバージョニング | Docker Registry |

## 🏗️ Helmアーキテクチャ

### Helm 3 アーキテクチャ
```
┌─────────────────────────────────────┐
│             Helm Client             │
│  ┌─────────────┐ ┌─────────────────┐│
│  │Helm CLI     │ │Chart Repository ││
│  │             │ │                 ││
│  └─────────────┘ └─────────────────┘│
└─────────────────────────────────────┘
                    │
                    │ kubectl API calls
                    ▼
┌─────────────────────────────────────┐
│        Kubernetes Cluster           │
│  ┌─────────────┐ ┌─────────────────┐│
│  │Release      │ │Secrets          ││
│  │Information  │ │(Release Data)   ││
│  └─────────────┘ └─────────────────┘│
└─────────────────────────────────────┘
```

### AWS ECSとの比較
```yaml
# AWS CloudFormation (ECS)
Parameters:
  AppName:
    Type: String
    Default: my-app
  Environment:
    Type: String
    Default: production

Resources:
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Ref AppName
      ContainerDefinitions:
        - Name: !Ref AppName
          Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${AppName}:latest"
```

```yaml
# Helm Chart (Kubernetes)
# values.yaml
app:
  name: my-app
  environment: production
  image:
    repository: my-app
    tag: latest

# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.app.name }}
  labels:
    app: {{ .Values.app.name }}
    environment: {{ .Values.app.environment }}
spec:
  template:
    spec:
      containers:
      - name: {{ .Values.app.name }}
        image: "{{ .Values.app.image.repository }}:{{ .Values.app.image.tag }}"
```

## 📋 Helm基本概念

### 1. Chart（チャート）
**CloudFormationテンプレートに相当するパッケージ**

```
mychart/
├── Chart.yaml          # Chart情報（CloudFormationメタデータ相当）
├── values.yaml         # デフォルト値（Parametersセクション相当）
├── charts/             # 依存Chart（NestedStack相当）
├── templates/          # Kubernetesマニフェストテンプレート
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl    # 共通テンプレート関数
└── .helmignore         # パッケージ対象外ファイル
```

### 2. Release（リリース）
**デプロイされたChartのインスタンス**

```bash
# リリースの作成（CloudFormationスタック作成相当）
helm install my-app-prod ./mychart --values prod-values.yaml

# リリースの更新（CloudFormationスタック更新相当）
helm upgrade my-app-prod ./mychart --values prod-values.yaml

# リリースの削除（CloudFormationスタック削除相当）
helm uninstall my-app-prod
```

### 3. Repository（リポジトリ）
**ChartのOCIレジストリまたはHTTPサーバー**

```bash
# パブリックリポジトリの追加
helm repo add bitnami https://charts.bitnami.com/bitnami

# AWS ECRをプライベートレジストリとして使用
helm registry login public.ecr.aws
helm push mychart-1.0.0.tgz oci://public.ecr.aws/my-registry
```

## 🛠️ Chart作成の実践

### Chart.yaml の作成
```yaml
# Chart.yaml - CloudFormation Metadataに相当
apiVersion: v2
name: my-web-app
description: A Helm chart for web application
type: application
version: 1.0.0    # Chart version
appVersion: "2.1.0"  # Application version

# 依存関係（NestedStack相当）
dependencies:
- name: postgresql
  version: 11.9.13
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled

# キーワードとメンテナ情報
keywords:
- web
- application
- microservice
maintainers:
- name: DevOps Team
  email: devops@example.com

# アノテーション（AWS リソースタグ相当）
annotations:
  category: Application
  environment: production
```

### values.yaml の設計
```yaml
# values.yaml - CloudFormation Parametersに相当

# アプリケーション設定
app:
  name: my-web-app
  version: "2.1.0"
  environment: production
  
# コンテナ設定（ECS TaskDefinition相当）
image:
  repository: my-web-app
  tag: "2.1.0"
  pullPolicy: IfNotPresent

# リソース設定（ECS TaskDefinition CPU/Memory相当）
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# レプリカ設定（ECS Service DesiredCount相当）
replicaCount: 3

# サービス設定（ECS Service + ALB相当）
service:
  type: ClusterIP
  port: 80
  targetPort: 8080

# Ingress設定（ALB設定相当）
ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    # AWS ALB Controllerの場合
    # kubernetes.io/ingress.class: alb
    # alb.ingress.kubernetes.io/scheme: internet-facing
  hosts:
    - host: my-app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: my-app-tls
      hosts:
        - my-app.example.com

# 永続化設定（EBS/EFS相当）
persistence:
  enabled: true
  size: 10Gi
  storageClass: "gp2"  # AWS EBS gp2相当

# セキュリティ設定（IAM Role + Security Group相当）
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/MyAppRole

securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

# 環境変数（ECS TaskDefinition Environment相当）
env:
  - name: NODE_ENV
    value: production
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: app-secrets
        key: database-url

# ConfigMap設定（Parameter Store相当）
config:
  database:
    host: "postgres.example.com"
    port: 5432
    name: "myapp"
  redis:
    host: "redis.example.com"
    port: 6379

# データベース依存関係
postgresql:
  enabled: true
  auth:
    username: myapp
    database: myapp
    existingSecret: postgres-credentials
  primary:
    persistence:
      size: 20Gi
      storageClass: "gp2"

# 監視設定（CloudWatch相当）
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
    path: /metrics

# HPA設定（Auto Scaling相当）
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### テンプレートの作成

#### Deployment テンプレート
```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-web-app.fullname" . }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "my-web-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
      labels:
        {{- include "my-web-app.selectorLabels" . | nindent 8 }}
    spec:
      {{- if .Values.serviceAccount.create }}
      serviceAccountName: {{ include "my-web-app.serviceAccountName" . }}
      {{- end }}
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
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
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            {{- range .Values.env }}
            - name: {{ .name }}
              {{- if .value }}
              value: {{ .value | quote }}
              {{- else if .valueFrom }}
              valueFrom:
                {{- toYaml .valueFrom | nindent 16 }}
              {{- end }}
            {{- end }}
            - name: DATABASE_HOST
              value: {{ .Values.config.database.host | quote }}
            - name: DATABASE_PORT
              value: {{ .Values.config.database.port | quote }}
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
            {{- if .Values.persistence.enabled }}
            - name: data
              mountPath: /app/data
            {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        - name: config
          configMap:
            name: {{ include "my-web-app.fullname" . }}-config
        {{- if .Values.persistence.enabled }}
        - name: data
          persistentVolumeClaim:
            claimName: {{ include "my-web-app.fullname" . }}-data
        {{- end }}
```

#### Service テンプレート
```yaml
# templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "my-web-app.fullname" . }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "my-web-app.selectorLabels" . | nindent 4 }}
```

#### HPA テンプレート
```yaml
# templates/hpa.yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "my-web-app.fullname" . }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "my-web-app.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
{{- end }}
```

## 🚀 実践的な運用

### 環境別デプロイ
```bash
# 開発環境
helm install my-app-dev ./mychart \
  --values values.yaml \
  --values values-dev.yaml \
  --namespace development

# ステージング環境
helm install my-app-staging ./mychart \
  --values values.yaml \
  --values values-staging.yaml \
  --namespace staging

# 本番環境
helm install my-app-prod ./mychart \
  --values values.yaml \
  --values values-prod.yaml \
  --namespace production
```

### values-prod.yaml の例
```yaml
# values-prod.yaml - 本番環境固有設定
app:
  environment: production

replicaCount: 5

resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"

ingress:
  hosts:
    - host: app.company.com
      paths:
        - path: /
          pathType: Prefix

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20

postgresql:
  enabled: false  # 本番では外部RDS使用

monitoring:
  enabled: true
```

### CI/CDパイプラインとの統合
```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v1
    
    - name: Setup Helm
      uses: azure/setup-helm@v1
      with:
        version: '3.12.0'
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name my-cluster
    
    - name: Deploy with Helm
      run: |
        helm upgrade --install my-app-prod ./chart \
          --values chart/values.yaml \
          --values chart/values-prod.yaml \
          --namespace production \
          --wait \
          --timeout 10m
```

## 🔒 セキュリティベストプラクティス

### 1. Secretsの管理
```yaml
# Secret作成
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  database-password: <base64-encoded-password>

# 外部Secret管理ツールとの統合
# AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: app-secrets
  data:
  - secretKey: database-password
    remoteRef:
      key: prod/database
      property: password
```

### 2. RBAC設定
```yaml
# templates/rbac.yaml
{{- if .Values.serviceAccount.create }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "my-web-app.serviceAccountName" . }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "my-web-app.fullname" . }}
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ include "my-web-app.fullname" . }}
subjects:
- kind: ServiceAccount
  name: {{ include "my-web-app.serviceAccountName" . }}
roleRef:
  kind: Role
  name: {{ include "my-web-app.fullname" . }}
  apiGroup: rbac.authorization.k8s.io
{{- end }}
```

## 📊 テストとバリデーション

### Chart テスト
```bash
# Chartのlinting
helm lint ./mychart

# テンプレートの展開確認
helm template my-app ./mychart --values values-dev.yaml

# ドライラン
helm install my-app ./mychart --dry-run --debug

# テストPodの実行
helm test my-app
```

### テストPodテンプレート
```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "my-web-app.fullname" . }}-test"
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "my-web-app.fullname" . }}:{{ .Values.service.port }}/health']
```

## 🎯 AWS ECS移行ガイド

### CloudFormationからHelmへの移行手順

1. **既存リソースの分析**
```bash
# CloudFormationスタックのエクスポート
aws cloudformation describe-stacks --stack-name my-app-stack
aws cloudformation list-stack-resources --stack-name my-app-stack
```

2. **Chart構造の設計**
```bash
# Chartの初期化
helm create my-app-chart

# 既存設定の移行
# TaskDefinition → templates/deployment.yaml
# Service → templates/service.yaml  
# LoadBalancer → templates/ingress.yaml
```

3. **段階的移行**
```bash
# Phase 1: 開発環境での検証
helm install my-app-dev ./mychart -n development

# Phase 2: ステージング環境での負荷テスト
helm install my-app-staging ./mychart -n staging

# Phase 3: 本番環境への適用
helm install my-app-prod ./mychart -n production
```

## 📚 次のステップ

1. **[Helmハンズオン](../../hands-on-labs/)** - 実際にChartを作成・デプロイ
2. **[Kustomize統合](../kustomize/)** - HelmとKustomizeの組み合わせ
3. **[ArgoCD連携](../argocd/)** - GitOpsワークフローの実装

---

**実践**: [Helmハンズオンを開始](../../hands-on-labs/) | **Quiz**: [理解度チェック](./quiz/)
