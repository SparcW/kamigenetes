# AWS ECSとKubernetesの詳細比較 ⚖️

## はじめに

AWS ECS管理者の皆さんが最も関心を持つ「何が同じで、何が違うのか」を詳しく解説します。実際の移行作業で直面する課題と解決策も含めて説明します。

## 🏗️ アーキテクチャの比較

### AWS ECS
```text
┌─────────────────────────────────────┐
│               AWS Cloud              │
├─────────────────────────────────────┤
│  ECS Control Plane (AWS管理)        │
├─────────────────────────────────────┤
│  ECS Cluster                        │
│  ├── EC2 Launch Type                │
│  │   └── EC2 Instances              │
│  └── Fargate Launch Type            │
│      └── Fargate Tasks              │
└─────────────────────────────────────┘
```

### Kubernetes
```text
┌─────────────────────────────────────┐
│           任意のクラウド/オンプレミス │
├─────────────────────────────────────┤
│  Control Plane                      │
│  ├── API Server                     │
│  ├── etcd                          │
│  ├── Scheduler                      │
│  └── Controller Manager             │
├─────────────────────────────────────┤
│  Worker Nodes                       │
│  ├── kubelet                        │
│  ├── kube-proxy                     │
│  └── Container Runtime              │
└─────────────────────────────────────┘
```

## 📊 機能対比マトリックス

### コアコンポーネント

| 機能 | AWS ECS | Kubernetes | 移行時の注意点 |
|------|---------|------------|----------------|
| **オーケストレーション** | ECS Agent | kubelet | K8sはより柔軟だが設定が複雑 |
| **最小実行単位** | Task | Pod | Podは複数コンテナ可能 |
| **サービス定義** | Task Definition | Deployment YAML | YAMLの学習が必要 |
| **ロードバランシング** | ALB/NLB統合 | Service + Ingress | K8sはより設定ステップが多い |
| **サービスディスカバリー** | Service Connect | Service DNS | K8sは標準で高機能 |
| **オートスケーリング** | Service Auto Scaling | HPA/VPA | K8sはより多くの指標に対応 |

### ネットワーキング

| 機能 | AWS ECS | Kubernetes | 説明 |
|------|---------|------------|------|
| **ネットワークモード** | awsvpc, bridge, host | CNI Plugin | K8sはより豊富な選択肢 |
| **内部通信** | Service Connect | ClusterIP Service | K8sは標準でDNSベース |
| **外部公開** | ALB/NLB直接統合 | LoadBalancer Service | AWS Load Balancer Controllerが必要 |
| **SSL終端** | ALB Listener | Ingress Controller | K8sはより設定が複雑 |

### ストレージ

| 機能 | AWS ECS | Kubernetes | 説明 |
|------|---------|------------|------|
| **一時ストレージ** | Task内ボリューム | emptyDir | 同等の機能 |
| **永続ストレージ** | EFS統合 | PersistentVolume | K8sはより抽象化されている |
| **設定管理** | Parameter Store統合 | ConfigMap/Secret | K8sは標準で高機能 |

## 🔄 実際の移行例

### ECS Task Definition → Kubernetes Deployment

**ECS Task Definition (JSON)**:
```json
{
  "family": "web-app",
  "cpu": "1024",
  "memory": "2048",
  "networkMode": "awsvpc",
  "requiresCompatibility": ["FARGATE"],
  "containerDefinitions": [
    {
      "name": "web",
      "image": "nginx:1.21",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:ssm:region:account:parameter/db/password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/web-app",
          "awslogs-region": "us-west-2"
        }
      }
    }
  ]
}
```

**Kubernetes Deployment (YAML)**:
```yaml
# ConfigMapとSecretの定義
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-app-config
data:
  ENV: "production"
---
apiVersion: v1
kind: Secret
metadata:
  name: web-app-secrets
type: Opaque
data:
  DB_PASSWORD: <base64-encoded-password>
---
# Deployment定義
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: web
        image: nginx:1.21
        ports:
        - containerPort: 80
        env:
        - name: ENV
          valueFrom:
            configMapKeyRef:
              name: web-app-config
              key: ENV
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: web-app-secrets
              key: DB_PASSWORD
        resources:
          requests:
            cpu: "1000m"    # 1 CPU core
            memory: "2Gi"   # 2 GiB
          limits:
            cpu: "1000m"
            memory: "2Gi"
```

### ECS Service → Kubernetes Service

**ECS Service設定**:
```json
{
  "serviceName": "web-app-service",
  "taskDefinition": "web-app",
  "desiredCount": 3,
  "launchType": "FARGATE",
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",
      "containerName": "web",
      "containerPort": 80
    }
  ]
}
```

**Kubernetes Service + Ingress**:
```yaml
# Service定義
apiVersion: v1
kind: Service
metadata:
  name: web-app-service
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
---
# Ingress定義（ALB相当）
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app-service
            port:
              number: 80
```

## 🔍 運用面での比較

### デプロイとアップデート

| 項目 | AWS ECS | Kubernetes | ECS管理者への影響 |
|------|---------|------------|------------------|
| **デプロイ方法** | Service Update | Rolling Update | K8sはより細かい制御が可能 |
| **ロールバック** | Task Definition Revision | Deployment Rollback | K8sはコマンド一つで可能 |
| **Blue/Green** | CodeDeploy統合必要 | 標準サポート | K8sの方がシンプル |
| **カナリアデプロイ** | 手動設定 | Istio/Argo Rollouts | K8sは豊富なツール |

**ECS デプロイ例**:
```bash
# ECS
aws ecs update-service \
  --cluster my-cluster \
  --service web-app-service \
  --task-definition web-app:2
```

**Kubernetes デプロイ例**:
```bash
# Kubernetes
kubectl set image deployment/web-app web=nginx:1.22
kubectl rollout status deployment/web-app

# ロールバック
kubectl rollout undo deployment/web-app
```

### モニタリングとログ

| 項目 | AWS ECS | Kubernetes | 移行時の考慮点 |
|------|---------|------------|----------------|
| **メトリクス** | CloudWatch標準統合 | Prometheus推奨 | メトリクス基盤の変更が必要 |
| **ログ** | CloudWatch Logs | FluentBit/Fluentd | ログ集約方法の見直し |
| **ヘルスチェック** | ALB Health Check | Liveness/Readiness Probe | K8sはより詳細な制御 |
| **分散トレーシング** | X-Ray統合 | Jaeger/Zipkin | ツールチェーンの変更 |

### オートスケーリング

**ECS Auto Scaling**:
```json
{
  "ServiceName": "web-app-service",
  "ScalableDimension": "ecs:service:DesiredCount",
  "MinCapacity": 1,
  "MaxCapacity": 10,
  "TargetTrackingScalingPolicies": [
    {
      "MetricType": "ECSServiceAverageCPUUtilization",
      "TargetValue": 70.0
    }
  ]
}
```

**Kubernetes HPA**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 🛠️ 開発・運用ツールの比較

### CLI ツール

| タスク | AWS CLI (ECS) | kubectl | 学習コスト |
|--------|--------------|---------|------------|
| **サービス状態確認** | `aws ecs describe-services` | `kubectl get deployments` | 低 |
| **ログ確認** | `aws logs get-log-events` | `kubectl logs` | 低 |
| **スケーリング** | `aws ecs update-service` | `kubectl scale` | 低 |
| **設定更新** | `aws ecs register-task-definition` | `kubectl apply` | 中 |
| **デバッグ** | ECS Exec | `kubectl exec` | 低 |

### Infrastructure as Code

| ツール | AWS ECS対応 | Kubernetes対応 | 移行戦略 |
|--------|-------------|----------------|----------|
| **Terraform** | ◎ 完全サポート | ◎ 完全サポート | 既存スキルが活用可能 |
| **CloudFormation** | ◎ AWS標準 | △ 限定的 | Terraformへの移行推奨 |
| **CDK** | ◎ 完全サポート | ◎ cdk8s | 新しいスキル習得が必要 |
| **Helm** | × 対応なし | ◎ 標準ツール | Kubernetes専用学習が必要 |

## 💰 コスト比較

### 運用コスト要因

| コスト要因 | AWS ECS | Kubernetes | 影響度 |
|------------|---------|------------|--------|
| **コントロールプレーン** | AWS管理（無料） | EKS: $0.10/時間 | 中 |
| **ワーカーノード** | EC2/Fargate | EC2インスタンス | 同等 |
| **ロードバランサー** | ALB/NLB料金 | AWS Load Balancer Controller | 同等 |
| **運用ツール** | CloudWatch標準 | 別途Prometheus等 | 中〜高 |
| **人的コスト** | 既存スキル活用 | 新規学習必要 | 高 |

### コスト最適化のポイント

1. **Spot Instance活用**
   - ECS: Spot Fleet
   - K8s: Spot Node Group + Cluster Autoscaler

2. **リソース効率化**
   - ECS: Fargateのリソース最適化
   - K8s: Vertical Pod Autoscaler + Right Sizing

3. **予約インスタンス**
   - 両方とも同様に活用可能

## 🚀 移行戦略の推奨パターン

### 段階的移行アプローチ

1. **フェーズ1: 学習・検証（2-4週間）**
   - 開発環境でのK8s構築
   - 単純なアプリケーションでの検証
   - チーム学習とスキル習得

2. **フェーズ2: パイロットプロジェクト（4-6週間）**
   - 新規サービスのK8sデプロイ
   - モニタリング・ログ基盤構築
   - CI/CDパイプライン整備

3. **フェーズ3: 段階的移行（3-6ヶ月）**
   - 既存ECSサービスの順次移行
   - 依存関係の少ないサービスから開始
   - 並行運用期間の設定

## 📝 まとめ

### ECS → Kubernetes移行の利点

✅ **マルチクラウド対応**: ベンダーロックイン回避  
✅ **豊富なエコシステム**: Helm、Istio、Prometheusなど  
✅ **細かい制御**: より詳細な設定とカスタマイズ  
✅ **コミュニティ**: 大きなオープンソースコミュニティ  

### 考慮すべき課題

⚠️ **学習コスト**: 新しい概念とツールの習得  
⚠️ **運用複雑性**: より多くの設定とメンテナンス  
⚠️ **初期構築**: Control Planeの管理（EKS使用推奨）  

### 成功の鍵

1. **段階的なアプローチ**: 一度にすべて移行しない
2. **十分な学習期間**: チーム全体のスキルアップ
3. **適切なツール選択**: AWS Load Balancer Controller等
4. **運用基盤整備**: モニタリング・ログ・デプロイ自動化

---

**次へ**: [開発環境の構築](./03-development-setup.md)
