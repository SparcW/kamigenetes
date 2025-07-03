// Express ミドルウェア統合
// OpenTelemetry、メトリクス、ログの統合

import { Request, Response, NextFunction } from 'express';
import { trace, context } from '@opentelemetry/api';
import { register } from 'prom-client';
import { customMetrics, structuredLogger } from './metrics';

// リクエスト追跡ミドルウェア
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // トレース情報をリクエストに追加
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;
    
    // スパンに追加属性を設定
    span.setAttributes({
      'http.route': req.route?.path || req.path,
      'user.id': req.user?.id || 'anonymous',
      'user.role': req.user?.role || 'guest',
      'request.id': req.headers['x-request-id'] || 'unknown'
    });
  }

  // レスポンス終了時の処理
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const userRole = req.user?.role || 'guest';

    // HTTPメトリクス記録
    customMetrics.httpRequestsTotal.inc({
      method: method,
      route: route,
      status_code: statusCode,
      user_role: userRole
    });

    customMetrics.httpRequestDuration.observe(
      { method: method, route: route, status_code: statusCode },
      duration
    );

    // 構造化ログ出力
    structuredLogger.info('HTTP Request', {
      method: method,
      route: route,
      statusCode: statusCode,
      duration: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id,
      userRole: userRole,
      requestId: req.headers['x-request-id'],
      traceId: req.traceId,
      spanId: req.spanId
    });

    // エラーレスポンスの場合
    if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
      customMetrics.recordError(
        statusCode.startsWith('4') ? 'client_error' : 'server_error',
        statusCode.startsWith('5') ? 'high' : 'medium',
        'http_handler'
      );
    }
  });

  next();
};

// Prometheusメトリクスエンドポイント
export const metricsEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error generating metrics');
    structuredLogger.error('Failed to generate metrics', { error: error });
  }
};

// ヘルスチェックエンドポイント
export const healthCheck = (req: Request, res: Response): void => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'team-learning-backend',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    traceId: req.traceId || 'no-trace'
  };

  res.status(200).json(healthData);
  
  structuredLogger.info('Health check', {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
};

// 詳細ヘルスチェック（依存サービス確認）
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  const checks = {
    database: false,
    redis: false,
    otel: false
  };

  try {
    // データベース接続確認
    // TODO: Prismaクライアントでの接続確認を実装
    checks.database = true;

    // Redis接続確認
    // TODO: Redisクライアントでの接続確認を実装
    checks.redis = true;

    // OpenTelemetry確認
    const span = trace.getActiveSpan();
    checks.otel = span !== undefined;

    const allHealthy = Object.values(checks).every(check => check === true);
    const status = allHealthy ? 'ready' : 'not-ready';
    const statusCode = allHealthy ? 200 : 503;

    const readinessData = {
      status: status,
      timestamp: new Date().toISOString(),
      checks: checks,
      traceId: req.traceId || 'no-trace'
    };

    res.status(statusCode).json(readinessData);
    
    structuredLogger.info('Readiness check', {
      status: status,
      checks: checks
    });

  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      checks: checks,
      traceId: req.traceId || 'no-trace'
    });

    structuredLogger.error('Readiness check failed', { error: error });
  }
};

// エラーハンドリングミドルウェア
export const errorTrackingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // エラーメトリクス記録
  customMetrics.recordError(
    error.name || 'UnknownError',
    'high',
    'application'
  );

  // エラーログ出力
  structuredLogger.error('Application error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    },
    user: {
      id: req.user?.id,
      role: req.user?.role
    },
    traceId: req.traceId,
    spanId: req.spanId
  });

  // スパンにエラー情報を記録
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: 2, // ERROR
      message: error.message
    });
  }

  next(error);
};

// ビジネスメトリクス記録ヘルパー
export const recordUserActivity = (userId: string, activity: string, details?: any): void => {
  // メトリクス記録
  customMetrics.recordLearningProgress(userId, 'general', activity);
  
  // ログ記録
  structuredLogger.logUserAction(userId, activity, details);
};

export const recordLearningEvent = (
  userId: string,
  courseId: string,
  event: string,
  progress?: number
): void => {
  // メトリクス記録
  customMetrics.recordLearningProgress(userId, courseId, event);
  
  // ログ記録
  structuredLogger.logLearningEvent(userId, courseId, event, progress);
};

export const recordQuizResult = (
  userId: string,
  quizId: string,
  score: number,
  passed: boolean
): void => {
  // メトリクス記録
  customMetrics.recordQuizAttempt(userId, quizId, passed ? 'pass' : 'fail');
  
  // ログ記録
  structuredLogger.logLearningEvent(userId, quizId, 'quiz_completed', score);
};

// Express Request型拡張
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
      user?: {
        id: string;
        role: string;
        email?: string;
      };
    }
  }
}
