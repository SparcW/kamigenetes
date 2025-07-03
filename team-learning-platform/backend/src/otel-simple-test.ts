// 簡単なOpenTelemetry統合テストサーバー
// バージョン互換性問題を回避して基本機能をテスト

import express from 'express';
import { register } from 'prom-client';

// OpenTelemetryを使わずに基本的なトレース機能をシミュレート
function generateTraceId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Express Request型拡張
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3004;

// 基本的なトレースミドルウェア（OpenTelemetryシミュレート）
const basicTracingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const startTime = Date.now();
  
  // トレースIDとスパンIDを生成
  req.traceId = req.headers['x-trace-id'] as string || generateTraceId();
  req.spanId = generateSpanId();
  
  // X-Trace-IDヘッダーを設定
  res.setHeader('X-Trace-ID', req.traceId);
  res.setHeader('X-Span-ID', req.spanId);
  
  console.log(`[TRACE] ${new Date().toISOString()} - Request started`, {
    traceId: req.traceId,
    spanId: req.spanId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[TRACE] ${new Date().toISOString()} - Request finished`, {
      traceId: req.traceId,
      spanId: req.spanId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

// ミドルウェア設定
app.use(express.json());
app.use(basicTracingMiddleware);

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'OpenTelemetry統合テストサーバー（簡易版）',
    timestamp: new Date().toISOString(),
    traceId: req.traceId,
    spanId: req.spanId,
    status: 'running'
  });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'team-learning-otel-test',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    traceId: req.traceId,
    spanId: req.spanId,
    telemetry: {
      tracingEnabled: true,
      metricsEnabled: true,
      loggingEnabled: true
    }
  };
  
  res.json(healthData);
});

// メトリクスエンドポイント
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error('Failed to generate metrics', { error: error, traceId: req.traceId });
    res.status(500).end('Error generating metrics');
  }
});

// トレース機能テスト用エンドポイント
app.get('/test-tracing', (req, res) => {
  const childSpanId = generateSpanId();
  
  console.log(`[TRACE] ${new Date().toISOString()} - Child span started`, {
    traceId: req.traceId,
    parentSpanId: req.spanId,
    childSpanId: childSpanId,
    operation: 'database-query-simulation'
  });
  
  // データベースクエリをシミュレート
  setTimeout(() => {
    console.log(`[TRACE] ${new Date().toISOString()} - Child span finished`, {
      traceId: req.traceId,
      parentSpanId: req.spanId,
      childSpanId: childSpanId,
      operation: 'database-query-simulation',
      duration: '50ms',
      result: 'success'
    });
    
    res.json({
      success: true,
      message: 'トレース機能が正常に動作しています',
      tracing: {
        traceId: req.traceId,
        parentSpan: req.spanId,
        childSpan: childSpanId,
        operation: 'database-query-simulation',
        duration: '50ms'
      },
      timestamp: new Date().toISOString()
    });
  }, 50);
});

// 複数のスパンをテストするエンドポイント
app.get('/test-multi-span', async (req, res) => {
  const operations = ['auth-check', 'data-fetch', 'response-format'];
  const spans: any[] = [];
  
  for (const [index, operation] of operations.entries()) {
    const spanId = generateSpanId();
    const startTime = Date.now();
    
    console.log(`[TRACE] ${new Date().toISOString()} - Span ${index + 1} started`, {
      traceId: req.traceId,
      parentSpanId: req.spanId,
      spanId: spanId,
      operation: operation
    });
    
    // 各操作をシミュレート
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
    
    const duration = Date.now() - startTime;
    
    console.log(`[TRACE] ${new Date().toISOString()} - Span ${index + 1} finished`, {
      traceId: req.traceId,
      parentSpanId: req.spanId,
      spanId: spanId,
      operation: operation,
      duration: `${duration}ms`
    });
    
    spans.push({
      spanId: spanId,
      operation: operation,
      duration: `${duration}ms`,
      status: 'completed'
    });
  }
  
  res.json({
    success: true,
    message: '複数スパンのトレースが完了しました',
    tracing: {
      traceId: req.traceId,
      parentSpan: req.spanId,
      childSpans: spans
    },
    timestamp: new Date().toISOString()
  });
});

// エラーテスト（トレース付き）
app.get('/test-error-tracing', (req, res) => {
  const errorSpanId = generateSpanId();
  
  console.log(`[TRACE] ${new Date().toISOString()} - Error span started`, {
    traceId: req.traceId,
    parentSpanId: req.spanId,
    errorSpanId: errorSpanId,
    operation: 'error-simulation'
  });
  
  const error = new Error('テスト用エラー（トレース付き）');
  
  console.error(`[TRACE] ${new Date().toISOString()} - Error span failed`, {
    traceId: req.traceId,
    parentSpanId: req.spanId,
    errorSpanId: errorSpanId,
    operation: 'error-simulation',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
  
  res.status(500).json({
    success: false,
    error: 'テスト用エラーが発生しました',
    tracing: {
      traceId: req.traceId,
      parentSpan: req.spanId,
      errorSpan: errorSpanId,
      operation: 'error-simulation'
    },
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 OpenTelemetry統合テストサーバー（簡易版）が起動しました: http://localhost:${PORT}`);
  console.log(`📊 メトリクス: http://localhost:${PORT}/metrics`);
  console.log(`🏥 ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`🔍 トレーステスト: http://localhost:${PORT}/test-tracing`);
  console.log(`🔗 マルチスパンテスト: http://localhost:${PORT}/test-multi-span`);
  console.log(`❌ エラートレーステスト: http://localhost:${PORT}/test-error-tracing`);
});
