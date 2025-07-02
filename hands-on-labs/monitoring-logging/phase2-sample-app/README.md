# Phase 2: サンプルWebアプリケーション

## 学習目標

- 実際のWebアプリケーションでの構造化ログ実装
- PostgreSQLとの連携でのログ出力
- アプリケーションメトリクスの基本実装
- Dockerコンテナでの本格的なログ設定

## 演習時間: 90-120分

---

## 概要

このPhaseでは、Node.js + Express + PostgreSQLのWebアプリケーションを構築し、実際のプロダクション環境で使える構造化ログシステムを実装します。

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │   PostgreSQL    │    │   Redis         │
│   (Node.js)     │────│   Database      │    │   Cache         │
│   Port: 3000    │    │   Port: 5432    │    │   Port: 6379    │
│   Metrics: 9090 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 演習1: Node.js Webアプリケーションの構築

### 1.1 アプリケーションソースコード確認

```bash
# アプリケーションディレクトリの確認
ls -la app/

# 主要ファイル:
# - package.json: Node.js依存関係
# - server.js: メインアプリケーション
# - logger.js: ログ設定
# - metrics.js: Prometheusメトリクス
# - Dockerfile: コンテナイメージ
```

### 1.2 構造化ログの実装理解

```javascript
// app/logger.js の内容を確認
cat app/logger.js

// 以下の構造化ログ機能を学習:
// 1. JSON形式でのログ出力
// 2. ログレベル管理
// 3. リクエストIDの追跡
// 4. Kubernetesメタデータの追加
```

### 1.3 アプリケーションのDockerビルド

```bash
# Dockerイメージをビルド
cd app/
docker build -t monitoring-webapp:v1 .

# ビルドされたイメージの確認
docker images | grep monitoring-webapp

# （オプション）ローカルでの動作確認
docker run -p 3000:3000 -e NODE_ENV=development monitoring-webapp:v1
```

---

## 演習2: PostgreSQLデータベースとの連携

### 2.1 PostgreSQL with ログ設定

```bash
# PostgreSQL設定の確認
cat manifests/postgres-config.yaml

# 重要な設定項目:
# - log_statement: すべてのSQL文をログ出力
# - log_min_duration_statement: 遅いクエリの検出
# - log_destination: ログ出力先
```

### 2.2 データベースデプロイ

```bash
# ネームスペース作成
kubectl create namespace monitoring-app

# PostgreSQL関連リソースのデプロイ
kubectl apply -f manifests/postgres-secret.yaml
kubectl apply -f manifests/postgres-config.yaml
kubectl apply -f manifests/postgres-pvc.yaml
kubectl apply -f manifests/postgres-deployment.yaml
kubectl apply -f manifests/postgres-service.yaml

# デプロイ状況確認
kubectl get pods -n monitoring-app -l app=postgres
kubectl logs -n monitoring-app deployment/postgres
```

### 2.3 初期データセットアップ

```bash
# データベース初期化Jobを実行
kubectl apply -f manifests/postgres-init-job.yaml

# 初期化完了確認
kubectl logs -n monitoring-app job/postgres-init

# データベースへの接続確認
kubectl exec -it -n monitoring-app deployment/postgres -- psql -U postgres -d monitoring_app -c "\\dt"
```

---

## 演習3: Webアプリケーションのデプロイと設定

### 3.1 アプリケーション設定

```bash
# 設定ファイルの確認
cat manifests/webapp-config.yaml

# 環境変数の理解:
# - DATABASE_URL: PostgreSQL接続文字列
# - LOG_LEVEL: アプリケーションログレベル
# - METRICS_PORT: Prometheusメトリクス公開ポート
```

### 3.2 Webアプリケーションデプロイ

```bash
# アプリケーションリソースのデプロイ
kubectl apply -f manifests/webapp-config.yaml
kubectl apply -f manifests/webapp-deployment.yaml
kubectl apply -f manifests/webapp-service.yaml

# デプロイ状況確認
kubectl get pods -n monitoring-app -l app=webapp
kubectl get services -n monitoring-app

# アプリケーションログの確認
kubectl logs -n monitoring-app deployment/webapp -f
```

### 3.3 アプリケーション動作確認

```bash
# Port Forward でアクセス確認
kubectl port-forward -n monitoring-app svc/webapp 3000:3000

# 別のターミナルでAPIテスト
curl http://localhost:3000/health
curl http://localhost:3000/api/users
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"山田太郎","email":"yamada@example.com"}'

# ログ出力確認（最初のターミナルで）
kubectl logs -n monitoring-app deployment/webapp --tail=20
```

---

## 演習4: 構造化ログの詳細分析

### 4.1 リクエストトレーシング

```bash
# 複数のAPIリクエストを実行
for i in {1..5}; do
  curl http://localhost:3000/api/users
  sleep 1
done

# リクエストIDでログをトレース
kubectl logs -n monitoring-app deployment/webapp | grep "req-"

# JSON形式ログの詳細解析
kubectl logs -n monitoring-app deployment/webapp | jq 'select(.level=="info")'
kubectl logs -n monitoring-app deployment/webapp | jq 'select(.requestId != null)'
```

### 4.2 エラーハンドリングとログ

```bash
# 意図的にエラーを発生させる
curl http://localhost:3000/api/users/999999  # 存在しないユーザー
curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"invalid":"data"}'

# エラーログの確認
kubectl logs -n monitoring-app deployment/webapp | grep -i error
kubectl logs -n monitoring-app deployment/webapp | jq 'select(.level=="error")'
```

### 4.3 データベースクエリログ

```bash
# PostgreSQLのクエリログ確認
kubectl logs -n monitoring-app deployment/postgres | grep "LOG:"
kubectl logs -n monitoring-app deployment/postgres | grep "STATEMENT:"

# 遅いクエリの検出（100ms以上）
kubectl logs -n monitoring-app deployment/postgres | grep "duration:"
```

---

## 演習5: アプリケーションメトリクス

### 5.1 Prometheusメトリクス確認

```bash
# メトリクスエンドポイントへのアクセス
kubectl port-forward -n monitoring-app svc/webapp 9090:9090

# 別のターミナルでメトリクス確認
curl http://localhost:9090/metrics

# 重要なメトリクス:
# - http_request_duration_seconds: リクエスト処理時間
# - http_requests_total: リクエスト総数
# - database_connections_active: アクティブなDB接続数
# - nodejs_heap_used_bytes: Node.jsヒープ使用量
```

### 5.2 カスタムメトリクスの理解

```bash
# アプリケーションソースでのメトリクス実装確認
cat app/metrics.js

# ビジネスメトリクスの例:
# - user_registrations_total: ユーザー登録数
# - database_query_duration_seconds: DBクエリ時間
# - cache_hits_total: キャッシュヒット数
```

---

## 演習6: 負荷テストとログ分析

### 6.1 負荷テスト実行

```bash
# 負荷テスト用Podを作成
kubectl apply -f manifests/load-test-job.yaml

# 負荷テスト実行状況確認
kubectl logs -n monitoring-app job/load-test -f

# アプリケーションの反応確認
kubectl logs -n monitoring-app deployment/webapp -f
```

### 6.2 高負荷時のログ分析

```bash
# レスポンス時間の分析
kubectl logs -n monitoring-app deployment/webapp | jq 'select(.responseTime > 100)'

# エラー率の確認
kubectl logs -n monitoring-app deployment/webapp | jq 'select(.statusCode >= 400)' | wc -l

# データベース接続プールの状況
kubectl logs -n monitoring-app deployment/webapp | grep "database" | grep "pool"
```

### 6.3 スケーリングとログ分散

```bash
# アプリケーションを3レプリカにスケール
kubectl scale -n monitoring-app deployment/webapp --replicas=3

# 各Podのログを個別に確認
kubectl get pods -n monitoring-app -l app=webapp
kubectl logs -n monitoring-app <pod-name-1> --tail=10
kubectl logs -n monitoring-app <pod-name-2> --tail=10
kubectl logs -n monitoring-app <pod-name-3> --tail=10

# 全Podのログを統合表示
kubectl logs -n monitoring-app -l app=webapp --prefix=true -f
```

---

## 演習7: ログ形式の最適化

### 7.1 ログレベル動的変更

```bash
# 現在のログレベル確認
curl http://localhost:3000/admin/loglevel

# デバッグレベルに変更
curl -X PUT http://localhost:3000/admin/loglevel -H "Content-Type: application/json" -d '{"level":"debug"}'

# デバッグログの出力確認
kubectl logs -n monitoring-app deployment/webapp | grep '"level":"debug"'

# 元のレベルに戻す
curl -X PUT http://localhost:3000/admin/loglevel -H "Content-Type: application/json" -d '{"level":"info"}'
```

### 7.2 ログ形式のカスタマイズ

```bash
# 本番用ログ形式に変更
kubectl set env -n monitoring-app deployment/webapp LOG_FORMAT=production

# 開発用ログ形式に変更
kubectl set env -n monitoring-app deployment/webapp LOG_FORMAT=development

# ログ形式の違いを確認
kubectl logs -n monitoring-app deployment/webapp --tail=10
```

---

## 実践チャレンジ

### チャレンジ1: カスタムログアナライザー

アプリケーションログから以下の情報を抽出するbashスクリプトを作成してください：

1. 過去10分間のAPIエンドポイント別リクエスト数
2. 平均レスポンス時間
3. エラー率
4. 最も遅いリクエストTOP5

### チャレンジ2: アラート条件の定義

以下のアラート条件を満たすログパターンを定義してください：

1. エラー率が5%を超えた場合
2. 平均レスポンス時間が500ms を超えた場合
3. データベース接続エラーが発生した場合
4. メモリ使用量が80%を超えた場合

### チャレンジ3: ログローテーション戦略

本番環境でのログローテーション戦略を設計してください：

1. ログファイルサイズ制限
2. 保存期間
3. 圧縮設定
4. 外部ストレージへのアーカイブ

---

## 次のステップ

Phase 2を完了したら、Phase 3（クラスターレベルロギング）に進んでください。
EFK スタックを使った本格的なログ収集・分析システムを構築します。
