// OpenTelemetry 最小限設定 (JavaScript版)
// このファイルは一番最初にインポートする必要があります

console.log('🚀 Initializing OpenTelemetry...');

// 環境変数でエンドポイントを設定
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4319';
process.env.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'team-learning-backend';
process.env.OTEL_SERVICE_VERSION = '1.0.0';
process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.namespace=team-learning,team=team-learning,component=backend-api,language=nodejs';

try {
  // Node.js SDKを使用した簡単な初期化
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  
  const sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations({
      // 不要な計装を無効化
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    })]
  });
  
  sdk.start();
  console.log('✅ OpenTelemetry initialized successfully');
  console.log('📊 Service:', process.env.OTEL_SERVICE_NAME);
  console.log('🔗 Endpoint:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  
  // プロセス終了時のクリーンアップ
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('🔄 OpenTelemetry terminated'))
      .catch((error) => console.error('❌ Error terminating OpenTelemetry:', error))
      .finally(() => process.exit(0));
  });

} catch (error) {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
  console.log('🔄 Continuing without OpenTelemetry...');
}
