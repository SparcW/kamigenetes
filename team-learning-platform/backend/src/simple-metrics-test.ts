// 簡単なメトリクステストサーバー
// Prometheus metricsのみの動作確認用

import express from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

const app = express();
const PORT = 3002;

// カスタムメトリクス定義
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// 基本ミドルウェア
app.use(express.json());

// メトリクス記録ミドルウェア
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    });
    
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString()
      },
      duration
    );
  });
  
  next();
});

// 基本ルート
app.get('/', (req, res) => {
  res.json({ 
    message: 'Simple Metrics Test Server',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// メトリクスエンドポイント
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error generating metrics');
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'simple-metrics-test',
    version: '1.0.0'
  });
});

// テスト用エンドポイント
app.get('/test', (req, res) => {
  // アクティブ接続数を更新
  activeConnections.inc();
  
  res.json({ 
    message: 'Test endpoint - metrics recorded',
    timestamp: new Date().toISOString() 
  });
  
  // 1秒後にアクティブ接続数を減らす
  setTimeout(() => {
    activeConnections.dec();
  }, 1000);
});

// エラーテスト
app.get('/error', (req, res) => {
  res.status(500).json({
    error: 'Test error',
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Simple metrics test server running on http://localhost:${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🧪 Test: http://localhost:${PORT}/test`);
});
