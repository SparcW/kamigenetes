// 最小限のAPIサーバー - TypeScriptエラー回避用
// 基本的なエンドポイントで動作確認

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア設定
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 基本エンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'チーム学習プラットフォーム API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'team-learning-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// API情報
app.get('/api', (req, res) => {
  res.json({
    name: 'Team Learning Platform API',
    version: '1.0.0',
    description: 'Kubernetes学習チームプラットフォーム',
    endpoints: [
      'GET /',
      'GET /health', 
      'GET /api',
      'GET /api/users',
      'GET /api/teams'
    ]
  });
});

// ダミーエンドポイント
app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, username: 'demo_user', role: 'learner' },
      { id: 2, username: 'admin_user', role: 'admin' }
    ]
  });
});

app.get('/api/teams', (req, res) => {
  res.json({
    teams: [
      { id: 1, name: 'Kubernetes基礎チーム', members: 5 },
      { id: 2, name: 'AWS EKS移行チーム', members: 3 }
    ]
  });
});

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// エラーハンドラー
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 API Server starting on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API info: http://localhost:${PORT}/api`);
  console.log(`🌐 CORS enabled for: http://localhost:3000`);
});

export default app;
