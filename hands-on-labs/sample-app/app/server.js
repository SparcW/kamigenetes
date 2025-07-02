const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware設定
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Redis クライアント設定（セッション管理用）
let redisClient;
try {
  redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis接続エラー:', err);
  });
  
  redisClient.on('connect', () => {
    console.log('✅ Redisに正常に接続しました');
  });
  
  redisClient.connect();
} catch (error) {
  console.error('Redis初期化エラー:', error);
}

// PostgreSQL接続プール設定
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sampledb',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// データベース接続テスト
pgPool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL接続エラー:', err);
  } else {
    console.log('✅ PostgreSQLに正常に接続しました');
    release();
  }
});

// セッション設定
if (redisClient) {
  app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // HTTPSの場合はtrueに設定
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 24時間
    }
  }));
}

// ルート定義
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ヘルスチェックエンドポイント（Kubernetesのliveness probe用）
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// レディネスチェックエンドポイント（Kubernetesのreadiness probe用）
app.get('/ready', async (req, res) => {
  try {
    // データベース接続確認
    await pgPool.query('SELECT 1');
    
    // Redis接続確認
    if (redisClient) {
      await redisClient.ping();
    }
    
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      redis: redisClient ? 'connected' : 'not configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('レディネスチェック失敗:', error);
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API エンドポイント
app.get('/api/status', (req, res) => {
  res.json({
    message: 'Kubernetes学習用サンプルアプリケーション',
    version: '1.0.0',
    platform: 'Kubernetes',
    comparison: 'AWS ECS管理者向け学習リソース',
    pod: {
      hostname: require('os').hostname(),
      platform: require('os').platform(),
      arch: require('os').arch()
    }
  });
});

// データベーステスト用エンドポイント
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT NOW() as current_time, version() as version');
    res.json({
      success: true,
      data: result.rows[0],
      message: 'データベース接続テスト成功'
    });
  } catch (error) {
    console.error('データベーステストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'データベース接続テスト失敗'
    });
  }
});

// Redisテスト用エンドポイント
app.get('/api/redis-test', async (req, res) => {
  try {
    if (!redisClient) {
      throw new Error('Redis client not configured');
    }
    
    const testKey = 'test-key';
    const testValue = `test-${Date.now()}`;
    
    await redisClient.set(testKey, testValue);
    const retrievedValue = await redisClient.get(testKey);
    await redisClient.del(testKey);
    
    res.json({
      success: true,
      test: {
        set_value: testValue,
        retrieved_value: retrievedValue,
        match: testValue === retrievedValue
      },
      message: 'Redis接続テスト成功'
    });
  } catch (error) {
    console.error('Redisテストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Redis接続テスト失敗'
    });
  }
});

// セッションテスト用エンドポイント
app.get('/api/session-test', (req, res) => {
  if (!req.session.visits) {
    req.session.visits = 0;
  }
  req.session.visits++;
  
  res.json({
    success: true,
    session_id: req.sessionID,
    visits: req.session.visits,
    message: 'セッションテスト成功'
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('アプリケーションエラー:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Requested resource not found'
  });
});

// グレースフルシャットダウン
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  try {
    if (redisClient) {
      await redisClient.quit();
    }
    await pgPool.end();
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error);
    process.exit(1);
  }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Kubernetesサンプルアプリケーション起動中...');
  console.log(`📍 ポート: ${PORT}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🐳 ホスト名: ${require('os').hostname()}`);
  console.log('================================');
  console.log('📚 AWS ECS管理者向けKubernetes学習アプリ');
  console.log('🔗 エンドポイント:');
  console.log('   / - メインページ');
  console.log('   /health - ヘルスチェック');
  console.log('   /ready - レディネスチェック');
  console.log('   /api/status - アプリステータス');
  console.log('   /api/db-test - データベーステスト');
  console.log('   /api/redis-test - Redis接続テスト');
  console.log('   /api/session-test - セッションテスト');
  console.log('================================');
});
