// 基本メトリクスサーバー
// prom-clientとwinstonを使用した基本的な観測可能性テスト

const express = require('express');
const { register, Counter, Histogram, Gauge } = require('prom-client');
const winston = require('winston');

// Logstashへのログ送信設定
const logstashTransport = new winston.transports.Http({
  host: 'localhost',
  port: 5001,
  path: '/',
  format: winston.format.json()
});

// Winstonロガーの設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'team-learning-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    logstashTransport
  ],
});

// Expressアプリケーションの初期化
const app = express();
app.use(express.json());

// ログ出力ミドルウェア
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // リクエストログ
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // レスポンスログ
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
});

const PORT = process.env.PORT || 3002;

// Prometheusメトリクスの定義
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const learningEventsTotal = new Counter({
  name: 'learning_events_total',
  help: 'Total number of learning events',
  labelNames: ['user_id', 'event_type', 'course_id']
});

// メトリクス記録ミドルウェア
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    
    // HTTPメトリクス記録
    httpRequestsTotal.inc({
      method: method,
      route: route,
      status_code: statusCode
    });
    
    httpRequestDuration.observe(
      { method: method, route: route, status_code: statusCode },
      duration
    );
    
    // ログ記録
    logger.info('HTTP Request', {
      method: method,
      route: route,
      statusCode: statusCode,
      duration: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  });
  
  next();
};

// ミドルウェア設定
app.use(express.json());
app.use(metricsMiddleware);

// ルートエンドポイント
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed');
  res.json({ 
    message: 'Team Learning Platform - Basic Metrics Test',
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
    logger.error('Failed to generate metrics', { error: error.message });
    res.status(500).end('Error generating metrics');
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// テスト用学習イベント記録
app.post('/test-learning-event', (req, res) => {
  const { userId = 'test-user', eventType = 'module-completed', courseId = 'k8s-basics' } = req.body;
  
  // 学習イベントメトリクス記録
  learningEventsTotal.inc({
    user_id: userId,
    event_type: eventType,
    course_id: courseId
  });
  
  logger.info('Learning event recorded', {
    userId: userId,
    eventType: eventType,
    courseId: courseId
  });
  
  res.json({
    success: true,
    message: '学習イベントが記録されました',
    event: {
      userId: userId,
      eventType: eventType,
      courseId: courseId
    },
    timestamp: new Date().toISOString()
  });
});

// テスト用バルクイベント
app.get('/test-bulk-events', (req, res) => {
  const users = ['user-001', 'user-002', 'user-003'];
  const events = ['module-started', 'module-completed', 'quiz-passed'];
  const courses = ['k8s-basics', 'docker-intro', 'helm-guide'];
  
  let eventCount = 0;
  users.forEach(userId => {
    events.forEach(eventType => {
      courses.forEach(courseId => {
        learningEventsTotal.inc({
          user_id: userId,
          event_type: eventType,
          course_id: courseId
        });
        eventCount++;
      });
    });
  });
  
  logger.info('Bulk learning events recorded', {
    totalEvents: eventCount,
    users: users.length,
    eventTypes: events.length,
    courses: courses.length
  });
  
  res.json({
    success: true,
    message: 'バルク学習イベントが記録されました',
    stats: {
      totalEvents: eventCount,
      users: users.length,
      eventTypes: events.length,
      courses: courses.length
    },
    timestamp: new Date().toISOString()
  });
});

// エラーテスト用エンドポイント
app.get('/test-error', (req, res) => {
  const error = new Error('テスト用エラー');
  logger.error('Test error generated', { 
    error: error.message,
    stack: error.stack 
  });
  
  res.status(500).json({
    success: false,
    error: 'テスト用エラーが発生しました',
    timestamp: new Date().toISOString()
  });
});

// アクティブ接続数の更新
let connectionCount = 0;
app.use((req, res, next) => {
  connectionCount++;
  activeConnections.set(connectionCount);
  
  res.on('finish', () => {
    connectionCount--;
    activeConnections.set(connectionCount);
  });
  
  next();
});

// エラーハンドラー
app.use((error, req, res, next) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
});

// サーバー起動
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend'
  });
  console.log(`✅ Basic Metrics Server running on port ${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔍 Health: http://localhost:${PORT}/health`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('Server shutting down', {
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend'
  });
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Server shutting down', {
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend'
  });
  process.exit(0);
});
