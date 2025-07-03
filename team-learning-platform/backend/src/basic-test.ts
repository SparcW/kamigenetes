// 最小限のOpenTelemetryテストサーバー
// 基本的な依存関係の動作確認用

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

// 基本ミドルウェア
app.use(express.json());

// 基本ルート
app.get('/', (req, res) => {
  res.json({ 
    message: 'Team Learning Platform - Basic Test',
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

// 基本的なヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend',
    version: '1.0.0'
  });
});

// テスト用エンドポイント
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint working',
    timestamp: new Date().toISOString() 
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Basic test server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
});
