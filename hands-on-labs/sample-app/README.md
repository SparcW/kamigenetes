# 3層Webアプリケーションのデプロイ

AWS ECS管理者向けのKubernetes実践ラボです。このラボでは、PostgreSQL、Redis、Node.jsを使用した3層アーキテクチャのWebアプリケーションをKubernetesクラスターにデプロイします。

## 前提条件

このラボを完了するには、以下が必要です：

- 実行中のKubernetesクラスター（Minikubeまたはリモートクラスター）
- `kubectl` コマンドラインツール
- Docker（イメージビルド用）
- 基本的なKubernetesの概念の理解（[概念ガイド](../../docs/concepts/README.md)を参照）

## ラボの目標

このラボを完了すると、以下ができるようになります：

- [ ] Kubernetesでマルチティアアプリケーションをデプロイする
- [ ] ConfigMapとSecretを使用して設定を管理する
- [ ] PersistentVolumeを使用してデータを永続化する
- [ ] Serviceを使用してコンポーネント間の通信を設定する
- [ ] Deploymentを使用してアプリケーションの更新とスケーリングを行う

## AWS ECSとの比較

| 機能 | AWS ECS | Kubernetes |
|------|---------|------------|
| **サービス定義** | タスク定義 + サービス | Deployment + Service |
| **設定管理** | 環境変数/Parameter Store | ConfigMap/Secret |
| **データ永続化** | EFS/EBS | PersistentVolume/PVC |
| **サービス検出** | Service Discovery | Service/DNS |
| **負荷分散** | Application Load Balancer | Service/Ingress |
| **スケーリング** | Service Auto Scaling | HPA/VPA |

## ラボの構成

```
hands-on-labs/sample-app/
├── README.md                    # このファイル
├── setup/                       # 初期セットアップ
│   ├── prerequisites.md
│   └── environment-setup.md
├── lab-01-namespace/            # ネームスペースとリソース管理
├── lab-02-database/             # PostgreSQLデプロイ
├── lab-03-cache/                # Redisデプロイ
├── lab-04-webapp/               # Webアプリケーションデプロイ
├── lab-05-operations/           # 運用操作（スケーリング、更新）
├── lab-06-monitoring/           # 監視とトラブルシューティング
├── quiz/                        # 学習確認クイズ
└── cleanup/                     # リソースクリーンアップ

```

## 推奨学習パス

1. **準備作業**: [前提条件の確認](setup/prerequisites.md)
2. **環境セットアップ**: [開発環境の準備](setup/environment-setup.md)
3. **Lab 1**: [ネームスペースとリソース管理](lab-01-namespace/README.md)
4. **Lab 2**: [データベース層のデプロイ](lab-02-database/README.md)
5. **Lab 3**: [キャッシュ層のデプロイ](lab-03-cache/README.md)
6. **Lab 4**: [Webアプリケーション層のデプロイ](lab-04-webapp/README.md)
7. **Lab 5**: [運用操作の実践](lab-05-operations/README.md)
8. **Lab 6**: [監視とトラブルシューティング](lab-06-monitoring/README.md)
9. **学習確認**: [クイズによる理解度チェック](quiz/index.html)
10. **後片付け**: [リソースのクリーンアップ](cleanup/README.md)

## 所要時間

- **総所要時間**: 約3-4時間
- **各Lab**: 20-40分
- **クイズ**: 10-15分

## 関連ドキュメント

- [Kubernetesの基本概念](../../docs/concepts/README.md)
- [Deploymentガイド](../../docs/tutorials/deployments/README.md)
- [Serviceとネットワーキング](../../docs/tutorials/services/README.md)
- [ConfigMapとSecret](../../docs/tutorials/configuration/README.md)

## 困ったときは

- [トラブルシューティングガイド](../../docs/tasks/troubleshoot/README.md)
- [FAQ](../../faq.md)
- [コミュニティサポート](../../docs/support.md)

---

**注意**: このラボはAWS ECS管理者がKubernetesを学習するために特別に設計されています。各ステップでECSとの比較を交えながら、実践的にKubernetesの操作を習得できます。
