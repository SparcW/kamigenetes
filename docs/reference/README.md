# 📚 リファレンス - Kubernetes技術資料集

Kubernetes運用に必要な技術仕様、コマンドリファレンス、設定例をまとめた包括的な資料集です。AWS ECS経験者が効率的にKubernetesを習得・運用できるよう、実践的な参考情報を提供します。

## 📖 リファレンス構成

### 🔧 [API リファレンス](./api/)
Kubernetes APIの詳細仕様と使用例

- **Core API (v1)** - Pod、Service、Namespace等の基本リソース
- **Apps API (apps/v1)** - Deployment、ReplicaSet、StatefulSet等
- **Networking API** - Ingress、NetworkPolicy、EndpointSlice等
- **Storage API** - PersistentVolume、StorageClass等
- **カスタムリソース** - CRD、カスタムコントローラー

### 💻 [CLI リファレンス](./cli/)
主要コマンドラインツールの使用方法

- **kubectl** - Kubernetesクラスター操作
- **helm** - Kubernetesパッケージ管理
- **kustomize** - 設定ファイル管理
- **kubeadm** - クラスター構築・管理
- **kind/minikube** - ローカル開発環境

### ⚙️ [設定ファイル](./config-files/)
YAML設定ファイルのテンプレートとベストプラクティス

- **Deployment設定** - アプリケーションデプロイメント
- **Service設定** - ネットワーク・アクセス制御
- **ConfigMap/Secret** - 設定・機密情報管理
- **Ingress設定** - 外部アクセス制御
- **Security設定** - RBAC、Pod Security、Network Policy

### 📝 [用語集](./glossary.md)
Kubernetes用語とAWS ECS対応表

- **基本概念の対応関係**
- **技術用語の定義**
- **AWS ECSからの移行マッピング**

## 🎯 リファレンスの使い方

### クイックリファレンス
日常的によく使用するコマンドとAPIの一覧

```bash
# よく使用するkubectlコマンド
kubectl get pods --all-namespaces
kubectl describe pod [pod-name]
kubectl logs [pod-name] -f
kubectl exec -it [pod-name] -- /bin/bash
kubectl apply -f [file.yaml]
kubectl delete -f [file.yaml]

# デバッグに便利なコマンド
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl top nodes
kubectl top pods
kubectl cluster-info
```

### 緊急時対応
障害・問題発生時の調査手順

```bash
# 1. 全体状況の把握
kubectl get nodes
kubectl get pods --all-namespaces
kubectl get services --all-namespaces

# 2. 問題箇所の特定
kubectl describe [resource-type] [resource-name]
kubectl get events --field-selector involvedObject.name=[resource-name]

# 3. ログ確認
kubectl logs [pod-name] --previous
kubectl logs -n kube-system [system-pod-name]
```

## 📊 AWS ECS vs Kubernetes 機能対応表

### 基本概念の対応

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| **Cluster** | Cluster | コンテナ実行環境 |
| **Task Definition** | Pod Specification | コンテナの実行仕様 |
| **Task** | Pod | 実行中のコンテナインスタンス |
| **Service** | Deployment + Service | アプリケーションの管理・公開 |
| **Container Instance** | Node | コンテナを実行する物理・仮想マシン |

### 運用機能の対応

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| **CloudWatch Logs** | kubectl logs + Logging Stack | ログ管理 |
| **CloudWatch Metrics** | Metrics Server + Prometheus | メトリクス監視 |
| **ALB/NLB** | Ingress Controller | ロードバランシング |
| **IAM Role** | ServiceAccount + RBAC | 権限管理 |
| **Parameter Store** | ConfigMap + Secret | 設定管理 |
| **Auto Scaling** | HPA + VPA + Cluster Autoscaler | 自動スケーリング |

### デプロイメント機能の対応

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| **Rolling Update** | Rolling Update | 無停止更新 |
| **Blue/Green Deployment** | Blue/Green Strategy | 環境切り替えデプロイ |
| **CodePipeline** | ArgoCD + Tekton | CI/CDパイプライン |
| **ECR** | Container Registry | コンテナイメージ管理 |

## 🔗 関連リソース

### 公式ドキュメント
- [Kubernetes API Reference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.25/)
- [kubectl チートシート](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes コンセプト](https://kubernetes.io/docs/concepts/)

### AWS関連
- [AWS EKS ユーザーガイド](https://docs.aws.amazon.com/eks/latest/userguide/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [AWS for Fluent Bit](https://github.com/aws/aws-for-fluent-bit)

### ツール・エコシステム
- [Helm Charts](https://artifacthub.io/)
- [CNCF Landscape](https://landscape.cncf.io/)
- [Kubernetes Extensions](https://kubernetes.io/docs/concepts/extend-kubernetes/)

## 📝 リファレンス活用のコツ

### 学習段階での活用
1. **概念理解**: 用語集でAWS ECSとの対応を確認
2. **実践練習**: 設定ファイルのテンプレートを参考に作成
3. **コマンド習得**: CLIリファレンスで効率的なコマンドを学習

### 運用段階での活用
1. **日常作業**: クイックリファレンスで頻用コマンドを確認
2. **問題解決**: トラブルシューティング手順を参照
3. **設定変更**: 設定例を参考に安全な変更を実施

### チーム共有での活用
1. **標準化**: 設定ファイルのテンプレートをチーム標準として採用
2. **教育**: 新メンバーの学習資料として活用
3. **運用手順**: 緊急時対応の標準手順として整備

---

**推奨使用法**: 
日常的に参照するクイックリファレンスをブックマークし、具体的な作業時に詳細なAPIリファレンスや設定例を参照してください。

**次のステップ**: 
具体的なAPIやCLIの詳細は、各サブディレクトリのドキュメントを参照してください。
