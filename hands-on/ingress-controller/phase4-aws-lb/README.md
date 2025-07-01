# Phase 4: AWS Load Balancer Controller実習

## 目標
- AWS Load Balancer ControllerとEKSの統合を学習
- Application Load Balancer (ALB) とNetwork Load Balancer (NLB) の使い分けを理解
- AWS Certificate ManagerとRoute 53の統合方法を習得
- AWS ECSからEKSへの移行パターンを実践

## 前提条件
- AWS EKSクラスターが起動していること
- AWS CLIが設定済みであること
- IAMロールとポリシーが適切に設定されていること
- kubectl CLIがEKSクラスターに接続されていること

## 学習項目

### 1. AWS Load Balancer Controllerの特徴

**主な特徴**：
- **AWSネイティブ統合**: ALB、NLB、Route 53、ACMとの完全統合
- **インテリジェントルーティング**: 高度なパスベース・ホストベースルーティング
- **自動スケーリング**: ALBターゲットグループの動的管理
- **コスト最適化**: AWS料金体系に最適化されたリソース使用
- **セキュリティ統合**: AWS WAF、Shield、Security Groupsとの連携

**AWS ECSとの比較**：
- **タスク定義 vs Deployment**: ECSタスク定義がKubernetes Deploymentに対応
- **サービス vs Service**: ECSサービスがKubernetesサービスに対応  
- **ALB Target Groups**: 自動的に管理される
- **Auto Scaling**: ECS Auto Scaling vs HorizontalPodAutoscaler

### 2. 移行シナリオ

```
[AWS ECS with ALB]
     ↓ 移行
[AWS EKS with AWS Load Balancer Controller]
```

**移行のメリット**：
- 既存のAWSインフラストラクチャとの互換性維持
- 運用チームの学習コスト削減
- AWS Well-Architected Framework準拠

## 実習手順

### ステップ 1: IAMポリシーとサービスアカウント設定

```bash
# IAMポリシー作成
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

# サービスアカウント作成
eksctl create iamserviceaccount \
  --cluster=my-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::ACCOUNT-ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve
```

### ステップ 2: AWS Load Balancer Controllerのインストール

```bash
# Helm を使用してインストール
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# コントローラーのインストール
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=my-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### ステップ 3: サンプルアプリケーションのデプロイ

```bash
# サンプルアプリケーションのデプロイ
kubectl apply -f 01-aws-lb-controller.yaml

# Pod状態の確認
kubectl get pods -n webapp
```

### ステップ 4: ALB Ingressの設定

```bash
# ALB Ingress設定の適用
kubectl apply -f 02-alb-ingress.yaml

# ALB作成状況の確認
kubectl get ingress -n webapp
kubectl describe ingress webapp-alb-ingress -n webapp
```

### ステップ 5: AWS管理コンソールでの確認

```bash
# ALB詳細情報の確認
aws elbv2 describe-load-balancers

# Target Group状況確認
aws elbv2 describe-target-groups
```

### ステップ 6: 動作確認とテスト

```bash
# テストスクリプトの実行
chmod +x test-aws-lb.sh
./test-aws-lb.sh
```

## 高度な機能の学習

### 1. AWS Certificate Manager (ACM) 統合

```yaml
annotations:
  alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/cert-id
  alb.ingress.kubernetes.io/ssl-redirect: '443'
```

### 2. AWS WAF統合

```yaml
annotations:
  alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:region:account:webacl/name/id
```

### 3. Network Load Balancer (NLB) 使用

```yaml
annotations:
  service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
  service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
```

### 4. TargetGroupBinding CRD

```yaml
apiVersion: elbv2.k8s.aws/v1beta1
kind: TargetGroupBinding
metadata:
  name: my-app-tgb
spec:
  serviceRef:
    name: my-app-service
    port: 80
  targetGroupARN: arn:aws:elasticloadbalancing:region:account:targetgroup/name/id
```

## AWS ECSからの移行パターン

### 1. 段階的移行アプローチ

**Phase 1: インフラストラクチャ準備**
- EKSクラスター作成
- AWS Load Balancer Controller設定
- 既存VPCとSubnetの活用

**Phase 2: アプリケーション移行**
- ECSタスク定義 → Kubernetes Deployment変換
- ECSサービス → Kubernetes Service + Ingress変換
- Auto Scaling設定移行

**Phase 3: 監視・ログ移行**
- CloudWatch → Prometheus + Grafana
- AWS X-Ray → Jaeger or Istio
- AWS CLI → kubectl

### 2. 設定変換例

**ECS タスク定義**:
```json
{
  "family": "webapp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "web",
      "image": "nginx:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ]
    }
  ]
}
```

**対応するKubernetes Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: web
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## AWS コスト最適化

### 1. Fargate vs EKS Node Groups

| 項目 | Fargate | EKS Node Groups |
|------|---------|-----------------|
| **課金方式** | vCPU・メモリ時間 | インスタンス時間 |
| **管理オーバーヘッド** | なし | ノード管理必要 |
| **適用場面** | バースト対応 | 常時稼働 |

### 2. Auto Scaling最適化

```yaml
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: webapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: webapp
  minReplicas: 2
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
```

## 監視とトラブルシューティング

### 1. CloudWatch メトリクス

- **ALB メトリクス**: RequestCount, LatencyHigh, HTTPCode_Target_5XX_Count
- **EKS メトリクス**: Pod CPU/Memory使用率、ノード使用率
- **アプリメトリクス**: カスタムメトリクス

### 2. AWS X-Ray トレーシング

```yaml
# X-Ray デーモンの設定
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: xray-daemon
spec:
  selector:
    matchLabels:
      app: xray-daemon
  template:
    metadata:
      labels:
        app: xray-daemon
    spec:
      containers:
      - name: xray-daemon
        image: amazon/aws-xray-daemon:latest
        ports:
        - containerPort: 2000
          protocol: UDP
```

## セキュリティ考慮事項

### 1. IAM Roles for Service Accounts (IRSA)

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-service-account
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT-ID:role/my-pod-role
```

### 2. Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: webapp
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## AWS ECS vs EKS 比較表

| 機能 | AWS ECS | AWS EKS |
|------|---------|---------|
| **学習コスト** | 低 | 中〜高 |
| **運用複雑さ** | 低 | 中 |
| **ベンダーロックイン** | 高 | 低 |
| **エコシステム** | AWS専用 | Kubernetes標準 |
| **マルチクラウド** | 不可 | 可能 |
| **カスタマイゼーション** | 制限あり | 高い柔軟性 |

## 次のステップ

- Helm を使ったアプリケーション管理
- Kustomize を使った環境別設定管理
- ArgoCD を使ったGitOps実装
- Istio Service Mesh導入検討

## 参考資料

- [AWS Load Balancer Controller Documentation](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
