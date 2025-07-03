# OpenTelemetry統合 README

## 概要
このBackendはOpenTelemetryを使用して包括的なオブザーバビリティを提供します。

## 機能
- **分散トレーシング**: リクエストフロー追跡
- **カスタムメトリクス**: ビジネス指標収集
- **構造化ログ**: JSON形式ログ出力
- **個人情報保護**: 自動PII除去
- **ヘルスチェック**: 監視用エンドポイント

## エンドポイント
- `GET /health` - ヘルスチェック
- `GET /metrics` - Prometheusメトリクス
- `GET /ready` - レディネスチェック

## 環境変数
```bash
# OpenTelemetry
OTEL_SERVICE_NAME=team-learning-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_RESOURCE_ATTRIBUTES=service.name=team-learning-backend,service.version=1.0.0

# ログ
LOG_LEVEL=info
ELASTICSEARCH_URL=http://elasticsearch:9200
```

## 使用方法
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# オブザーバビリティ付きで起動
docker-compose -f docker-compose.yml -f docker-compose.observability.yml --profile development up
```

## カスタムメトリクス
- `http_requests_total` - HTTPリクエスト数
- `active_users_total` - アクティブユーザー数
- `learning_progress_total` - 学習進捗イベント
- `quiz_attempts_total` - クイズ試行回数
- `database_queries_total` - DB クエリ数

## 構造化ログ
すべてのログは以下の形式で出力されます：
```json
{
  "timestamp": "2025-07-03T10:00:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "service": "team-learning-backend",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "userId": "hash123",
  "method": "GET",
  "route": "/api/users",
  "statusCode": 200,
  "duration": 0.123
}
```

## 次のステップ
1. 依存関係のインストール: `npm install`
2. 環境変数の設定
3. オブザーバビリティスタック起動
4. 動作確認
