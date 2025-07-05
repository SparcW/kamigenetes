import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

import { config } from '../../src/config/config';
import { errorHandler } from '../../src/middleware/errorHandler';
import { notFoundHandler } from '../../src/middleware/notFoundHandler';

// テスト用ルート
import authRoutes from '../../src/routes/auth';
import examRoutes from '../../src/routes/exam';
import documentRoutes from '../../src/routes/documents';

// テスト用アプリケーション作成
export const createTestApp = () => {
  const app = express();

  // テスト用に簡易設定
  app.use(helmet());
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // JSON パース
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // テスト用セッション設定（メモリストア）
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    name: 'test-session',
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      sameSite: 'lax',
    },
  }));

  // Passport初期化
  app.use(passport.initialize());
  app.use(passport.session());

  // ヘルスチェック
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'test',
      version: '1.0.0',
    });
  });

  // API ルート
  app.use('/api/auth', authRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/documents', documentRoutes);

  // API ルートのドキュメント
  app.get('/api', (req, res) => {
    res.json({
      name: 'Team Learning Platform API (Test)',
      version: '1.0.0',
      description: 'Kubernetes学習チームプラットフォーム API - テスト環境',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        teams: '/api/teams',
        documents: '/api/documents',
        progress: '/api/progress',
        exams: '/api/exams',
        analytics: '/api/analytics',
      },
      health: '/health',
    });
  });

  // エラーハンドリング
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};