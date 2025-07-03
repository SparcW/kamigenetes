// OpenTelemetry統合テストサーバー
// 観測可能性機能の動作確認用

// OpenTelemetry初期化（最初に実行）
import './telemetry/otel';

import express from 'express';
import { 
  tracingMiddleware, 
  metricsEndpoint, 
  healthCheck, 
  readinessCheck,
  errorTrackingMiddleware,
  recordUserActivity,
  recordLearningEvent,
  recordQuizResult
} from './telemetry/middleware';
import { customMetrics, structuredLogger } from './telemetry/metrics';

const app = express();
const PORT = process.env.PORT || 3002;

// 基本ミドルウェア
app.use(express.json());
app.use(tracingMiddleware);

// ルートエンドポイント
app.get('/', (req, res) => {
  structuredLogger.info('Root endpoint accessed', {
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  res.json({ 
    message: 'Team Learning Platform - OpenTelemetry統合テスト',
    timestamp: new Date().toISOString(),
    traceId: req.traceId || 'no-trace',
    spanId: req.spanId || 'no-span'
  });
});

// メトリクスエンドポイント
app.get('/metrics', metricsEndpoint);

// ヘルスチェック
app.get('/health', healthCheck);

// 詳細ヘルスチェック
app.get('/readiness', readinessCheck);

// テスト用エンドポイント - メトリクス記録
app.get('/test-metrics', (req, res) => {
  try {
    // 基本メトリクス記録
    customMetrics.recordLearningProgress('test-user-001', 'kubernetes-basics', 'module-completed');
    
    // ビジネスメトリクス記録
    recordUserActivity('test-user-001', 'document-view', { documentId: 'k8s-intro' });
    recordLearningEvent('test-user-001', 'kubernetes-basics', 'quiz-started', 0);
    recordQuizResult('test-user-001', 'k8s-basic-quiz', 85, true);
    
    structuredLogger.info('Test metrics recorded successfully', {
      userId: 'test-user-001',
      courseId: 'kubernetes-basics',
      activities: ['module-completed', 'document-view', 'quiz-started', 'quiz-completed']
    });
    
    res.json({ 
      success: true,
      message: 'テストメトリクスが正常に記録されました',
      timestamp: new Date().toISOString(),
      traceId: req.traceId || 'no-trace',
      activities: [
        'learning-progress',
        'user-activity',
        'learning-event',
        'quiz-result'
      ]
    });
  } catch (error) {
    structuredLogger.error('Failed to record test metrics', { error: error });
    res.status(500).json({ 
      success: false,
      error: 'テストメトリクスの記録に失敗しました',
      timestamp: new Date().toISOString() 
    });
  }
});

// テスト用エンドポイント - エラーテスト
app.get('/test-error', (req, res) => {
  const error = new Error('OpenTelemetryテストエラー');
  
  // エラーメトリクス記録
  customMetrics.recordError('TestError', 'high', 'test-handler');
  
  structuredLogger.error('Test error generated intentionally', { 
    error: error.message,
    stack: error.stack,
    testType: 'error-handling',
    userId: 'test-user-001'
  });
  
  res.status(500).json({ 
    success: false,
    error: 'テストエラーが意図的に発生しました',
    timestamp: new Date().toISOString(),
    traceId: req.traceId || 'no-trace',
    errorType: 'intentional-test-error'
  });
});

// テスト用エンドポイント - 遅延テスト
app.get('/test-slow', async (req, res) => {
  const startTime = Date.now();
  
  structuredLogger.info('Slow endpoint accessed', {
    expectedDelay: '2000ms',
    userId: 'test-user-001'
  });
  
  // 2秒の遅延をシミュレート
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const duration = Date.now() - startTime;
  
  structuredLogger.info('Slow endpoint completed', {
    actualDuration: `${duration}ms`,
    userId: 'test-user-001'
  });
  
  res.json({ 
    success: true,
    message: 'スロークエリテストが完了しました',
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    traceId: req.traceId || 'no-trace'
  });
});

// テスト用エンドポイント - 複数のメトリクス
app.get('/test-bulk-metrics', (req, res) => {
  try {
    // 複数のユーザーアクティビティを記録
    const users = ['user-001', 'user-002', 'user-003'];
    const courses = ['k8s-basics', 'docker-intro', 'helm-guide'];
    
    users.forEach(userId => {
      courses.forEach(courseId => {
        recordLearningEvent(userId, courseId, 'module-started');
        recordUserActivity(userId, 'document-view', { courseId });
      });
    });
    
    structuredLogger.info('Bulk metrics recorded', {
      userCount: users.length,
      courseCount: courses.length,
      totalEvents: users.length * courses.length * 2
    });
    
    res.json({ 
      success: true,
      message: 'バルクメトリクスが記録されました',
      stats: {
        users: users.length,
        courses: courses.length,
        totalEvents: users.length * courses.length * 2
      },
      timestamp: new Date().toISOString(),
      traceId: req.traceId || 'no-trace'
    });
  } catch (error) {
    structuredLogger.error('Failed to record bulk metrics', { error: error });
    res.status(500).json({ 
      success: false,
      error: 'バルクメトリクスの記録に失敗しました'
    });
  }
});

// エラーハンドリングミドルウェア
app.use(errorTrackingMiddleware);

// 最終的なエラーハンドラー
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    timestamp: new Date().toISOString(),
    traceId: req.traceId || 'no-trace'
  });
});

// サーバー起動
app.listen(PORT, () => {
  structuredLogger.info('OpenTelemetry test server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    features: [
      'distributed-tracing',
      'custom-metrics',
      'structured-logging',
      'error-tracking'
    ]
  });
  
  console.log(`🚀 OpenTelemetry統合テストサーバーが起動しました: http://localhost:${PORT}`);
  console.log(`📊 メトリクス: http://localhost:${PORT}/metrics`);
  console.log(`🏥 ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`🔍 詳細ヘルスチェック: http://localhost:${PORT}/readiness`);
  console.log(`🧪 テストエンドポイント:`);
  console.log(`   - メトリクス: http://localhost:${PORT}/test-metrics`);
  console.log(`   - エラー: http://localhost:${PORT}/test-error`);
  console.log(`   - 遅延: http://localhost:${PORT}/test-slow`);
  console.log(`   - バルク: http://localhost:${PORT}/test-bulk-metrics`);
});
