# Phase 3: NetworkPolicy ネットワークセキュリティ演習

## 概要

この演習では、Kubernetes NetworkPolicy について学習します。AWS ECSのSecurity Groupsと比較しながら、Kubernetesでのネットワークレベルのセキュリティ制御を理解しましょう。

## 学習目標

1. **NetworkPolicy**の基本概念と設定方法
2. **Ingress/Egress**ルールの理解
3. **Namespace間通信制御**の実装
4. **外部通信制限**の設定
5. AWS VPC Security Groups との比較理解

## AWS ECS vs Kubernetes NetworkPolicy比較

| ネットワーク制御 | AWS ECS | Kubernetes |
|-----------------|---------|------------|
| アクセス制御 | Security Groups | NetworkPolicy |
| 適用範囲 | ENI/EC2インスタンス | Pod/Namespace |
| ルール方向 | Inbound/Outbound | Ingress/Egress |
| プロトコル | TCP/UDP/ICMP | TCP/UDP/SCTP |
| ポート指定 | Port Range | Port/TargetPort |
| 送信元/宛先 | CIDR/SG/PrefixList | podSelector/namespaceSelector |

## NetworkPolicy の基本概念

### 1. Ingress (受信) ルール
- **目的**: Pod への受信トラフィック制御
- **AWS対応**: Security Group Inbound Rules
- **設定**: 送信元Pod/Namespace + ポート指定

### 2. Egress (送信) ルール  
- **目的**: Pod からの送信トラフィック制御
- **AWS対応**: Security Group Outbound Rules
- **設定**: 宛先Pod/Namespace + ポート指定

### 3. Pod/Namespace セレクター
- **podSelector**: 特定のPodを対象
- **namespaceSelector**: 特定のNamespaceを対象
- **AWS対応**: Security Group ID指定

## 実践演習の流れ

### 1. 演習用アプリケーションのデプロイ
```bash
kubectl apply -f 01-apps.yaml
```

### 2. NetworkPolicy設定
```bash
kubectl apply -f 02-network-policy.yaml
```

### 3. ネットワーク分離テスト
```bash
./test-network-policy.sh
```

## 演習シナリオ

### シナリオ: 3層Webアプリケーションのネットワーク分離

AWS ECSで運用していた3層アーキテクチャをKubernetesに移行する際の、ネットワークセキュリティ設計を学習します。

```
Internet
    ↓
┌─────────────┐
│ Frontend    │ ← LoadBalancer経由のみアクセス許可
│ (Nginx)     │
└─────────────┘
    ↓ 8080
┌─────────────┐
│ Backend     │ ← Frontendからのみアクセス許可
│ (API Server)│
└─────────────┘
    ↓ 5432
┌─────────────┐
│ Database    │ ← Backendからのみアクセス許可
│ (PostgreSQL)│
└─────────────┘
```

**セキュリティ要件:**
- Frontend: インターネットから80/443ポートのみ
- Backend: Frontend からの8080ポートのみ  
- Database: Backend からの5432ポートのみ
- 各層間での不要な通信は全て拒否

## 重要なNetworkPolicy設定パターン

### 1. 基本的なIngress制御
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
```

### 2. Namespace間通信制御
```yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        name: frontend-ns
    podSelector:
      matchLabels:
        app: frontend
```

### 3. 外部通信制限（Egress）
```yaml
policyTypes:
- Egress
egress:
- to: []
  ports:
  - protocol: TCP
    port: 53  # DNS許可
  - protocol: UDP
    port: 53  # DNS許可
- to:
  - podSelector:
      matchLabels:
        app: database
  ports:
  - protocol: TCP
    port: 5432
```

### 4. デフォルト拒否ポリシー
```yaml
# 全ての受信通信を拒否
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}  # 全てのPodに適用
  policyTypes:
  - Ingress
```

## CNI (Container Network Interface) 要件

### NetworkPolicy対応CNI
- **Calico** ✅ (推奨)
- **Cilium** ✅ 
- **Weave Net** ✅
- **Flannel** ❌ (NetworkPolicy未対応)

### minikube での設定
```bash
# Calico CNI有効化
minikube addons enable calico

# 設定確認
kubectl get pods -n kube-system | grep calico
```

## NetworkPolicy デバッグ方法

### 1. NetworkPolicy確認
```bash
# NetworkPolicy一覧
kubectl get networkpolicy --all-namespaces

# 詳細確認
kubectl describe networkpolicy <policy-name> -n <namespace>
```

### 2. Pod間通信テスト
```bash
# Pod AからPod Bへの通信テスト
kubectl exec -it <pod-a> -- nc -zv <pod-b-ip> <port>

# DNS解決テスト
kubectl exec -it <pod-a> -- nslookup <service-name>
```

### 3. ネットワーク分析
```bash
# Pod IP確認
kubectl get pods -o wide

# Service確認
kubectl get services

# Endpoints確認  
kubectl get endpoints
```

## ベストプラクティス

### 1. 段階的なNetworkPolicy適用
```bash
# Step 1: ログのみで影響確認
# まずdefault-deny-ingressを適用してログ確認

# Step 2: 必要な通信を個別に許可
# アプリケーション動作確認しながら徐々に制限強化

# Step 3: Egressルール追加
# 外部通信制限を段階的に適用
```

### 2. NetworkPolicy設計パターン

#### マイクロサービス分離パターン
```yaml
# 各サービス専用のNetworkPolicy
- frontend-policy.yaml
- backend-policy.yaml  
- database-policy.yaml
```

#### 環境別分離パターン
```yaml
# Namespace間通信制御
- dev-to-shared-policy.yaml
- prod-isolation-policy.yaml
```

#### コンプライアンス対応パターン
```yaml
# 金融・医療業界向け
- pci-dss-network-policy.yaml
- hipaa-network-policy.yaml
```

### 3. モニタリングとログ

#### ネットワーク通信ログ
```bash
# Calico ログ確認
kubectl logs -n kube-system -l k8s-app=calico-node

# NetworkPolicy違反ログ
kubectl get events --field-selector reason=NetworkPolicyViolation
```

#### 通信フロー可視化
- **Calico Enterprise**: GUI での可視化
- **Cilium Hubble**: ネットワークフロー観測
- **Istio Kiali**: Service Mesh 可視化

## トラブルシューティング

### よくある問題と解決方法

#### 1. NetworkPolicyが効かない
```bash
# CNIプラグイン確認
kubectl get nodes -o wide
minikube addons list | grep calico

# NetworkPolicy対応確認
kubectl get crd | grep networkpolicy
```

#### 2. DNS解決ができない
```yaml
# DNS通信を明示的に許可
egress:
- to: []
  ports:
  - protocol: TCP
    port: 53
  - protocol: UDP
    port: 53
```

#### 3. Service間通信ができない
```bash
# Service IP とPod IP の確認
kubectl get svc
kubectl get pods -o wide
kubectl get endpoints

# NetworkPolicy の適用対象確認
kubectl get networkpolicy -o wide
```

## セキュリティ検証

### 1. ネットワーク分離テスト
```bash
# 許可された通信の確認
kubectl exec frontend-pod -- curl backend-service:8080/health

# 拒否される通信の確認（タイムアウトで確認）
kubectl exec frontend-pod -- timeout 5 curl database-service:5432
```

### 2. 侵入テストシナリオ
```bash
# 攻撃者がfrontend podを乗っ取った場合
kubectl exec frontend-pod -- nmap database-service

# 内部ネットワーク探索の防止確認
kubectl exec frontend-pod -- curl internal-admin-service
```

## 次のPhase への準備

Phase 3完了後、以下を確認してください：

1. ✅ NetworkPolicy の基本概念理解
2. ✅ Ingress/Egress ルールの設定方法
3. ✅ AWS Security Groups との違いの理解
4. ✅ ネットワーク分離の動作確認

**次のPhase**: Secrets管理とデータ保護

## 参考資料

- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Calico Network Policy](https://docs.projectcalico.org/security/calico-network-policy)
- [AWS VPC Security Groups](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html)
- [Kubernetes Network Model](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
