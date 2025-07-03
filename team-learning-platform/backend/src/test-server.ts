// 基本的なOpenTelemetryテストサーバー
// 依存関係の動作確認用

import './telemetry/otel';
import express from 'express';
import { tracingMiddleware, metricsEndpoint, healthCheck } from './telemetry/middleware';
import { customMetrics, structuredLogger } from './telemetry/metrics';

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(express.json());
app.use(tracingMiddleware);

// 基本ルート
app.get('/', (req, res) => {
  structuredLogger.info('Root endpoint accessed');
  res.json({ 
    message: 'Team Learning Platform - OpenTelemetry テスト',
    timestamp: new Date().toISOString(),
    traceId: req.traceId || 'no-trace'
  });
});

// メトリクスエンドポイント
app.get('/metrics', metricsEndpoint);

// ヘルスチェック
app.get('/health', healthCheck);

// テスト用エンドポイント
app.get('/test-metrics', (req, res) => {
  // テスト用メトリクスを記録
  customMetrics.recordLearningProgress('test-user', 'test-course', 'test-activity');
  
  structuredLogger.info('Test metrics recorded', {
    userId: 'test-user',
    courseId: 'test-course',
    activity: 'test-activity'
  });
  
  res.json({ 
    message: 'テストメトリクスが記録されました',
    timestamp: new Date().toISOString() 
  });
});

// エラーテスト用エンドポイント
app.get('/test-error', (req, res) => {
  const error = new Error('テストエラー');
  structuredLogger.error('Test error generated', { error: error.message });
  
  customMetrics.recordError('TestError', 'medium', 'test-handler');
  
  res.status(500).json({ 
    error: 'テストエラーが発生しました',
    timestamp: new Date().toISOString() 
  });
});

// サーバー起動
app.listen(PORT, () => {
  structuredLogger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
  
  console.log(`🚀 テストサーバーが起動しました: http://localhost:${PORT}`);
  console.log(`📊 メトリクス: http://localhost:${PORT}/metrics`);
  console.log(`🏥 ヘルスチェック: http://localhost:${PORT}/health`);
});
