// OpenTelemetry初期化（他のインポートより前に実行）
require('./telemetry/otel.js');

// 基本メトリクスサーバー
// prom-client、winston、OpenTelemetryを使用した統合観測可能性テスト

const express = require('express');
const { register, Counter, Histogram, Gauge } = require('prom-client');
const winston = require('winston');

// OpenTelemetry インポート
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('team-learning-backend', '1.0.0');

// ファイル出力ロガーの設定
const fs = require('fs');
const path = require('path');

// ログディレクトリの作成
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

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
    // コンソール出力
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // アプリケーションログファイル
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: winston.format.json(),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // エラーログファイル（エラーレベルのみ）
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.json(),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],
});

// アクセスログ用の専用ロガー
const accessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'team-learning-backend', log_type: 'access' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      format: winston.format.json(),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
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

// メトリクス記録とトレーシングの統合ミドルウェア
const metricsAndTracingMiddleware = (req, res, next) => {
  // OpenTelemetryスパン開始
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    kind: 1, // SERVER
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.scheme': req.protocol,
      'http.host': req.get('host'),
      'http.user_agent': req.get('user-agent'),
      'user.ip': req.ip
    }
  });

  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    
    // スパンの更新
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response.duration_ms': duration * 1000
    });
    
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`
      });
    }
    
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
    
    // アプリケーションログ記録（トレース情報付き）
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    
    logger.info('HTTP Request', {
      method: method,
      route: route,
      statusCode: statusCode,
      duration: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      traceId: traceId,
      spanId: spanId
    });
    
    // アクセスログ記録
    accessLogger.info('HTTP Access', {
      method: method,
      url: req.originalUrl || req.url,
      statusCode: statusCode,
      duration: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      referer: req.headers['referer'] || '',
      contentLength: res.getHeader('content-length') || 0,
      responseTime: duration,
      traceId: traceId,
      spanId: spanId
    });
    
    // スパンを終了
    span.end();
  });
  
  // スパンをアクティブにして次のミドルウェアに渡す
  context.with(trace.setSpan(context.active(), span), next);
};

// ミドルウェア設定
app.use(express.json());
app.use(metricsAndTracingMiddleware);

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
