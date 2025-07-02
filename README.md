# Kubernetes学習ガイド 🚀
**AWS ECS管理者のためのKubernetes完全学習パス**

このリポジトリは、AWS ECS管理者がKubernetesを効率的に学習し、新しいサービスをKubernetes上にデプロイするための包括的なガイドです。

## 📚 学習の流れ

### 1. 基礎理解（1-2週間）
- [Kubernetesの基本概念](./guides/01-kubernetes-basics.md)
- [AWS ECSとKubernetesの比較](./guides/02-ecs-vs-kubernetes.md)
- [開発環境の構築](./guides/03-development-setup.md)

### 2. 実践学習（2-3週間）
- [Pod、Service、Deploymentの基本](./guides/04-core-concepts.md)
- [設定管理とSecret](./guides/05-config-management.md)
- [ネットワーキングとイングレス](./guides/06-networking.md)

### 3. 運用・スケーリング（2-3週間）
- [ストレージとPersistentVolume](./guides/07-storage.md)
- [モニタリングとログ管理](./guides/08-monitoring.md)
- [セキュリティのベストプラクティス](./guides/09-security.md)

### 4. 高度なトピック（2-4週間）
- [Helmパッケージ管理](./guides/10-helm.md)
- [CI/CDパイプライン](./guides/11-cicd.md)
- [障害対応とトラブルシューティング](./guides/12-troubleshooting.md)

## 🛠️ ハンズオン演習

- [サンプルアプリケーションのデプロイ](./hands-on-labs/sample-app/)
- [ECSタスクのKubernetes移行演習](./hands-on-labs/ecs-migration/)
- [ロードバランシングの設定](./hands-on-labs/load-balancing/)
- [データベース接続](./hands-on-labs/database-connection/)

## 🔄 移行ガイド

- [ECSタスク定義からKubernetes YAMLへの変換](./migration/task-definition-conversion.md)
- [ECS Serviceからkubernetesサービスへの移行](./migration/service-migration.md)
- [Auto ScalingとHorizontal Pod Autoscaler](./migration/scaling-migration.md)

## 📋 前提知識

このガイドは以下の知識を前提としています：
- AWS ECSの基本的な使用経験
- Dockerコンテナの基本理解
- AWS CLI・Web Console操作経験
- 基本的なLinuxコマンド

## 🎯 学習目標

このコースを完了すると、以下のことができるようになります：

### ECSからKubernetesへの移行理解
- ECSタスク定義をKubernetes Deploymentに変換
- ECS Serviceをkubernetes Service + Ingressに変換
- AWS ALBからKubernetes Ingressコントローラーへの移行
- IAM RoleからServiceAccountへの権限移行

### Kubernetes基本操作の習得
- kubectl を使用したリソース管理
- Pod、Deployment、Serviceの作成と管理
- ConfigMapとSecretを使用した設定管理
- PersistentVolumeを使用したストレージ管理

### 本番運用スキルの獲得
- ローリングアップデートとロールバック
- Horizontal Pod Autoscalerを使用したスケーリング
- リソース監視とログ収集
- セキュリティベストプラクティスの実装

## 💻 開発環境

### 必要なツール
```bash
# Windows PowerShell環境での準備
# 1. Docker Desktop のインストール
# 2. kubectl のインストール
winget install Docker.DockerDesktop
winget install Kubernetes.kubectl

# 3. Minikube のインストール（ローカル学習用）
winget install Kubernetes.minikube

# 4. Helm のインストール
winget install Helm.Helm
```

### VS Code拡張機能
このワークスペースでは以下の拡張機能が自動的に推奨されます：
- Kubernetes Tools
- Docker
- YAML Language Support
- Helm Intellisense

## 🚀 クイックスタート

### 1. 環境確認
```powershell
# Docker の動作確認
docker --version
docker run hello-world

# kubectl の動作確認
kubectl version --client

# Minikube でローカルクラスター起動
minikube start
kubectl cluster-info
```

### 2. サンプルアプリケーションのデプロイ
```powershell
# このリポジトリをクローン後
cd hands-on-labs/sample-app

# 詳細な手順は deployment-guide.md を参照
# VS Code タスクを使用してデプロイ実行
# Ctrl+Shift+P -> "Tasks: Run Task" -> "kubectl apply - デプロイメント実行"
```

## 📖 学習リソース

### 公式ドキュメント（日本語翻訳）
- [Kubernetes公式ドキュメント（英語）](https://kubernetes.io/docs/) 
- [kubectl チートシート](./references/kubectl-cheatsheet.md)
- [YAML設定リファレンス](./references/yaml-reference.md)

### AWS ECS管理者向け特別コンテンツ
- [ECS vs K8s 用語対比表](./references/terminology-mapping.md)
- [AWSサービスとKubernetesの対応表](./references/service-mapping.md)
- [移行チェックリスト](./migration/migration-checklist.md)

## 🏆 認定・スキル検証

### 学習進捗チェック
- [ ] Kubernetesの基本概念を理解
- [ ] 基本的なYAMLファイルを作成できる
- [ ] kubectl コマンドを使用してリソース管理
- [ ] サンプルアプリケーションをデプロイ
- [ ] ConfigMapとSecretを適切に使用
- [ ] ローリングアップデートを実行
- [ ] ログとメトリクスを収集・分析
- [ ] セキュリティ設定を適用

### 推奨資格
- Certified Kubernetes Administrator (CKA)
- Certified Kubernetes Application Developer (CKAD)
- AWS Certified Kubernetes Specialist

## 🤝 コミュニティとサポート

### 学習サポート
- [Issue報告](./issues/) - 質問や問題報告
- [ディスカッション](./discussions/) - 学習者同士の情報交換
- [プルリクエスト](./pulls/) - 内容改善の提案

### 外部リソース
- [Kubernetes Slack コミュニティ](https://kubernetes.slack.com/)
- [CNCF (Cloud Native Computing Foundation)](https://www.cncf.io/)
- [AWS EKS ユーザーガイド](https://docs.aws.amazon.com/eks/)

## 📅 学習スケジュール例

### 8週間集中プログラム

| 週 | 学習内容 | 演習 | 目標 |
|---|---------|------|------|
| 1 | K8s基礎概念、ECS比較 | 環境構築 | 基本理解 |
| 2 | Pod、Service、Deployment | サンプルアプリデプロイ | 基本操作習得 |
| 3 | ConfigMap、Secret、Volume | 設定管理実装 | データ管理理解 |
| 4 | Networking、Ingress | 外部公開設定 | ネットワーク理解 |
| 5 | Monitoring、Logging | 運用ツール導入 | 運用準備 |
| 6 | Security、RBAC | セキュリティ強化 | セキュア運用 |
| 7 | Helm、CI/CD | 自動化実装 | DevOps実践 |
| 8 | 本番移行、最適化 | ECS移行演習 | 移行完了 |

## 🎯 学習目標

このガイドを完了すると、以下ができるようになります：
- Kubernetesクラスターの構築と管理
- アプリケーションのコンテナ化とデプロイ
- サービスの公開とネットワーク設定
- モニタリングとログ管理の実装
- セキュリティポリシーの適用
- 障害対応とパフォーマンスチューニング

## 📖 参考リソース

- [公式Kubernetesドキュメント（日本語版）](https://kubernetes.io/ja/docs/)
- [AWS EKS公式ガイド](https://docs.aws.amazon.com/eks/)
- [kubectl チートシート](https://kubernetes.io/ja/docs/reference/kubectl/cheatsheet/)

## 💡 学習のコツ

1. **実際に手を動かす**: 理論だけでなく、必ず実践演習を行いましょう
2. **ECSとの比較**: 既存の知識を活かして対比しながら学習しましょう
3. **小さく始める**: 複雑な構成ではなく、シンプルな例から始めましょう
4. **コミュニティ活用**: 困ったときは日本語Kubernetesコミュニティを活用しましょう

---
**更新日**: 2025年6月18日  
**対象**: AWS ECS経験者  
**難易度**: 初級〜中級
