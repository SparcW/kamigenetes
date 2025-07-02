# 🏭 Kubernetes本番環境構築ガイド

このガイドでは、AWS ECS運用経験者向けに、Kubernetesクラスターの本番環境構築とベストプラクティスを詳しく解説します。高可用性、セキュリティ、監視、災害復旧などの企業レベルの要件を満たす構成を学習します。

## 📋 目次

1. [AWS ECSとの対応関係](#aws-ecsとの対応関係)
2. [本番環境要件](#本番環境要件)
3. [クラスターアーキテクチャ](#クラスターアーキテクチャ)
4. [AWS EKS構築](#aws-eks構築)
5. [ストレージ設定](#ストレージ設定)
6. [ネットワーク設定](#ネットワーク設定)
7. [セキュリティ設定](#セキュリティ設定)
8. [監視・ログ設定](#監視ログ設定)
9. [バックアップ・災害復旧](#バックアップ災害復旧)
10. [CI/CD統合](#cicd統合)
11. [実践演習](#実践演習)

## 🔄 AWS ECSとの対応関係

### インフラストラクチャマッピング

| AWS ECS環境 | Kubernetes本番環境 | 説明 |
|-------------|-------------------|------|
| **ECS Cluster** | **EKS Cluster** | コンテナオーケストレーション基盤 |
| **EC2 Auto Scaling** | **Cluster Autoscaler** | ノードの自動スケーリング |
| **ALB/NLB** | **AWS Load Balancer Controller** | 外部ロードバランシング |
| **CloudWatch** | **Prometheus + Grafana** | 監視・メトリクス収集 |
| **ECS Service Discovery** | **CoreDNS + Service** | サービス間通信・名前解決 |
| **IAM Roles for Tasks** | **IRSA (IAM Roles for Service Accounts)** | Pod単位のIAM権限 |
| **CloudFormation** | **Terraform + Helm** | インフラ・アプリケーションコード管理 |
| **CodePipeline** | **ArgoCD + GitLab CI** | CI/CDパイプライン |

### スケーラビリティ比較

```yaml
# AWS ECS: Service Auto Scaling
ECS Service:
  DesiredCount: 3
  MinimumHealthyPercent: 100
  MaximumPercent: 200
  AutoScaling:
    TargetCPUUtilization: 70%
    MinCapacity: 2
    MaxCapacity: 10
```

```yaml
# Kubernetes: HPA + VPA + Cluster Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
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

## 🎯 本番環境要件

### 1. 可用性要件

- **SLA**: 99.9%以上（月間ダウンタイム < 43.8分）
- **RTO**: 15分以内（復旧時間目標）
- **RPO**: 1時間以内（データ損失許容時間）
- **マルチAZ**: 最低3つのAZに分散配置

### 2. セキュリティ要件

- **ネットワーク分離**: プライベートサブネット配置
- **暗号化**: 保存時・転送時データ暗号化
- **アクセス制御**: RBAC + Pod Security Policy
- **脆弱性管理**: イメージスキャン + 定期更新

### 3. パフォーマンス要件

- **レスポンス時間**: 95%ile < 200ms
- **スループット**: 1,000 RPS以上
- **リソース効率**: CPU使用率 < 70%

### 4. 運用要件

- **監視**: リアルタイム監視・アラート
- **ログ**: 集約・検索・保存（90日間）
- **バックアップ**: 日次バックアップ・テスト復旧
- **更新**: ゼロダウンタイム デプロイメント

## 🏗 クラスターアーキテクチャ

### マルチAZ高可用性構成

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS EKS Cluster                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    AZ-1a    │  │    AZ-1b    │  │    AZ-1c    │        │
│  │             │  │             │  │             │        │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │
│  │ │ Control │ │  │ │ Control │ │  │ │ Control │ │        │
│  │ │ Plane   │ │  │ │ Plane   │ │  │ │ Plane   │ │        │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │
│  │             │  │             │  │             │        │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │
│  │ │ Worker  │ │  │ │ Worker  │ │  │ │ Worker  │ │        │
│  │ │ Node    │ │  │ │ Node    │ │  │ │ Node    │ │        │
│  │ │ Group   │ │  │ │ Group   │ │  │ │ Group   │ │        │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │
│  │             │  │             │  │             │        │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │        │
│  │ │   EBS   │ │  │ │   EBS   │ │  │ │   EBS   │ │        │
│  │ │ Volume  │ │  │ │ Volume  │ │  │ │ Volume  │ │        │
│  │ └─────────┘ │  │ └─────────┘ │  │ └─────────┘ │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────────┐
                    │  External DNS   │
                    │   Route 53      │
                    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │   ALB / NLB     │
                    └─────────────────┘
```

### ノードグループ設計

```yaml
# 本番用ノードグループ設定
NodeGroups:
  # アプリケーション用ノード
  application-nodes:
    instanceTypes: [m5.large, m5.xlarge]
    minSize: 3
    maxSize: 20
    desiredCapacity: 6
    taints:
    - key: workload
      value: application
      effect: NoSchedule
    labels:
      workload: application
      
  # システム用ノード
  system-nodes:
    instanceTypes: [t3.medium]
    minSize: 2
    maxSize: 5
    desiredCapacity: 3
    taints:
    - key: workload
      value: system
      effect: NoSchedule
    labels:
      workload: system
      
  # データベース用ノード
  database-nodes:
    instanceTypes: [r5.large, r5.xlarge]
    minSize: 2
    maxSize: 6
    desiredCapacity: 3
    taints:
    - key: workload
      value: database
      effect: NoSchedule
    labels:
      workload: database
```

## ☁️ AWS EKS構築

### 1. Terraform環境定義

```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket = "my-company-terraform-state"
    key    = "k8s-production/terraform.tfstate"
    region = "us-west-2"
    
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

# VPC設定
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "k8s-production-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true

  public_subnet_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/elb" = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = {
    Environment = "production"
    Project     = "k8s-migration"
  }
}

# EKSクラスター
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = local.cluster_name
  cluster_version = "1.28"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true
  cluster_endpoint_public_access_cidrs = ["203.0.113.0/24"]  # 会社IPレンジ

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # ノードグループ
  eks_managed_node_groups = {
    application = {
      name = "application-nodes"
      
      instance_types = ["m5.large"]
      min_size     = 3
      max_size     = 20
      desired_size = 6

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        /etc/eks/bootstrap.sh ${local.cluster_name}
      EOT

      vpc_security_group_ids = [aws_security_group.worker_nodes.id]
      
      labels = {
        workload = "application"
      }
      
      taints = {
        application = {
          key    = "workload"
          value  = "application"
          effect = "NO_SCHEDULE"
        }
      }
    }
    
    system = {
      name = "system-nodes"
      
      instance_types = ["t3.medium"]
      min_size     = 2
      max_size     = 5
      desired_size = 3

      labels = {
        workload = "system"
      }
      
      taints = {
        system = {
          key    = "workload"
          value  = "system"
          effect = "NO_SCHEDULE"
        }
      }
    }
  }

  tags = {
    Environment = "production"
    Project     = "k8s-migration"
  }
}

locals {
  cluster_name = "k8s-production"
}
```

### 2. セキュリティグループ設定

```hcl
# terraform/security-groups.tf
resource "aws_security_group" "worker_nodes" {
  name_prefix = "${local.cluster_name}-worker-nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port = 22
    to_port   = 22
    protocol  = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # VPC内からのSSHアクセス
  }

  ingress {
    from_port = 80
    to_port   = 80
    protocol  = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  ingress {
    from_port = 30000
    to_port   = 32767
    protocol  = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # NodePortレンジ
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.cluster_name}-worker-nodes"
    "kubernetes.io/cluster/${local.cluster_name}" = "owned"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.cluster_name}-rds"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.worker_nodes.id]
  }

  tags = {
    Name = "${local.cluster_name}-rds"
  }
}
```

### 3. クラスター構築実行

```bash
# 1. Terraform初期化
cd terraform/
terraform init

# 2. 設定値確認
terraform plan -var-file="production.tfvars"

# 3. リソース作成
terraform apply -var-file="production.tfvars"

# 4. kubectl設定
aws eks update-kubeconfig --region us-west-2 --name k8s-production

# 5. クラスター確認
kubectl get nodes
kubectl get namespaces
```

## 💾 ストレージ設定

### 1. EBS CSI Driver設定

```yaml
# storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-encrypted
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"
  iops: "3000"
  throughput: "125"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Delete
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-retain
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"
  iops: "3000"
  throughput: "125"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Retain  # 本番データ用
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: io2-high-performance
provisioner: ebs.csi.aws.com
parameters:
  type: io2
  fsType: ext4
  encrypted: "true"
  iops: "10000"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
reclaimPolicy: Retain
```

### 2. 永続ボリューム戦略

```yaml
# database-pvc.yaml - データベース用PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: production
  labels:
    app: postgres
    tier: database
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3-retain
  resources:
    requests:
      storage: 100Gi
---
# shared-storage-pvc.yaml - 共有ストレージ用PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage
  namespace: production
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: efs-storage
  resources:
    requests:
      storage: 1Ti
```

### 3. EFS設定（共有ストレージ）

```yaml
# efs-csi-driver.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-storage
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap
  fileSystemId: fs-0abcd1234567890ef  # 事前作成済みEFS ID
  directoryPerms: "0755"
  gidRangeStart: "1000"
  gidRangeEnd: "2000"
  basePath: "/k8s-production"
```

## 🌐 ネットワーク設定

### 1. AWS Load Balancer Controller

```bash
# 1. IAMロール作成
eksctl create iamserviceaccount \
  --cluster=k8s-production \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::ACCOUNT-ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# 2. Helm インストール
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=k8s-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 2. 本番用Ingress設定

```yaml
# production-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: production-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-west-2:ACCOUNT-ID:certificate/CERT-ID
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '5'
    alb.ingress.kubernetes.io/load-balancer-attributes: |
      idle_timeout.timeout_seconds=60,
      routing.http2.enabled=true,
      access_logs.s3.enabled=true,
      access_logs.s3.bucket=my-company-alb-logs,
      access_logs.s3.prefix=k8s-production
spec:
  rules:
  - host: api.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
  - host: app.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
```

### 3. VPC CNI最適化

```yaml
# vpc-cni-configuration.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: amazon-vpc-cni
  namespace: kube-system
data:
  enable-pod-eni: "true"
  enable-prefix-delegation: "true"
  warm-prefix-target: "2"
  warm-ip-target: "3"
  minimum-ip-target: "10"
  enable-custom-network-config: "false"
```

## 🔐 セキュリティ設定

### 1. Pod Security Standards

```yaml
# pod-security-policy.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 2. RBAC設定

```yaml
# rbac-production.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: application-developer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "create", "update", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get", "list", "create", "update", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: production
  name: application-developers
subjects:
- kind: User
  name: dev-team@mycompany.com
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: application-developer
  apiGroup: rbac.authorization.k8s.io
```

### 3. Network Policy（詳細版）

```yaml
# network-policies-production.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
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
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
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
      port: 9090
```

## 📊 監視・ログ設定

### 1. Prometheus Stack デプロイ

```bash
# 1. Helm リポジトリ追加
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. 監視名前空間作成
kubectl create namespace monitoring

# 3. Prometheus Operator インストール
helm install prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values prometheus-values.yaml
```

```yaml
# prometheus-values.yaml
grafana:
  enabled: true
  persistence:
    enabled: true
    size: 10Gi
    storageClassName: gp3-encrypted
  ingress:
    enabled: true
    annotations:
      kubernetes.io/ingress.class: alb
      alb.ingress.kubernetes.io/scheme: internal
    hosts:
    - grafana.internal.mycompany.com

prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          storageClassName: gp3-retain
          resources:
            requests:
              storage: 100Gi

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          storageClassName: gp3-encrypted
          resources:
            requests:
              storage: 10Gi
```

### 2. ログ集約（Fluent Bit）

```yaml
# fluent-bit-values.yaml
image:
  repository: amazon/aws-for-fluent-bit
  tag: latest

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT-ID:role/fluent-bit-role

config:
  outputs: |
    [OUTPUT]
        Name cloudwatch_logs
        Match kube.*
        region us-west-2
        log_group_name /aws/eks/k8s-production/cluster
        log_stream_prefix fluentbit-
        auto_create_group true

    [OUTPUT]
        Name cloudwatch_logs
        Match application.*
        region us-west-2
        log_group_name /aws/eks/k8s-production/applications
        log_stream_prefix app-
        auto_create_group true
```

```bash
# Fluent Bit デプロイ
helm repo add aws https://aws.github.io/eks-charts
helm install fluent-bit aws/aws-for-fluent-bit \
  --namespace kube-system \
  --values fluent-bit-values.yaml
```

## 💾 バックアップ・災害復旧

### 1. Velero設定

```bash
# 1. S3バケット作成
aws s3 mb s3://k8s-production-backups

# 2. IAMポリシー・ロール作成
eksctl create iamserviceaccount \
  --cluster=k8s-production \
  --name=velero-server \
  --namespace=velero \
  --attach-policy-arn=arn:aws:iam::ACCOUNT-ID:policy/VeleroBackupPolicy \
  --approve

# 3. Velero インストール
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --values velero-values.yaml
```

```yaml
# velero-values.yaml
configuration:
  provider: aws
  backupStorageLocation:
    bucket: k8s-production-backups
    config:
      region: us-west-2
  volumeSnapshotLocation:
    config:
      region: us-west-2

initContainers:
- name: velero-plugin-for-aws
  image: velero/velero-plugin-for-aws:v1.8.0
  imagePullPolicy: IfNotPresent
  volumeMounts:
  - mountPath: /target
    name: plugins

serviceAccount:
  server:
    create: false
    name: velero-server
```

### 2. バックアップスケジュール

```yaml
# backup-schedules.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 毎日午前2時
  template:
    includedNamespaces:
    - production
    - staging
    excludedResources:
    - secrets
    - events
    storageLocation: default
    volumeSnapshotLocations:
    - default
    ttl: 720h  # 30日保存
---
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: weekly-full-backup
  namespace: velero
spec:
  schedule: "0 1 * * 0"  # 毎週日曜日午前1時
  template:
    includeClusterResources: true
    storageLocation: default
    volumeSnapshotLocations:
    - default
    ttl: 2160h  # 90日保存
```

### 3. 災害復旧手順

```bash
# 1. クラスター復旧
terraform apply -var-file="production.tfvars"

# 2. Velero復旧
helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --values velero-values.yaml

# 3. バックアップから復旧
velero restore create --from-backup daily-backup-20231215020000

# 4. アプリケーション状態確認
kubectl get pods -n production
kubectl get pvc -n production
```

## 🚀 CI/CD統合

### 1. ArgoCD設定

```bash
# 1. ArgoCD インストール
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. ArgoCD Server設定
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'

# 3. 初期パスワード取得
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 2. GitOps リポジトリ構造

```
k8s-gitops/
├── environments/
│   ├── production/
│   │   ├── applications/
│   │   │   ├── web-app/
│   │   │   └── api-server/
│   │   ├── infrastructure/
│   │   │   ├── monitoring/
│   │   │   └── ingress/
│   │   └── kustomization.yaml
│   └── staging/
├── base/
│   ├── web-app/
│   └── api-server/
└── scripts/
    ├── deploy.sh
    └── rollback.sh
```

### 3. Application設定

```yaml
# argocd-applications.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web-app-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/mycompany/k8s-gitops
    targetRevision: main
    path: environments/production/applications/web-app
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

## 🔧 実践演習

### 演習1: 本番環境クラスター構築

```bash
# 1. Terraform環境準備
git clone https://github.com/mycompany/k8s-terraform
cd k8s-terraform/environments/production

# 2. 変数ファイル編集
cp terraform.tfvars.example terraform.tfvars
# 環境固有の値を設定

# 3. インフラ構築
terraform init
terraform plan
terraform apply

# 4. kubectl設定
aws eks update-kubeconfig --region us-west-2 --name k8s-production

# 5. アドオンインストール
./scripts/install-addons.sh
```

### 演習2: 監視システム構築

```bash
# 1. 監視スタックデプロイ
helm install prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml

# 2. ダッシュボード設定
kubectl apply -f monitoring/dashboards/

# 3. アラート設定
kubectl apply -f monitoring/alerts/production-alerts.yaml

# 4. 動作確認
kubectl port-forward -n monitoring svc/prometheus-stack-grafana 3000:80
# http://localhost:3000 でアクセス
```

### 演習3: 災害復旧テスト

```bash
# 1. データベースバックアップ作成
velero backup create db-backup --include-namespaces production --selector app=postgres

# 2. 模擬障害発生
kubectl delete namespace production

# 3. バックアップから復旧
velero restore create db-restore --from-backup db-backup

# 4. 復旧確認
kubectl get pods -n production
kubectl exec -n production deployment/postgres -- psql -U user -d myapp -c "\dt"
```

## 📚 ベストプラクティス

### 1. 本番運用チェックリスト

#### デプロイ前確認
- [ ] リソース制限が設定済み
- [ ] ヘルスチェックが実装済み
- [ ] 監視・アラートが設定済み
- [ ] バックアップが設定済み
- [ ] ロールバック手順が確認済み

#### セキュリティ確認
- [ ] Pod Security Standardsが適用済み
- [ ] NetworkPolicyが設定済み
- [ ] RBAC権限が最小権限
- [ ] Secretが暗号化済み
- [ ] イメージスキャンが実行済み

#### パフォーマンス確認
- [ ] リソース使用量が適切
- [ ] ノードオートスケールが機能
- [ ] ロードバランシングが均等
- [ ] レスポンス時間がSLA以内

### 2. 運用自動化

```yaml
# chaos-engineering.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: production-chaos
  namespace: production
spec:
  appinfo:
    appns: production
    applabel: "app=web-app"
  chaosServiceAccount: chaos-sa
  experiments:
  - name: pod-delete
    spec:
      components:
        env:
        - name: TOTAL_CHAOS_DURATION
          value: "30"
        - name: CHAOS_INTERVAL
          value: "10"
        - name: FORCE
          value: "false"
```

---

**AWS ECS管理者へのアドバイス**: 
本番環境構築は段階的なアプローチが重要です。まずは小規模な環境で基本構成を確立し、監視・ログ・バックアップの基盤を整えてから、徐々にスケールアップしていくことをお勧めします。ECSでの運用経験を活かし、Infrastructure as CodeとGitOpsの考え方を取り入れることで、より確実で再現性の高い本番環境を構築できます。
