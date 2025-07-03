# オブザーバビリティ統合 Backend 設定
# backend package.json への依存関係追加

# OpenTelemetry 統合用の依存関係
@opentelemetry/api: ^1.7.0
@opentelemetry/auto-instrumentations-node: ^0.44.0
@opentelemetry/exporter-otlp-http: ^0.48.0
@opentelemetry/instrumentation: ^0.48.0
@opentelemetry/instrumentation-express: ^0.34.0
@opentelemetry/instrumentation-http: ^0.48.0
@opentelemetry/instrumentation-pg: ^0.38.0
@opentelemetry/instrumentation-redis: ^0.38.0
@opentelemetry/resource-detector-container: ^0.3.0
@opentelemetry/resources: ^1.21.0
@opentelemetry/sdk-node: ^0.48.0
@opentelemetry/semantic-conventions: ^1.21.0

# メトリクス収集用
prom-client: ^15.1.0
express-prometheus-middleware: ^1.2.0

# 構造化ログ用
winston: ^3.11.0
winston-elasticsearch: ^0.17.4
winston-transport: ^4.6.0

# 分散トレーシング用
jaeger-client: ^3.19.0
opentracing: ^0.14.7

# ヘルスチェック用
@godaddy/terminus: ^4.12.1

# 環境変数管理
dotenv: ^16.3.1
