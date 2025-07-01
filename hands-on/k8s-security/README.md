# Kubernetesセキュリティ演習環境

## 概要

このディレクトリには、AWS ECS管理者がKubernetesのセキュリティ対策を学習するための実践的な演習環境が含まれています。理論学習は [`/guides/13-kubernetes-security-comprehensive.md`](../../guides/13-kubernetes-security-comprehensive.md) を参照してください。

## 演習の構成

### Phase 1: RBAC（Role-Based Access Control）基礎
- **対象**: ServiceAccount、Role、RoleBinding、ClusterRole の理解
- **AWS ECS比較**: ECS Task Role vs K8s ServiceAccount
- **実践内容**: 
  - 最小権限の原則に基づくアクセス制御
  - Namespace レベルとクラスターレベルの権限管理
  - kubectl コマンドでの権限テスト

### Phase 2: Pod Security Standards
- **対象**: Pod Security Policy → Pod Security Standards への移行
- **AWS ECS比較**: ECS Task Security vs K8s Pod Security
- **実践内容**:
  - Privileged、Baseline、Restricted レベルの理解
  - securityContext の適切な設定
  - 非特権コンテナの実行

### Phase 3: ネットワークセキュリティ (NetworkPolicy)
- **対象**: Kubernetes内でのネットワーク分離
- **AWS ECS比較**: VPC Security Group vs K8s NetworkPolicy
- **実践内容**:
  - Ingress/Egress ルールの設定
  - Namespace間通信の制御
  - 外部通信の制限

### Phase 4: Secrets管理とデータ保護
- **対象**: 機密データの安全な管理
- **AWS ECS比較**: AWS Secrets Manager vs K8s Secrets
- **実践内容**:
  - etcd暗号化の設定
  - Secrets の適切な使用方法
  - 外部シークレット管理ツールとの連携

### Phase 5: セキュリティスキャンと監査
- **対象**: 継続的なセキュリティチェック
- **AWS ECS比較**: ECR Image Scanning vs K8s Security Scanning
- **実践内容**:
  - 脆弱性スキャンツールの導入
  - セキュリティ監査ログの分析
  - CIS Benchmarks への対応

## 前提条件

### 必要なツール
```bash
# Kubernetes クラスター (minikube推奨)
minikube version

# kubectl コマンド
kubectl version --client

# 演習用セキュリティツール (演習中にインストール)
# - falco (Runtime Security)
# - trivy (Vulnerability Scanner)
# - kube-bench (CIS Benchmark)
```

### 推奨知識
- Kubernetes基礎 (`/guides/01-kubernetes-basics.md`)
- ECS vs Kubernetes (`/guides/02-ecs-vs-kubernetes.md`)
- 開発環境セットアップ (`/guides/03-development-setup.md`)

## クイックスタート

### 1. 環境のセットアップ
```bash
# このディレクトリに移動
cd /mnt/c/dev/k8s/hands-on/k8s-security

# セットアップスクリプトの実行
./scripts/setup.sh

# 環境チェック
./scripts/check-environment.sh
```

### 2. 演習の進行

#### Phase 1から順番に実行することを推奨
```bash
# Phase 1: RBAC演習
cd phase1
kubectl apply -f .
./test-rbac.sh

# Phase 2: Pod Security演習
cd ../phase2
kubectl apply -f .
./test-pod-security.sh

# 以下、Phase 3-5も同様に実行
```

## 各Phaseのディレクトリ構造

```
phase1-rbac/
├── README.md                 # Phase 1の詳細説明
├── 01-serviceaccount.yaml    # ServiceAccount 定義
├── 02-role.yaml              # Role 定義
├── 03-rolebinding.yaml       # RoleBinding 定義
├── 04-test-pod.yaml          # 権限テスト用Pod
└── test-rbac.sh              # 自動テストスクリプト

phase2-pod-security/
├── README.md                 # Phase 2の詳細説明
├── 01-namespace-pss.yaml     # Pod Security Standards設定
├── 02-secure-pod.yaml        # セキュアなPod設定例
├── 03-insecure-pod.yaml      # 非セキュアなPod例（エラー確認用）
└── test-pod-security.sh      # 自動テストスクリプト

phase3-network-policy/
├── README.md                 # Phase 3の詳細説明
├── 01-frontend-app.yaml      # フロントエンドアプリ
├── 02-backend-app.yaml       # バックエンドアプリ
├── 03-database.yaml          # データベース
├── 04-network-policy.yaml    # NetworkPolicy設定
└── test-network-policy.sh    # ネットワーク分離テスト

phase4-secrets/
├── README.md                 # Phase 4の詳細説明
├── 01-secret-basic.yaml      # 基本的なSecret
├── 02-secret-tls.yaml        # TLS証明書用Secret
├── 03-app-with-secret.yaml   # Secretを使用するアプリ
├── 04-external-secrets.yaml  # 外部シークレット管理例
└── test-secrets.sh           # Secrets管理テスト

phase5-security-scan/
├── README.md                 # Phase 5の詳細説明
├── 01-vulnerable-app.yaml    # 脆弱性テスト用アプリ
├── 02-falco-config.yaml      # Falco設定
├── 03-monitoring.yaml        # セキュリティ監視設定
└── run-security-scan.sh      # セキュリティスキャン実行
```

## 演習用アプリケーション

`apps/` ディレクトリには、各Phase で使用するサンプルアプリケーションが含まれています：

- **web-app**: セキュリティテスト用シンプルなWebアプリ
- **api-server**: RBAC テスト用APIサーバー
- **database**: ネットワーク分離テスト用DB

## トラブルシューティング

### よくある問題と解決方法

#### 1. RBAC権限エラー
```bash
# 現在のユーザーの権限確認
kubectl auth can-i --list

# ServiceAccountの権限確認
kubectl auth can-i --list --as=system:serviceaccount:default:my-sa
```

#### 2. NetworkPolicy が機能しない
```bash
# CNIプラグインがNetworkPolicy対応か確認
kubectl get nodes -o wide
minikube addons list | grep network

# Calico CNI有効化（minikube）
minikube addons enable calico
```

#### 3. Pod Security Standards エラー
```bash
# Namespace の Pod Security Standards確認
kubectl get namespace -o yaml | grep pod-security

# Pod のセキュリティコンテキスト確認
kubectl describe pod <pod-name>
```

## 参考資料

### 公式ドキュメント
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)

### セキュリティツール
- [Falco - Runtime Security](https://falco.org/)
- [Trivy - Vulnerability Scanner](https://trivy.dev/)
- [kube-bench - CIS Kubernetes Benchmark](https://github.com/aquasecurity/kube-bench)
- [kube-hunter - Penetration Testing](https://github.com/aquasecurity/kube-hunter)

### AWS ECS対応表
| AWS ECS | Kubernetes | 演習Phase |
|---------|------------|-----------|
| Task Role | ServiceAccount | Phase 1 |
| Task Security Group | NetworkPolicy | Phase 3 |
| Secrets Manager | Secrets | Phase 4 |
| ECR Scanning | Image Scanning | Phase 5 |
| CloudTrail | Audit Logs | Phase 5 |

## 次のステップ

1. **本番環境適用**: EKS でのセキュリティ設定
2. **CI/CD統合**: セキュリティチェックの自動化
3. **コンプライアンス**: SOC2、HIPAA等への対応
4. **高度なセキュリティ**: Service Mesh (Istio) セキュリティ

演習完了後は、実際のEKSクラスターでの適用を検討してください。
