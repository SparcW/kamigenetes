// OpenTelemetry 初期化設定
// このファイルは一番最初にインポートする必要があります

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ContainerDetector } from '@opentelemetry/resource-detector-container';

// 環境変数の読み込み
const serviceName = process.env.OTEL_SERVICE_NAME || 'team-learning-backend';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4319';

// リソース設定
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'team-learning',
  'team': 'team-learning',
  'component': 'backend-api',
  'language': 'nodejs'
});

// トレースエクスポーター設定
const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: {
    'X-Scope-OrgID': 'team-learning'
  }
});

// メトリクスエクスポーター設定
const metricExporter = new OTLPMetricExporter({
  url: `${otlpEndpoint}/v1/metrics`,
  headers: {
    'X-Scope-OrgID': 'team-learning'
  }
});

// 自動計装設定
const instrumentations = getNodeAutoInstrumentations({
  // Express計装
  '@opentelemetry/instrumentation-express': {
    enabled: true,
    requestHook: (span, info) => {
      // リクエスト情報の追加
      span.setAttributes({
        'http.request.body.size': info.request.headers['content-length'] || 0,
        'user.agent': info.request.headers['user-agent'] || 'unknown'
      });
    },
    responseHook: (span, info) => {
      // レスポンス情報の追加
      span.setAttributes({
        'http.response.body.size': info.response.getHeader('content-length') || 0
      });
    }
  },
  
  // HTTP計装
  '@opentelemetry/instrumentation-http': {
    enabled: true,
    requestHook: (span, request) => {
      span.setAttributes({
        'http.request.method': request.method,
        'http.url': request.url
      });
    }
  },
  
  // PostgreSQL計装
  '@opentelemetry/instrumentation-pg': {
    enabled: true,
    enhancedDatabaseReporting: true
  },
  
  // Redis計装
  '@opentelemetry/instrumentation-redis': {
    enabled: true,
    requestHook: (span, requestInfo) => {
      span.setAttributes({
        'redis.connection.string': requestInfo.connectionOptions?.host || 'localhost'
      });
    }
  },
  
  // 不要な計装を無効化
  '@opentelemetry/instrumentation-dns': { enabled: false },
  '@opentelemetry/instrumentation-net': { enabled: false }
});

// SDK初期化
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000, // 10秒間隔
  }),
  instrumentations: instrumentations,
  resourceDetectors: [new ContainerDetector()]
});

// SDK開始
try {
  sdk.start();
  console.log('✅ OpenTelemetry initialized successfully');
  console.log(`📊 Service: ${serviceName} v${serviceVersion}`);
  console.log(`🌍 Environment: ${environment}`);
  console.log(`📡 OTLP Endpoint: ${otlpEndpoint}`);
} catch (error) {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
}

// プロセス終了時のクリーンアップ
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('🔄 OpenTelemetry terminated'))
    .catch((error) => console.log('⚠️ Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
});

export default sdk;
