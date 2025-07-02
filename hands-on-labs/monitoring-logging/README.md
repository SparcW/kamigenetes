# Kubernetesモニタリング・ロギング ハンズオン演習

## 概要

このハンズオン演習では、実際にKubernetesクラスターでモニタリングとロギングシステムを構築し、運用を体験します。

## 前提条件

- Minikube または Kubernetes クラスターが稼働中
- kubectl が設定済み
- 8GB以上のメモリ推奨
- Helm 3.x インストール済み

## 演習内容

### Phase 1: 基本ログ操作マスター
- kubectl logs の各種オプション習得
- ログフィルタリングとグレップ技術
- マルチコンテナPodのログ取得

### Phase 2: サンプルアプリケーション展開
- Node.js Webアプリケーション
- PostgreSQLデータベース
- 構造化ログの実装

### Phase 3: クラスターレベルロギング構築
- EFK (Elasticsearch + Fluentd + Kibana) スタック
- ログ収集設定とパーシング
- Kibana でのログ可視化

### Phase 4: Prometheusモニタリング実装
- Prometheus Operator 導入
- アプリケーションメトリクス収集
- Grafana ダッシュボード作成

### Phase 5: アラートとトラブルシューティング
- PrometheusRule によるアラート設定
- 実際の障害シナリオ対応
- パフォーマンス調査技術

## ディレクトリ構造

```
monitoring-logging/
├── README.md                           # このファイル
├── phase1-basic-logging/               # Phase 1: 基本ログ操作
│   ├── exercises/                      # 演習用マニフェスト
│   └── solutions/                      # 解答例
├── phase2-sample-app/                  # Phase 2: サンプルアプリ
│   ├── app/                           # アプリケーションソース
│   ├── manifests/                     # Kubernetesマニフェスト
│   └── README.md                      # Phase 2 ガイド
├── phase3-cluster-logging/             # Phase 3: クラスターレベルロギング
│   ├── elasticsearch/                 # Elasticsearch設定
│   ├── fluentd/                      # Fluentd設定
│   ├── kibana/                       # Kibana設定
│   └── README.md                     # Phase 3 ガイド
├── phase4-prometheus-monitoring/       # Phase 4: Prometheusモニタリング
│   ├── prometheus/                    # Prometheus設定
│   ├── grafana/                      # Grafana設定
│   ├── exporters/                    # 各種Exporter
│   └── README.md                     # Phase 4 ガイド
├── phase5-alerting-troubleshooting/    # Phase 5: アラート・トラブルシューティング
│   ├── alertmanager/                 # Alertmanager設定
│   ├── rules/                        # PrometheusRule
│   ├── scenarios/                    # 障害シナリオ
│   └── README.md                     # Phase 5 ガイド
├── scripts/                           # 便利スクリプト
│   ├── setup.sh                      # 環境セットアップ
│   ├── cleanup.sh                    # 環境クリーンアップ
│   └── check-cluster.sh              # クラスター状態確認
└── docs/                             # 追加ドキュメント
    ├── troubleshooting.md            # トラブルシューティングガイド
    ├── best-practices.md             # ベストプラクティス
    └── references.md                 # 参考資料
```

## クイックスタート

1. **環境確認**
   ```bash
   ./scripts/check-cluster.sh
   ```

2. **Phase 1から順番に実行**
   ```bash
   cd phase1-basic-logging
   cat README.md
   ```

3. **必要に応じてクリーンアップ**
   ```bash
   ./scripts/cleanup.sh
   ```

## 学習の進め方

1. 各Phaseは順番に実行することを推奨
2. 各PhaseのREADME.mdで詳細な手順を確認
3. 実際にコマンドを実行して理解を深める
4. トラブルが発生した場合はdocs/troubleshooting.mdを参照

## サポート

演習中に問題が発生した場合は、以下を確認してください：
- docs/troubleshooting.md
- 各PhaseのREADME.md
- Kubernetesクラスターの状態

---
**Happy Learning! 🚀**
