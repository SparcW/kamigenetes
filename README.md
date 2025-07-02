# 🚀 Kubernetes学習ワークスペース
**AWS ECS管理者向け包括的学習ガイド**

Kubernetesの公式ドキュメント構造に基づいた学習プラットフォームです。AWS ECSの経験を活かして段階的にKubernetesの概念と実践スキルを習得できます。

## 📚 学習ナビゲーション

### 🎯 [📖 ドキュメント](./docs/) - 体系的な知識習得
公式Kubernetesドキュメント構造に準拠した包括的学習ガイド

**[� まずはここから: ドキュメントトップページ](./docs/README.md)**

#### � [概念 (Concepts)](./docs/concepts/) - 基礎理解（1-2週間）
- **[概要](./docs/concepts/overview.md)** - Kubernetes入門とAWS ECS比較
- **[クラスターアーキテクチャ](./docs/concepts/cluster-architecture.md)** - 基盤構造の理解
- **[ワークロード](./docs/concepts/workloads.md)** - Pod、Deployment、Service
- **[設定管理](./docs/concepts/configuration.md)** - ConfigMap、Secret
- **[セキュリティ](./docs/concepts/security.md)** - RBAC、NetworkPolicy
- **[ストレージ](./docs/concepts/storage.md)** - Volume、PV、PVC
- **[ネットワーキング](./docs/concepts/networking.md)** - Service、Ingress、Gateway API
- **[監視とログ](./docs/concepts/observability.md)** - 運用可視化
- **[スケーリング](./docs/concepts/scaling-automation.md)** - HPA、VPA

#### 🏃 [チュートリアル (Tutorials)](./docs/tutorials/) - 実践演習（2-3週間）
- **Hello Kubernetes** - 初めてのデプロイメント
- **基本操作** - kubectl操作習得
- **アプリケーション管理** - ステートレス/ステートフル
- **設定とストレージ** - データ永続化
- **ネットワーキング** - 通信設定

#### 📋 [タスク (Tasks)](./docs/tasks/) - 問題解決（随時参照）
- **クラスター管理** - 運用タスク
- **アプリケーション管理** - デプロイメント戦略
- **モニタリング・ログ** - 運用監視
- **セキュリティ** - セキュア運用
- **ネットワーキング** - 通信制御

#### 🚀 [セットアップ](./docs/setup/) - 環境構築
- **学習環境** - minikube、kind、Docker Desktop
- **本番環境** - AWS EKS、クラスター設計
- **ツール設定** - 開発環境整備

### 🛠️ [ツール](./tools/) - 運用効率化
専門ツールの活用ガイド

- **[Helm](./tools/helm/)** - パッケージ管理とテンプレート
- **[Kustomize](./tools/kustomize/)** - 宣言的設定管理
- **[ArgoCD](./tools/argocd/)** - GitOps継続的デプロイ
- **[Gateway API](./tools/gateway-api/)** - 次世代ネットワーキング

### 🧪 [ハンズオンラボ](./hands-on-labs/) - 総合実践演習
段階的な実習プログラム（2-4週間）

- **[サンプルアプリ](./hands-on-labs/sample-app/)** - 3層Webアプリケーション
- **[監視・ログ](./hands-on-labs/monitoring-logging/)** - Prometheus + Grafana
- **[セキュリティ](./hands-on-labs/k8s-security/)** - RBAC + Pod Security
- **[Ingress Controller](./hands-on-labs/ingress-controller/)** - 外部アクセス制御
- **[Gateway API](./hands-on-labs/gateway-api/)** - 高度なネットワーキング

## � クイックスタート

### 1. 学習の始め方
```bash
# まずは概念を理解
📖 docs/concepts/overview.md から開始

# 環境構築
📦 docs/setup/learning-environment.md を参照

# 実践演習
🧪 hands-on-labs/sample-app/ でハンズオン
```

### 2. 環境準備
```bash
# Docker Desktop のインストール確認
docker --version
docker run hello-world

# kubectl の動作確認
kubectl version --client

# Minikube でローカルクラスター起動
minikube start
kubectl cluster-info
```

### 3. サンプルアプリケーションのデプロイ
```bash
# VS Code タスクを使用してデプロイ実行
# Ctrl+Shift+P -> "Tasks: Run Task" -> "kubectl apply - デプロイメント実行"

# または手動でコマンド実行
cd hands-on-labs/sample-app
kubectl apply -f kubernetes/
```

## 🎯 AWS ECS管理者向け学習パス

### Phase 1: 基礎概念理解（1-2週間）
1. **[📖 Kubernetes概要](./docs/concepts/overview.md)** - ECSとの比較
2. **[🏗️ アーキテクチャ](./docs/concepts/cluster-architecture.md)** - クラスター構造
3. **[💼 ワークロード](./docs/concepts/workloads.md)** - Pod、Deployment、Service

### Phase 2: 実践スキル習得（2-3週間）
1. **[🏃 チュートリアル](./docs/tutorials/)** - 段階的実習
2. **[🧪 ハンズオンラボ](./hands-on-labs/)** - 実際のアプリケーション構築
3. **[📋 タスク解決](./docs/tasks/)** - 運用問題への対処

### Phase 3: 運用効率化（1-2週間）
1. **[🛠️ ツール習得](./tools/)** - Helm、Kustomize、ArgoCD
2. **[🔒 セキュリティ](./docs/concepts/security.md)** - 本番運用準備
3. **[📊 監視・ログ](./docs/concepts/observability.md)** - 運用監視体制

## 📊 AWS ECS vs Kubernetes 対応表

| AWS ECS | Kubernetes | 学習優先度 |
|---------|------------|-----------|
| Task Definition | Pod/Deployment | ⭐⭐⭐ 最重要 |
| ECS Service | Service | ⭐⭐⭐ 最重要 |
| ALB/NLB | Ingress/Gateway | ⭐⭐ 重要 |
| Parameter Store | ConfigMap/Secret | ⭐⭐ 重要 |
| Auto Scaling | HPA/VPA | ⭐⭐ 重要 |
| CloudWatch Logs | Fluent Bit/Fluentd | ⭐ 中程度 |
| IAM Role | ServiceAccount/RBAC | ⭐ 中程度 |

## 💻 開発環境

### 必要なツール
```bash
# Windows環境での準備
winget install Docker.DockerDesktop
winget install Kubernetes.kubectl
winget install Kubernetes.minikube
winget install Helm.Helm
```

### VS Code拡張機能（自動推奨）
- Kubernetes Tools
- Docker
- YAML Language Support
- Helm Intellisense

## 🎮 学習支援機能

### インタラクティブクイズ
各章に理解度チェックのWebアプリを用意

- **[概念クイズ](./docs/concepts/quiz/)** - 基礎知識の確認
- **[ハンズオンクイズ](./hands-on-labs/sample-app/quiz/)** - 実践スキルの評価

### VS Codeタスク
学習効率を上げる定義済みタスク

- `kubectl apply - デプロイメント実行`
- `kubectl get pods - Pod状態確認`
- `Minikube start - ローカルクラスター起動`
- `Helm install - サンプルアプリ`

## 📈 学習進捗チェックリスト

### 基礎レベル（1-2週間）
- [ ] [Kubernetes概念](./docs/concepts/)の全セクション完了
- [ ] [環境構築](./docs/setup/learning-environment.md)完了
- [ ] 基本的なkubectlコマンドの理解
- [ ] Pod、Service、Deploymentの理解

### 実践レベル（2-3週間）
- [ ] [チュートリアル](./docs/tutorials/)完了
- [ ] [サンプルアプリ](./hands-on-labs/sample-app/)デプロイ成功
- [ ] ConfigMap、Secretの活用
- [ ] ローリングアップデートの実行

### 応用レベル（1-2週間）
- [ ] [Helm](./tools/helm/)によるパッケージ管理
- [ ] [ArgoCD](./tools/argocd/)によるGitOps実装
- [ ] [監視・ログ](./hands-on-labs/monitoring-logging/)環境構築
- [ ] [セキュリティ](./hands-on-labs/k8s-security/)設定実装

### 本番レベル（随時）
- [ ] AWS EKSクラスター構築
- [ ] CI/CDパイプライン実装
- [ ] 障害対応とトラブルシューティング
- [ ] パフォーマンスチューニング

## 📚 参考リソース

### 公式ドキュメント
- [Kubernetes公式ドキュメント](https://kubernetes.io/docs/)
- [AWS EKS ユーザーガイド](https://docs.aws.amazon.com/eks/)
- [CNCF ランドスケープ](https://landscape.cncf.io/)

### コミュニティ
- [Kubernetes Slack](https://kubernetes.slack.com/)
- [CNCF](https://www.cncf.io/)
- [日本Kubernetesコミュニティ](https://kubernetes.io/ja/community/)

## 🤝 コントリビューション

このガイドの改善にご協力ください：
- バグ報告やタイポ修正
- 新しい演習内容の提案
- AWS ECS経験者からのフィードバック

---
**🎯 次のステップ**: [📖 概念を学ぶ](./docs/concepts/) → [🏃 チュートリアルを試す](./docs/tutorials/) → [🧪 ハンズオンを実践](./hands-on-labs/)

**📝 更新日**: 2025年6月18日 | **🎯 対象**: AWS ECS経験者 | **📊 難易度**: 初級〜中級
