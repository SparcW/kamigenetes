// 最も単純なメトリクステストサーバー (JavaScript)
const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = 3002;

// デフォルトメトリクス有効化
client.collectDefaultMetrics();

// カスタムメトリクス
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

app.use(express.json());

// メトリクス記録ミドルウェア
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    });
  });
  
  next();
});

// 基本ルート
app.get('/', (req, res) => {
  res.json({ 
    message: 'Simple Metrics Test Server (JS)',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// メトリクスエンドポイント
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
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
    service: 'simple-metrics-test-js',
    version: '1.0.0'
  });
});

// テスト用エンドポイント
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint - metrics recorded',
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
