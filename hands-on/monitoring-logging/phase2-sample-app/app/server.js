const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
const redis = require('redis');

const logger = require('./logger');
const metrics = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3000;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

// ミドルウェアの設定
app.use(helmet()); // セキュリティヘッダー
app.use(compression()); // レスポンス圧縮
app.use(cors()); // CORS設定
app.use(express.json({ limit: '10mb' })); // JSONパーサー
app.use(express.urlencoded({ extended: true })); // URLエンコードパーサー

// ログとメトリクスミドルウェア
app.use(logger.requestLogger);
app.use(metrics.metricsMiddleware);

// データベース接続プール
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password123@postgres:5432/monitoring_app',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis接続（オプショナル）
let redisClient;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });
  
  redisClient.connect().catch((err) => {
    logger.warn('Redis connection failed, running without cache', { error: err.message });
  });
}

// データベース接続確認
dbPool.on('connect', () => {
  logger.info('New database client connected');
});

dbPool.on('error', (err) => {
  logger.error('Database pool error', { error: err.message });
});

// アプリケーション開始ログ
logger.info('Application starting', {
  port: PORT,
  metricsPort: METRICS_PORT,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
  redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured'
});

// ルートハンドラー

// ヘルスチェックエンドポイント
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0'
  };
  
  try {
    // データベース接続確認
    const dbStart = Date.now();
    await dbPool.query('SELECT 1');
    const dbDuration = (Date.now() - dbStart) / 1000;
    health.database = { status: 'connected', responseTime: dbDuration };
    metrics.recordDbMetrics('health_check', 'system', dbDuration, true);
    
    // Redis接続確認（利用可能な場合）
    if (redisClient && redisClient.isOpen) {
      const redisStart = Date.now();
      await redisClient.ping();
      const redisDuration = (Date.now() - redisStart) / 1000;
      health.redis = { status: 'connected', responseTime: redisDuration };
    } else {
      health.redis = { status: 'not configured' };
    }
    
    logger.info('Health check completed', health);
    res.json(health);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    health.status = 'ERROR';
    health.error = error.message;
    res.status(503).json(health);
  }
});

// Ready プローブ（Kubernetes用）
app.get('/ready', async (req, res) => {
  try {
    await dbPool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// ユーザー一覧取得
app.get('/api/users', async (req, res) => {
  try {
    const start = Date.now();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    logger.debug('Fetching users list', { page, limit, offset });
    
    // キャッシュから確認（Redis利用可能な場合）
    const cacheKey = `users:page:${page}:limit:${limit}`;
    let users = null;
    
    if (redisClient && redisClient.isOpen) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          users = JSON.parse(cached);
          metrics.recordCacheMetrics('users_list', true);
          logger.debug('Users fetched from cache', { cacheKey });
        } else {
          metrics.recordCacheMetrics('users_list', false);
        }
      } catch (cacheError) {
        logger.warn('Cache read error', { error: cacheError.message });
      }
    }
    
    // キャッシュにない場合はデータベースから取得
    if (!users) {
      const query = 'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      const result = await dbPool.query(query, [limit, offset]);
      users = result.rows;
      
      const dbDuration = (Date.now() - start) / 1000;
      metrics.recordDbMetrics('SELECT', 'users', dbDuration, true);
      
      // キャッシュに保存（Redis利用可能な場合）
      if (redisClient && redisClient.isOpen) {
        try {
          await redisClient.setEx(cacheKey, 300, JSON.stringify(users)); // 5分間キャッシュ
          logger.debug('Users cached', { cacheKey, duration: 300 });
        } catch (cacheError) {
          logger.warn('Cache write error', { error: cacheError.message });
        }
      }
    }
    
    logger.info('Users list fetched successfully', { 
      count: users.length, 
      page, 
      limit,
      duration: (Date.now() - start) / 1000
    });
    
    res.json({
      users,
      pagination: {
        page,
        limit,
        count: users.length
      }
    });
    
  } catch (error) {
    logger.error('Failed to fetch users', { error: error.message, stack: error.stack });
    metrics.recordDbMetrics('SELECT', 'users', 0, false);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 特定ユーザー取得
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      logger.warn('Invalid user ID format', { userId: req.params.id });
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const start = Date.now();
    logger.debug('Fetching user by ID', { userId });
    
    const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const result = await dbPool.query(query, [userId]);
    
    const dbDuration = (Date.now() - start) / 1000;
    metrics.recordDbMetrics('SELECT', 'users', dbDuration, true);
    
    if (result.rows.length === 0) {
      logger.info('User not found', { userId });
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    logger.info('User fetched successfully', { userId, email: user.email });
    
    res.json(user);
    
  } catch (error) {
    logger.error('Failed to fetch user', { 
      userId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    });
    metrics.recordDbMetrics('SELECT', 'users', 0, false);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ユーザー作成
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // バリデーション
    if (!name || !email) {
      logger.warn('Missing required fields', { name: !!name, email: !!email });
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    if (!email.includes('@')) {
      logger.warn('Invalid email format', { email });
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const start = Date.now();
    logger.info('Creating new user', { name, email });
    
    const query = 'INSERT INTO users (name, email, created_at) VALUES ($1, $2, NOW()) RETURNING id, name, email, created_at';
    const result = await dbPool.query(query, [name, email]);
    
    const dbDuration = (Date.now() - start) / 1000;
    metrics.recordDbMetrics('INSERT', 'users', dbDuration, true);
    metrics.recordBusinessMetrics.userRegistration();
    
    const newUser = result.rows[0];
    
    // キャッシュクリア（Redis利用可能な場合）
    if (redisClient && redisClient.isOpen) {
      try {
        const keys = await redisClient.keys('users:page:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
          logger.debug('User list cache cleared', { clearedKeys: keys.length });
        }
      } catch (cacheError) {
        logger.warn('Cache clear error', { error: cacheError.message });
      }
    }
    
    logger.info('User created successfully', { 
      userId: newUser.id, 
      name: newUser.name, 
      email: newUser.email,
      duration: dbDuration
    });
    
    res.status(201).json(newUser);
    
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      logger.warn('Duplicate email address', { email: req.body.email });
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    logger.error('Failed to create user', { 
      name: req.body.name, 
      email: req.body.email, 
      error: error.message, 
      stack: error.stack 
    });
    metrics.recordDbMetrics('INSERT', 'users', 0, false);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理者エンドポイント - ログレベル確認
app.get('/admin/loglevel', (req, res) => {
  res.json({ level: logger.getLevel() });
});

// 管理者エンドポイント - ログレベル変更
app.put('/admin/loglevel', (req, res) => {
  const { level } = req.body;
  
  if (logger.setLevel(level)) {
    logger.info('Log level changed via API', { newLevel: level });
    res.json({ success: true, level });
  } else {
    logger.warn('Invalid log level requested', { requestedLevel: level });
    res.status(400).json({ error: 'Invalid log level' });
  }
});

// 管理者エンドポイント - システム情報
app.get('/admin/info', async (req, res) => {
  try {
    const dbStats = await dbPool.query('SELECT COUNT(*) as user_count FROM users');
    
    const info = {
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        userCount: parseInt(dbStats.rows[0].user_count),
        poolSize: dbPool.totalCount,
        activeConnections: dbPool.totalCount - dbPool.idleCount
      },
      redis: redisClient && redisClient.isOpen ? 'connected' : 'not available'
    };
    
    // データベース接続プールメトリクス更新
    metrics.updateDbPoolMetrics(dbPool);
    
    res.json(info);
    
  } catch (error) {
    logger.error('Failed to get system info', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// エラーハンドリングミドルウェア
app.use(logger.errorLogger);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404ハンドラー
app.use((req, res) => {
  logger.warn('Route not found', { method: req.method, url: req.url });
  res.status(404).json({ error: 'Route not found' });
});

// メトリクス用の別ポート
const metricsApp = express();
metricsApp.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.getMetrics());
});

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await dbPool.end();
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
    logger.info('Database and cache connections closed');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }
  
  process.exit(0);
});

// サーバー起動
metrics.initMetrics();

const server = app.listen(PORT, () => {
  logger.info('Main application server started', { port: PORT });
});

const metricsServer = metricsApp.listen(METRICS_PORT, () => {
  logger.info('Metrics server started', { port: METRICS_PORT });
});

// 定期的なメトリクス更新
setInterval(() => {
  metrics.updateDbPoolMetrics(dbPool);
}, 10000); // 10秒ごと

module.exports = { app, server, metricsServer };
