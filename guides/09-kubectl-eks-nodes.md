# kubectlでAWS EKSのnode一覧を見ることができる理由

## 概要

`kubectl get nodes`コマンドでAWS EKSのnode一覧を確認できるのは、Kubernetesの**API-driven architecture**とAWS EKSの**managed control plane**の仕組みによるものです。

## 🏗️ Kubernetesの基本アーキテクチャ

### Control Plane と Worker Node の関係
```
┌─────────────────────────────────────┐
│          Control Plane             │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   kube-api  │  │    etcd     │  │
│  │   server    │  │             │  │
│  │             │  │             │  │
│  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  │
│  │  scheduler  │  │ controller  │  │
│  │             │  │  manager    │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
             │
             │ API通信
             ▼
┌─────────────────────────────────────┐
│         Worker Nodes               │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   kubelet   │  │   kubelet   │  │
│  │   Node 1    │  │   Node 2    │  │
│  │             │  │             │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### kubectlとkube-apiserverの通信フロー
1. **kubectl** → **kube-apiserver** : `GET /api/v1/nodes` リクエスト
2. **kube-apiserver** → **etcd** : ノード情報の取得
3. **etcd** → **kube-apiserver** : ノード情報の返却
4. **kube-apiserver** → **kubectl** : JSON形式でノード一覧を応答

## 🔧 AWS EKSの仕組み

### EKSの構成要素
```
┌─────────────────────────────────────┐
│         AWS EKS Service            │
│  ┌─────────────────────────────────┐│
│  │      Managed Control Plane     ││
│  │  ┌─────────────┐               ││
│  │  │ kube-api    │ ← kubectlが   ││
│  │  │ server      │   接続する点  ││
│  │  │             │               ││
│  │  └─────────────┘               ││
│  │  ┌─────────────┐               ││
│  │  │    etcd     │               ││
│  │  │ (managed)   │               ││
│  │  └─────────────┘               ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
             │
             │ VPC内通信
             ▼
┌─────────────────────────────────────┐
│         EC2 Instances              │
│         (Worker Nodes)             │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   kubelet   │  │   kubelet   │  │
│  │   Node 1    │  │   Node 2    │  │
│  │             │  │             │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### EKSでのNodeの管理プロセス
1. **EC2インスタンス起動**: Auto Scaling GroupまたはNode Groupで起動
2. **kubeletの起動**: EC2インスタンス内でkubeletが起動
3. **クラスターへの参加**: kubeletがEKS APIサーバーに接続
4. **Node登録**: kubeletがNodeリソースをkube-apiserverに登録
5. **継続的な通信**: HeartbeatとStatus更新を定期的に送信

## 🔍 実際の動作確認

### 現在のMinikube環境でのNode確認
```bash
# Nodeの一覧表示
kubectl get nodes

# 詳細な情報を表示
kubectl get nodes -o wide

# 特定のNodeの詳細
kubectl describe node minikube
```

### EKS環境でのNode確認例
```bash
# EKSクラスターに接続
aws eks update-kubeconfig --region us-west-2 --name my-cluster

# EKSのNode一覧確認
kubectl get nodes
# NAME                                           STATUS   ROLES    AGE   VERSION
# ip-10-0-1-234.us-west-2.compute.internal     Ready    <none>   7d    v1.24.7-eks-fb459a0
# ip-10-0-2-123.us-west-2.compute.internal     Ready    <none>   7d    v1.24.7-eks-fb459a0

# AWSのEC2インスタンスと照合
aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,PrivateDnsName,State.Name]' --output table
```

## 🛠️ kubectlの認証・認可の仕組み

### 認証 (Authentication)
```yaml
# ~/.kube/config の例
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: [BASE64-ENCODED-CERT]
    server: https://EXAMPLE.yl4.us-west-2.eks.amazonaws.com
  name: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
contexts:
- context:
    cluster: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
    user: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
  name: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
current-context: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
users:
- name: arn:aws:eks:us-west-2:123456789012:cluster/my-cluster
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args:
      - eks
      - get-token
      - --cluster-name
      - my-cluster
      - --region
      - us-west-2
```

### 認可 (Authorization)
```yaml
# RBAC設定例
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-reader-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: node-reader
subjects:
- kind: User
  name: my-user
  apiGroup: rbac.authorization.k8s.io
```

## 🔄 Nodeの状態管理

### kubeletからAPIサーバーへの通信
```bash
# kubeletのログを確認（EKSのworker nodeで）
sudo journalctl -u kubelet.service -f

# 例：
# kubelet[1234]: I0625 10:30:00.123456 1234 node.go:123] Successfully registered node ip-10-0-1-234.us-west-2.compute.internal
# kubelet[1234]: I0625 10:30:00.123456 1234 node_status.go:456] Updating node status
```

### Node Status の更新頻度
```yaml
# kubeletの設定例
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
nodeStatusUpdateFrequency: "10s"    # Nodeステータスの更新間隔
nodeStatusReportFrequency: "1m"     # Nodeステータスレポートの間隔
```

## 🌐 ネットワーク経由でのアクセス

### EKS APIエンドポイントへのアクセス
```bash
# EKS APIサーバーのエンドポイント確認
aws eks describe-cluster --name my-cluster --query 'cluster.endpoint'

# 直接APIサーバーへのアクセス例
curl -k -H "Authorization: Bearer $(aws eks get-token --cluster-name my-cluster --query 'status.token' --output text)" \
  https://EXAMPLE.yl4.us-west-2.eks.amazonaws.com/api/v1/nodes
```

### セキュリティグループとVPCの設定
```bash
# EKSクラスターのセキュリティグループ確認
aws eks describe-cluster --name my-cluster --query 'cluster.resourcesVpcConfig.securityGroupIds'

# APIサーバーアクセス可能なセキュリティグループ設定
aws ec2 describe-security-groups --group-ids sg-0123456789abcdef0
```

## 🔐 IAMとKubernetesの統合

### aws-iam-authenticatorの動作
```bash
# AWSクレデンシャルを使用してKubernetesトークンを取得
aws eks get-token --cluster-name my-cluster

# 返却されるトークンの例
{
  "kind": "ExecCredential",
  "apiVersion": "client.authentication.k8s.io/v1beta1",
  "spec": {},
  "status": {
    "expirationTimestamp": "2025-06-25T12:00:00Z",
    "token": "k8s-aws-v1.EXAMPLE_TOKEN_HERE"
  }
}
```

### IAMロールとKubernetesのマッピング
```yaml
# aws-auth ConfigMapの例
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: arn:aws:iam::123456789012:role/NodeInstanceRole
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers
        - system:nodes
  mapUsers: |
    - userarn: arn:aws:iam::123456789012:user/my-user
      username: my-user
      groups:
        - system:masters
```

## 🔍 AWS ECSとの違い

| 項目 | AWS ECS | AWS EKS |
|------|---------|---------|
| **ノード管理** | ECS Agent経由 | kubelet経由 |
| **APIアクセス** | AWS API | Kubernetes API |
| **ノード一覧** | `aws ecs list-container-instances` | `kubectl get nodes` |
| **認証方式** | AWS IAM | AWS IAM + Kubernetes RBAC |
| **ログ確認** | CloudWatch Logs | `kubectl logs` |

### ECSでのインスタンス確認例
```bash
# ECSクラスターのインスタンス一覧
aws ecs list-container-instances --cluster my-cluster

# 詳細情報
aws ecs describe-container-instances --cluster my-cluster --container-instances [instance-arn]

# 対応するEC2インスタンス
aws ec2 describe-instances --instance-ids [instance-id]
```

## 🎯 まとめ

### kubectlでEKSのnode一覧を見ることができる理由

1. **標準的なKubernetes API**: EKSは標準的なKubernetes APIを提供
2. **kubeletの自動登録**: Worker NodeのkubeletがAPIサーバーにNodeリソースを登録
3. **AWS認証統合**: IAMクレデンシャルを使用してKubernetes APIにアクセス
4. **RBAC権限**: 適切な権限があればNodeリソースを参照可能
5. **ネットワーク接続**: VPC内またはパブリックエンドポイント経由でアクセス

### キーポイント
- **kubectlはKubernetes APIの標準クライアント**
- **EKSはマネージドなKubernetes APIサーバーを提供**
- **Worker NodeはEC2インスタンスだが、kubeletによりKubernetesクラスターに参加**
- **AWS IAMとKubernetes RBACが統合されている**

この仕組みにより、kubectlという単一のツールで、オンプレミス、クラウド、ローカル環境を問わず、すべてのKubernetesクラスターを統一的に管理できるのです。

## 🔧 実践的な確認方法

### 1. 現在の環境でのNode確認
```bash
# 基本的なNode情報
kubectl get nodes

# 詳細情報
kubectl get nodes -o yaml

# 特定のNode詳細
kubectl describe node [NODE_NAME]
```

### 2. Node上で実行されているPodの確認
```bash
# 特定のNode上のPod一覧
kubectl get pods --all-namespaces --field-selector spec.nodeName=[NODE_NAME]

# Node上のPodリソース使用量
kubectl top pod --all-namespaces --sort-by=cpu
```

### 3. Nodeの状態監視
```bash
# リアルタイムでNode状態を監視
watch kubectl get nodes

# Nodeの詳細なシステム情報
kubectl get nodes -o json | jq '.items[].status.nodeInfo'
```

これらの確認を通じて、KubernetesのNode管理の仕組みを理解し、AWS EKSでの実際の運用に備えることができます。
