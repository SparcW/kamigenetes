# 📚 Kubernetes学習ガイド - AWS ECS管理者向け

Kubernetesの公式ドキュメント構造に基づいた包括的な学習ガイドです。AWS ECSの経験を活かしながら、段階的にKubernetesの概念と実践的な運用スキルを習得できます。

## 🎯 学習目標

このガイドは、AWS ECS管理者がKubernetesエキスパートになるために設計されています：

- **基礎理解**: Kubernetesの核となる概念とアーキテクチャの理解
- **実践的スキル**: 実際の運用で必要な技術とベストプラクティスの習得
- **ツール習熟**: Helm、Kustomize、ArgoCD、Gateway APIなどの実践活用
- **運用経験**: モニタリング、ログ管理、セキュリティ、ネットワーキングの実装

## 📖 ドキュメント構造

### 🎓 [概念 (Concepts)](./concepts/)
Kubernetesの基本概念とアーキテクチャを理解する

- **[概要](./concepts/overview.md)** - Kubernetes概要とAWS ECSとの比較
- **[クラスターアーキテクチャ](./concepts/cluster-architecture.md)** - マスターノード、ワーカーノード、ネットワーキング
- **[ワークロード](./concepts/workloads.md)** - Pod、Deployment、Service、Ingress
- **[設定管理](./concepts/configuration.md)** - ConfigMap、Secret、環境変数
- **[セキュリティ](./concepts/security.md)** - RBAC、Pod Security、NetworkPolicy
- **[ストレージ](./concepts/storage.md)** - Volume、PV、PVC、StorageClass
- **[ネットワーキング](./concepts/networking.md)** - Service、Ingress、Gateway API

### 🏃 [チュートリアル (Tutorials)](./tutorials/)
ステップバイステップで実践的なスキルを習得する

- **[Hello Kubernetes](./tutorials/hello-kubernetes.md)** - 初めてのKubernetesアプリケーション
- **[基本操作](./tutorials/kubernetes-basics.md)** - kubectl基本操作とワークフロー
- **[ステートレスアプリ](./tutorials/stateless-application.md)** - Webアプリケーションのデプロイ
- **[ステートフルアプリ](./tutorials/stateful-application.md)** - データベースとボリューム
- **[サービス接続](./tutorials/service-connection.md)** - マイクロサービス間の通信
- **[設定管理](./tutorials/configuration.md)** - ConfigMapとSecretの活用
- **[セキュリティ実装](./tutorials/security.md)** - RBAC、Pod Security、NetworkPolicy

### ⚙️ [タスク (Tasks)](./tasks/)
特定の問題解決と運用タスクの実行方法

- **[ツールのインストール](./tasks/install-tools.md)** - kubectl、helm、kustomizeの設定
- **[クラスター管理](./tasks/administer-cluster.md)** - ノード管理、リソース監視
- **[Pod設定](./tasks/configure-pod-container.md)** - リソース制限、ヘルスチェック
- **[モニタリング・ログ](./tasks/monitoring-logging.md)** - メトリクス、ログ収集、デバッグ
- **[オブジェクト管理](./tasks/manage-objects.md)** - 宣言的・命令的管理
- **[Secret管理](./tasks/manage-secrets.md)** - 機密情報の安全な管理
- **[アプリケーション実行](./tasks/run-applications.md)** - デプロイメント戦略
- **[ネットワーキング](./tasks/networking.md)** - サービス露出、トラフィック制御

### 🚀 [セットアップ (Setup)](./setup/)
Kubernetes環境の構築と設定

- **[学習環境](./setup/learning-environment.md)** - minikube、kind、Docker Desktop
- **[本番環境](./setup/production-environment.md)** - AWS EKS、クラスター設計
- **[ツール設定](./setup/tool-configuration.md)** - 開発ツールチェーンの構築
- **[セキュリティ設定](./setup/security-configuration.md)** - クラスターセキュリティの強化

### 📚 [リファレンス (Reference)](./reference/)
API、CLI、設定の詳細リファレンス

- **[API リファレンス](./reference/api/)** - Kubernetes API仕様
- **[CLI リファレンス](./reference/cli/)** - kubectl、helm、kustomizeコマンド
- **[設定ファイル](./reference/config-files/)** - YAML設定例とベストプラクティス
- **[用語集](./reference/glossary.md)** - Kubernetes用語とAWS ECS対応表

## 🛠️ ツール別ガイド

### [Helm](../tools/helm/)
Kubernetesパッケージマネージャーの活用
- **概念**: Chart、Template、Values
- **実践**: Chart作成、デプロイメント、アップグレード
- **ベストプラクティス**: Chart設計、セキュリティ

### [Kustomize](../tools/kustomize/)
宣言的設定管理ツールの活用
- **概念**: Base、Overlay、Patches
- **実践**: 環境別設定、設定の継承
- **統合**: kubectl、ArgoCD連携

### [ArgoCD](../tools/argocd/)
GitOps継続的デプロイメントの実装
- **概念**: GitOps、宣言的デプロイ
- **実践**: アプリケーション管理、同期戦略
- **運用**: モニタリング、ロールバック

### [Gateway API](../tools/gateway-api/)
次世代Kubernetesネットワーキング
- **概念**: Gateway、HTTPRoute、TLS
- **実践**: L4/L7ルーティング、トラフィック分割
- **移行**: Ingressからの移行戦略

## 🧪 ハンズオンラボ

### [実践演習環境](../hands-on-labs/)
段階的なハンズオン学習プログラム

1. **[基礎ラボ](../hands-on-labs/basics/)** - kubectl操作、基本リソース
2. **[アプリケーションラボ](../hands-on-labs/applications/)** - マイクロサービス、データベース
3. **[セキュリティラボ](../hands-on-labs/security/)** - RBAC、NetworkPolicy、Pod Security
4. **[モニタリングラボ](../hands-on-labs/monitoring/)** - Prometheus、Grafana、ログ管理
5. **[ネットワーキングラボ](../hands-on-labs/networking/)** - Ingress、Gateway API、Service Mesh
6. **[GitOpsラボ](../hands-on-labs/gitops/)** - ArgoCD、フリート管理
7. **[本番運用ラボ](../hands-on-labs/production/)** - CI/CD、災害復旧、スケーリング

## 🎮 学習チェック機能

各章の最後には、理解度を確認するためのインタラクティブなクイズWebアプリが用意されています：

- **基礎知識クイズ** - 概念の理解度チェック
- **実践スキルクイズ** - 実際の操作方法の確認
- **トラブルシューティングクイズ** - 問題解決能力の評価
- **ベストプラクティスクイズ** - 運用経験の確認

## 📊 AWS ECS比較表

| 機能 | AWS ECS | Kubernetes | 移行のポイント |
|------|---------|------------|---------------|
| **コンテナ実行** | Task Definition | Pod/Deployment | リソース制限、ヘルスチェック |
| **サービス管理** | ECS Service | Service | ロードバランシング、自動回復 |
| **ネットワーキング** | ALB/NLB | Ingress/Gateway | L4/L7ルーティング |
| **設定管理** | Parameter Store | ConfigMap/Secret | 環境変数、ファイルマウント |
| **スケーリング** | Auto Scaling | HPA/VPA | CPU/メモリベースの自動スケール |
| **デプロイ戦略** | Rolling Update | Deployment Strategy | Blue/Green、Canary |
| **ログ管理** | CloudWatch Logs | Fluent Bit/Fluentd | ログ収集、転送設定 |
| **モニタリング** | CloudWatch | Prometheus/Grafana | メトリクス収集、アラート |
| **セキュリティ** | IAM/Security Groups | RBAC/NetworkPolicy | 認可、ネットワーク分離 |
| **CI/CD** | CodePipeline | ArgoCD/Tekton | GitOps、宣言的デプロイ |

## 🔗 関連リソース

- **[Kubernetes公式ドキュメント](https://kubernetes.io/docs/)**
- **[AWS EKS ユーザーガイド](https://docs.aws.amazon.com/eks/)**
- **[CNCF ランドスケープ](https://landscape.cncf.io/)**
- **[Kubernetes コミュニティ](https://kubernetes.io/community/)**

## 📝 コントリビューション

このガイドへの改善提案やフィードバックは、GitHubのIssueまたはPull Requestでお気軽にお送りください。AWS ECS経験者からの実践的なフィードバックを特にお待ちしています。

---

**次のステップ**: [概念を学ぶ](./concepts/) → [チュートリアルを試す](./tutorials/) → [実践タスクを実行](./tasks/)
