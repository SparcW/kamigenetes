# 📋 タスクリファレンス - Kubernetes運用ガイド

特定の問題解決と運用タスクの実行方法をまとめたリファレンスです。AWS ECS経験者が実際の運用で直面する課題への具体的な解決策を提供します。

## 🎯 タスクカテゴリ

### 🛠️ [ツールのインストール](./install-tools.md)
開発・運用に必要なツールの導入と設定

- kubectl、helm、kustomizeの設定
- 各種CLIツールの認証設定
- VS Code拡張機能の活用

### 🏗️ [クラスター管理](./administer-cluster.md)
Kubernetesクラスターの管理・保守

- ノード管理とメンテナンス
- リソース監視とアラート
- バックアップと復旧手順
- クラスター更新とアップグレード

### ⚙️ [Pod設定](./configure-pod-container.md)
Pod とコンテナの詳細設定

- リソース制限とリクエスト
- ヘルスチェックの設定
- セキュリティコンテキスト
- ライフサイクルフック

### 📊 [モニタリング・ログ](./monitoring-logging.md)
運用監視とログ管理

- Prometheus メトリクス収集
- Grafana ダッシュボード作成
- ログ収集と分析
- アラート設定とトラブルシューティング

### 📝 [オブジェクト管理](./manage-objects.md)
Kubernetesリソースの効率的な管理

- 宣言的 vs 命令的管理
- GitOps ワークフロー
- 環境別設定管理
- リソースのバージョン管理

### 🔐 [Secret管理](./manage-secrets.md)
機密情報の安全な管理

- Secret の作成と更新
- 外部シークレット管理との連携
- セキュリティベストプラクティス
- ローテーションとアクセス制御

### 🚀 [アプリケーション実行](./run-applications.md)
アプリケーションのデプロイと管理

- デプロイメント戦略
- ローリングアップデートとロールバック
- カナリーリリース
- Blue/Green デプロイ

### 🌐 [ネットワーキング](./networking.md)
サービス露出とトラフィック制御

- Service の種類と使い分け
- Ingress Controller の設定
- ロードバランシング
- ネットワークポリシー

## 🔍 タスクの使い方

### 検索方法
各タスクページには以下の情報が含まれています：

- **目的**: 解決したい問題の説明
- **前提条件**: 必要な権限や事前設定
- **手順**: ステップバイステップの実行方法
- **トラブルシューティング**: よくある問題と解決方法
- **AWS ECS比較**: 対応する ECS の機能との比較

### 難易度レベル
- 🟢 **初級**: 基本的な kubectl 操作
- 🟡 **中級**: YAML 編集と設定変更
- 🔴 **上級**: 複雑な設定とカスタマイズ

## 📚 よく使用されるタスク

### 日常運用（初級）
1. [Pod のログ確認](./monitoring-logging.md#ログ確認)
2. [Pod の再起動](./configure-pod-container.md#pod再起動)
3. [リソース使用量確認](./monitoring-logging.md#リソース監視)
4. [設定値の更新](./manage-objects.md#設定更新)

### 問題解決（中級）
1. [Pod が起動しない](./configure-pod-container.md#起動問題)
2. [サービスに接続できない](./networking.md#接続問題)
3. [リソース不足エラー](./administer-cluster.md#リソース管理)
4. [設定の適用失敗](./manage-objects.md#設定問題)

### 本番運用（上級）
1. [ゼロダウンタイム更新](./run-applications.md#ローリングアップデート)
2. [災害復旧手順](./administer-cluster.md#災害復旧)
3. [セキュリティ強化](./manage-secrets.md#セキュリティ強化)
4. [パフォーマンス最適化](./configure-pod-container.md#最適化)

## 🎯 AWS ECS から Kubernetes への移行タスク

### 移行計画
- [ECS Task Definition から Deployment への変換](./run-applications.md#ecs移行)
- [ECS Service から Service + Ingress への変換](./networking.md#ecs移行)
- [ALB/NLB から Ingress Controller への移行](./networking.md#alb移行)

### 運用の違い
- [ECS Auto Scaling vs HPA](./run-applications.md#スケーリング比較)
- [CloudWatch vs Prometheus](./monitoring-logging.md#監視比較)
- [IAM Role vs ServiceAccount](./manage-secrets.md#権限比較)

## 🔧 緊急時対応

### 障害対応手順
1. **即座に確認すべき項目**
   ```bash
   kubectl get pods --all-namespaces
   kubectl get nodes
   kubectl get events --sort-by=.metadata.creationTimestamp
   ```

2. **ログ確認**
   ```bash
   kubectl logs <pod-name> --previous
   kubectl describe pod <pod-name>
   ```

3. **リソース状況確認**
   ```bash
   kubectl top nodes
   kubectl top pods --all-namespaces
   ```

### エスカレーション基準
- Pod の異常終了が継続する場合
- ノードのリソース使用率が 90% を超える場合
- ネットワーク通信に広範囲な影響がある場合

## 📖 関連リソース

- [Kubernetes公式トラブルシューティング](https://kubernetes.io/docs/tasks/debug-application-cluster/)
- [kubectl チートシート](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [AWS EKS トラブルシューティング](https://docs.aws.amazon.com/eks/latest/userguide/troubleshooting.html)

---

**使い方のコツ**: 問題が発生したら、関連するタスクページの目次から該当する項目を探してください。各タスクは実際のコマンド例付きで説明されています。
