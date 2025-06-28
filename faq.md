# Kubernetes学習 FAQ

このFAQは、AWS ECS管理者がKubernetesを学習する際によくある質問と回答をまとめたものです。

## 📋 目次

1. [ログとサービス関連](#ログとサービス関連)
2. [ネットワークとアクセス](#ネットワークとアクセス)
3. [DeploymentとService](#deploymentとservice)
4. [Namespace管理](#namespace管理)
5. [ポートバインディング](#ポートバインディング)
6. [ノード管理](#ノード管理)
7. [メトリクス監視](#メトリクス監視)

## ログとサービス関連

### Q1: kubectlでservicesのログをみる方法は？

**A:** Kubernetesでは「サービス」自体にはログがありません。サービスに関連するPodのログを確認します。

```bash
# 基本的なPodのログ確認
kubectl logs [Pod名]

# ラベルセレクターでPodを選択してログ確認
kubectl logs -l app=nginx

# リアルタイムでログを監視
kubectl logs -f [Pod名]

# サービスに関連するPodを特定してログ確認
kubectl get pods -l app=nginx
kubectl logs -l app=nginx
```

**参考ガイド:** `/guides/04-service-logs.md`

---

## ネットワークとアクセス

### Q2: nginx-serviceのEXTERNAL IPがpendingのまま停止している場合の対処法は？

**A:** Minikube環境でLoadBalancerタイプのサービスを使用する場合、`minikube tunnel`が必要です。

```bash
# minikube tunnelを起動（別ターミナルで）
minikube tunnel

# サービス状態確認
kubectl get services
# EXTERNAL-IP が 127.0.0.1 になることを確認

# アクセステスト
curl http://127.0.0.1
```

**重要:** 
- `minikube tunnel`はプロンプトが返ってこないのが正常動作
- トンネルを維持するためのプロセスが継続実行される
- 停止するには `Ctrl+C`

**参考ガイド:** `/guides/05-minikube-tunnel.md`

---

## DeploymentとService

### Q3: deploymentとserviceを関連付けるにはどうするのですか？

**A:** **ラベルセレクター**を使って関連付けを行います。

#### Deployment側（Pod template）
```yaml
template:
  metadata:
    labels:
      app: nginx    # ← Podに付与されるラベル
```

#### Service側
```yaml
selector:
  app: nginx        # ← このラベルを持つPodを選択
```

#### 関連付けの確認方法
```bash
# Podのラベルを確認
kubectl get pods --show-labels

# Serviceのセレクターを確認
kubectl get service [service-name] -o wide

# エンドポイント（実際の接続先Pod）を確認
kubectl get endpoints [service-name]
```

**参考ガイド:** `/guides/06-deployment-service-connection.md`

---

## Namespace管理

### Q4: Namespaceで1クラスタの中に複数environment(dev, stg, prod)を内包するメリットはありますか？

**A:** メリット・デメリットがあり、要件に応じて選択する必要があります。

#### 🟢 メリット
- **コスト効率**: 単一クラスターの運用コスト
- **運用の一元化**: 統一された管理インターフェース
- **リソース共有**: ノード、ストレージの効率的利用
- **開発効率**: マニフェストの再利用、迅速な環境構築

#### 🔴 デメリット
- **セキュリティリスク**: 同一カーネル空間での分離
- **障害波及**: ノードレベル障害が全環境に影響
- **リソース競合**: 環境間でのリソース奪い合い
- **スケーラビリティ制限**: 単一クラスターの限界

#### 推奨使用ケース
| 環境規模 | セキュリティ要件 | 推奨アプローチ |
|----------|------------------|----------------|
| **小規模** | 低〜中 | ✅ Namespace分離 |
| **中規模** | 中〜高 | ⚠️ ハイブリッド（本番のみ分離） |
| **大規模** | 高 | ✅ 完全クラスター分離 |

**参考ガイド:** `/guides/07-namespace-multi-environment.md`

---

## ポートバインディング

### Q5: minikubeで8080ポートをbindする方法は？

**A:** 複数の方法があります。用途に応じて選択してください。

#### 方法1: kubectl port-forward（推奨・最も簡単）
```bash
# サービスに対してポートフォワード
kubectl port-forward service/[サービス名] 8080:8080

# 例
kubectl port-forward service/webapp-8080-service 8080:8080
# → http://localhost:8080 でアクセス可能
```

#### 方法2: LoadBalancer + minikube tunnel
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp-8080-service
spec:
  selector:
    app: webapp-8080
  ports:
  - port: 8080
    targetPort: 80
  type: LoadBalancer
```

```bash
# tunnel起動後
minikube tunnel
# → http://127.0.0.1:8080 でアクセス可能
```

#### 方法3: minikube service コマンド
```bash
# ランダムポートでURLを取得
minikube service webapp-8080-service --url
```

#### 使い分け
| 方法 | 簡単さ | 永続性 | 複数接続 | 推奨用途 |
|------|--------|--------|----------|----------|
| **port-forward** | ⭐⭐⭐ | ❌ | ❌ | 開発・デバッグ |
| **LoadBalancer + tunnel** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | デモ・共有 |
| **minikube service** | ⭐⭐⭐ | ⭐ | ⭐⭐ | 迅速なテスト |

**参考ガイド:** `/guides/08-minikube-port-binding.md`

---

## ノード管理

### Q6: kubectlでAWS EKSのnode一覧を見れる理由はなぜですか？

**A:** Kubernetesの**API-driven architecture**とAWS EKSの**managed control plane**の仕組みによるものです。

#### 基本的な流れ
1. **kubectl** → **kube-apiserver** : `GET /api/v1/nodes` リクエスト
2. **kube-apiserver** → **etcd** : ノード情報の取得
3. **etcd** → **kube-apiserver** : ノード情報の返却
4. **kube-apiserver** → **kubectl** : JSON形式でノード一覧を応答

#### EKSでのNodeの管理プロセス
1. **EC2インスタンス起動**: Auto Scaling GroupまたはNode Groupで起動
2. **kubeletの起動**: EC2インスタンス内でkubeletが起動
3. **クラスターへの参加**: kubeletがEKS APIサーバーに接続
4. **Node登録**: kubeletがNodeリソースをkube-apiserverに登録
5. **継続的な通信**: HeartbeatとStatus更新を定期的に送信

#### 認証の仕組み
```yaml
# ~/.kube/config (EKS)
server: https://EXAMPLE.yl4.us-west-2.eks.amazonaws.com
user:
  exec:
    command: aws
    args: ["eks", "get-token", "--cluster-name", "my-cluster"]
```

**キーポイント:**
- kubectlは標準的なKubernetes APIクライアント
- EKSはマネージドなKubernetes APIサーバーを提供
- AWS IAMとKubernetes RBACが統合されている

**参考ガイド:** `/guides/09-kubectl-eks-nodes.md`

---

## メトリクス監視

### Q7: "Metrics API not available" エラーが発生します

**A:** metrics-serverが無効または正しく動作していないことが原因です。

#### 確認方法
```bash
# minikubeの場合
minikube addons list | grep metrics-server

# 一般的なクラスターの場合
kubectl get pods -n kube-system | grep metrics
```

#### 解決方法: minikube環境
```bash
# metrics-serverアドオンを有効化
minikube addons enable metrics-server

# 起動確認（1-2分待つ）
kubectl get pods -n kube-system | grep metrics
# 期待する出力: metrics-server-xxx    1/1     Running   0    4m24s
```

#### 動作確認
```bash
# ノードのリソース使用量
kubectl top nodes

# Podのリソース使用量
kubectl top pods

# 全namespaceのPod
kubectl top pods --all-namespaces

# メモリ使用量でソート
kubectl top pods --all-namespaces --sort-by=memory

# CPU使用量でソート
kubectl top pods --all-namespaces --sort-by=cpu
```

#### よくある問題
- **"no metrics to serve"**: メトリクス収集がまだ開始されていない → 2-3分待つ
- **TLS証明書エラー**: 開発環境でよくある → `--kubelet-insecure-tls`フラグを追加
- **権限不足**: Metrics APIへのアクセス権限がない → RBAC設定を確認

**参考ガイド:** `/guides/10-metrics-api-troubleshooting.md`

---

## 💡 追加のTips

### AWS ECSとKubernetesの主な違い

| 機能 | AWS ECS | Kubernetes |
|------|---------|------------|
| **サービス発見** | ECS Service Discovery | DNS + Service |
| **ロードバランサー** | ALB/NLB | Service (LoadBalancer/ClusterIP) |
| **ログ確認** | `aws logs tail` | `kubectl logs` |
| **メトリクス監視** | CloudWatch | `kubectl top` + metrics-server |
| **スケーリング** | Auto Scaling | HPA/VPA |
| **デプロイ戦略** | ECS Service更新 | Rolling Update |
| **設定管理** | Systems Manager | ConfigMap/Secret |
| **ネットワーク分離** | Security Group | NetworkPolicy |

### 学習リソース

1. **基本ガイド**
   - `/guides/01-kubernetes-basics.md` - Kubernetes基礎
   - `/guides/02-ecs-vs-kubernetes.md` - ECSとの比較
   - `/guides/03-development-setup.md` - 開発環境構築

2. **実践ガイド**
   - `/examples/` - 実際に使えるYAMLファイル
   - `/hands-on/` - ハンズオン演習

3. **トラブルシューティング**
   - このFAQ文書
   - 各ガイドのトラブルシューティングセクション

### よく使うコマンド一覧

```bash
# 基本的な状態確認
kubectl get pods --all-namespaces
kubectl get services
kubectl get nodes
kubectl top pods --all-namespaces

# デバッグ・ログ確認
kubectl describe pod [pod-name]
kubectl logs -f [pod-name]
kubectl exec -it [pod-name] -- /bin/bash

# ネットワーク・接続確認
kubectl port-forward service/[service-name] 8080:80
minikube service [service-name] --url
minikube tunnel

# リソース管理
kubectl apply -f [yaml-file]
kubectl delete -f [yaml-file]
kubectl get events --sort-by='.lastTimestamp'
```

---

## 🆘 サポート

質問や問題が発生した場合：

1. **まず確認**: 該当するガイド文書を確認
2. **基本コマンド**: `kubectl get pods`, `kubectl describe`, `kubectl logs`で状況確認
3. **コミュニティ**: Kubernetes公式ドキュメント、Stack Overflow
4. **実践**: hands-onフォルダの演習で理解を深める

このFAQは継続的に更新され、新しい質問と回答が追加されます。
