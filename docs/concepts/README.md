# 📖 概念 (Concepts)

このセクションでは、Kubernetesの基本概念とアーキテクチャを学習します。AWS ECS管理者の経験を活かしながら、Kubernetesの新しい概念を理解できるよう設計されています。

## 🎯 学習目標

- Kubernetesの核となる概念の理解
- AWS ECSとの違いと類似点の把握
- 実際の運用で必要な知識の習得
- 次のステップへの準備

## 📚 概念ガイド

### 🔍 [概要](./overview.md)
**Kubernetesとは何か、なぜ必要なのかを理解する**
- Kubernetesの特徴と利点
- AWS ECSとの比較
- コンテナオーケストレーションの概念
- エコシステムの理解

### 🏗️ [クラスターアーキテクチャ](./cluster-architecture.md)
**Kubernetesクラスターの構造と各コンポーネントの役割**
- コントロールプレーン（マスターノード）
- ワーカーノード
- ネットワーキングとストレージ
- AWS EKSアーキテクチャとの比較

### 💼 [ワークロード](./workloads.md)
**アプリケーションの実行とライフサイクル管理**
- Pod: 最小実行単位
- Deployment: アプリケーションの宣言的管理
- Service: ネットワーク接続とサービスディスカバリ
- Ingress: 外部からのアクセス制御
- ECSタスクとサービスとの対応

### ⚙️ [設定管理](./configuration.md)
**アプリケーション設定と機密情報の管理**
- ConfigMap: 設定データの分離
- Secret: 機密情報の安全な管理
- Environment Variables: 環境変数の設定
- Volume Mounts: 設定ファイルのマウント
- AWS Parameter Store/Secrets Managerとの比較

### 🔒 [セキュリティ](./security.md)
**クラスターとアプリケーションのセキュリティ**
- RBAC: ロールベースアクセス制御
- Pod Security Standards: Podのセキュリティポリシー
- NetworkPolicy: ネットワーク分離
- Security Context: コンテナのセキュリティ設定
- AWS IAMとSecurity Groupsとの比較

### 💾 [ストレージ](./storage.md)
**永続化ストレージとデータ管理**
- Volume: データの永続化
- PersistentVolume (PV): ストレージリソース
- PersistentVolumeClaim (PVC): ストレージ要求
- StorageClass: 動的プロビジョニング
- AWS EBS/EFSとの統合

### 🌐 [ネットワーキング](./networking.md)
**クラスター内外の通信とトラフィック制御**
- Service Types: ClusterIP、NodePort、LoadBalancer
- Ingress: L7ロードバランシング
- Gateway API: 次世代ネットワーキング
- DNS: サービスディスカバリ
- AWS ALB/NLBとの比較

### 📊 [監視とログ](./observability.md)
**アプリケーションとクラスターの可視化**
- Metrics: リソース使用量とパフォーマンス
- Logging: アプリケーションとシステムログ
- Tracing: 分散トレーシング
- Health Checks: ヘルスチェックと自動回復
- AWS CloudWatchとの比較

### 🔄 [スケーリングとオートメーション](./scaling-automation.md)
**動的スケーリングと自動化機能**
- Horizontal Pod Autoscaler (HPA): Pod数の自動調整
- Vertical Pod Autoscaler (VPA): リソース量の自動調整
- Cluster Autoscaler: ノード数の自動調整
- Custom Metrics: カスタムメトリクスベースのスケーリング
- AWS Auto Scalingとの比較

## 🆚 AWS ECS vs Kubernetes 概念マッピング

| AWS ECS | Kubernetes | 説明 |
|---------|------------|------|
| **Task Definition** | **Pod Spec** | コンテナの実行仕様 |
| **Task** | **Pod** | 実行中のコンテナインスタンス |
| **Service** | **Deployment + Service** | アプリケーションの管理と公開 |
| **Cluster** | **Cluster** | リソースプール |
| **Container Instance** | **Node** | コンテナを実行するホスト |
| **ALB/NLB** | **Ingress/Service** | ロードバランサー |
| **Auto Scaling Group** | **ReplicaSet** | インスタンス数の管理 |
| **Parameter Store** | **ConfigMap** | 設定データ |
| **Secrets Manager** | **Secret** | 機密情報 |
| **CloudWatch Logs** | **Fluentd/Fluent Bit** | ログ収集 |
| **CloudWatch Metrics** | **Prometheus** | メトリクス監視 |
| **IAM Role** | **ServiceAccount + RBAC** | 認証・認可 |
| **Security Group** | **NetworkPolicy** | ネットワークセキュリティ |

## 🎯 学習の進め方

### 1. 基礎理解フェーズ
1. **概要** → **クラスターアーキテクチャ** を読んで全体像を把握
2. AWS ECSとの比較表を参照しながら理解を深める
3. 各概念の関係性を図解で確認

### 2. 実践準備フェーズ
1. **ワークロード** → **設定管理** で実際のアプリケーション管理を学習
2. **セキュリティ** → **ネットワーキング** で運用面の重要な概念を理解
3. **ストレージ** で永続化の仕組みを把握

### 3. 運用理解フェーズ
1. **監視とログ** → **スケーリングとオートメーション** で運用自動化を学習
2. AWS ECSでの経験と比較しながら、Kubernetesでの運用方法を理解

## 📝 学習ノート

各概念を学習する際は、以下の観点で理解を深めてください：

### ECS経験者向けの重要ポイント
- **宣言的管理**: ECSのサービス更新 vs Kubernetesの宣言的管理
- **ヘルスチェック**: ECS Target Group vs Kubernetes Probes
- **サービスディスカバリ**: ECS Service Discovery vs Kubernetes DNS
- **設定管理**: Parameter Store vs ConfigMap/Secret
- **ログ管理**: CloudWatch Logs vs ログドライバー/サイドカー

### 実践への準備
- どの概念がチュートリアルで実際に体験できるか
- どのタスクで詳細な操作方法を学べるか
- 本番運用で特に重要な概念はどれか

## 🔗 次のステップ

概念の理解が完了したら、以下に進んでください：

1. **[チュートリアル](../tutorials/)** - 実際にKubernetesを操作して理解を深める
2. **[タスク](../tasks/)** - 特定の問題を解決する実践的なスキルを習得
3. **[ハンズオンラボ](../hands-on-labs/)** - 総合的な演習で実践力を向上

## 📚 関連リソース

- [Kubernetes公式概念ガイド](https://kubernetes.io/docs/concepts/)
- [AWS EKS概念ガイド](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [CNCF Kubernetes基礎コース](https://www.cncf.io/certification/training/)

---

**開始**: [概要を読む](./overview.md) | **AWS ECS経験者**: [ワークロード比較](./workloads.md#aws-ecs比較)
