import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';

import { config } from './config/config';
import { configurePassport } from './config/passport';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

// ルート
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import documentRoutes from './routes/documents';
import progressRoutes from './routes/progress';
import examRoutes from './routes/exams';
import analyticsRoutes from './routes/analytics';

class App {
  public app: express.Application;
  public prisma: PrismaClient;
  private redisClient: any;

  constructor() {
    this.app = express();
    this.prisma = new PrismaClient();
    this.initializeRedis();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: config.redis.url,
        password: config.redis.password,
      });

      this.redisClient.on('error', (err: Error) => {
        console.error('❌ Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        console.log('🔗 Redis Connected');
      });

      await this.redisClient.connect();
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddlewares() {
    // セキュリティ
    this.app.use(helmet());
    
    // CORS設定
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // レート制限
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分
      max: config.rateLimit.max, // 最大リクエスト数
      message: {
        error: 'Too many requests from this IP, please try again later.',
      },
    });
    this.app.use('/api', limiter);

    // ログ出力
    this.app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

    // JSON パース
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // セッション設定
    const redisStore = new RedisStore({
      client: this.redisClient,
      prefix: 'sess:',
    });

    this.app.use(session({
      store: redisStore,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      name: 'team-learning-session',
      cookie: {
        secure: config.nodeEnv === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        sameSite: 'lax',
      },
    }));

    // Passport初期化
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    configurePassport(this.prisma);

    // リクエスト情報をコンテキストに追加
    this.app.use((req, res, next) => {
      req.prisma = this.prisma;
      req.redis = this.redisClient;
      next();
    });
  }

  private initializeRoutes() {
    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // API ルート
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/teams', teamRoutes);
    this.app.use('/api/documents', documentRoutes);
    this.app.use('/api/progress', progressRoutes);
    this.app.use('/api/exams', examRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    // API ルートのドキュメント
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Team Learning Platform API',
        version: '1.0.0',
        description: 'Kubernetes学習チームプラットフォーム API',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          teams: '/api/teams',
          documents: '/api/documents',
          progress: '/api/progress',
          exams: '/api/exams',
          analytics: '/api/analytics',
        },
        documentation: '/api/docs',
        health: '/health',
      });
    });
  }

  private initializeErrorHandling() {
    // 404 ハンドラー
    this.app.use(notFoundHandler);

    // エラーハンドラー
    this.app.use(errorHandler);
  }

  public async listen() {
    try {
      // データベース接続確認
      await this.prisma.$connect();
      console.log('✅ Database Connected');

      // サーバー起動
      const port = config.port;
      this.app.listen(port, () => {
        console.log('🚀 Team Learning Platform API Started');
        console.log(`📖 URL: http://localhost:${port}`);
        console.log(`🗄️  Database: Connected`);
        console.log(`🔴 Redis: Connected`);
        console.log(`🌍 Environment: ${config.nodeEnv}`);
        console.log(`🔐 Authentication: JWT + OAuth2.0`);
        console.log(`📊 Session Store: Redis`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  public async close() {
    try {
      await this.prisma.$disconnect();
      await this.redisClient.disconnect();
      console.log('📴 Server shut down gracefully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// グレースフルシャットダウン
const app = new App();

process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  await app.close();
  process.exit(0);
});

// サーバー起動
app.listen().catch((error) => {
  console.error('❌ Application startup failed:', error);
  process.exit(1);
});

export default app;
