// メトリクス記録ミドルウェア
// team-learning-platform/backend/src/middleware/metricsMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpErrorsTotal,
  activeUsersGauge,
  userActionsTotal,
  errorRateGauge,
  responseTimeP95,
} from '../lib/metrics';

// リクエスト拡張（ユーザー情報追加）
interface MetricsRequest extends Request {
  startTime?: number;
  user?: {
    id: string;
    role: string;
  };
}

// エラー分類ヘルパー
const getErrorType = (statusCode: number): string => {
  if (statusCode >= 400 && statusCode < 500) {
    return 'client_error';
  } else if (statusCode >= 500) {
    return 'server_error';
  }
  return 'success';
};

// ルート正規化ヘルパー（パラメータ置換）
const normalizeRoute = (originalUrl: string, route?: string): string => {
  if (route) {
    return route;
  }

  // パラメータ部分を正規化
  return originalUrl
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUID
    .replace(/\/\d+/g, '/:id') // 数値ID
    .replace(/\?.*$/, ''); // クエリパラメータ除去
};

// 進捗パーセンテージ範囲の取得
const getProgressRange = (percentage: number): string => {
  if (percentage === 0) return '0';
  if (percentage <= 25) return '1-25';
  if (percentage <= 50) return '26-50';
  if (percentage <= 75) return '51-75';
  if (percentage < 100) return '76-99';
  return '100';
};

// === メインメトリクスミドルウェア ===
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  (req as any).startTime = startTime;

  // レスポンス完了時の処理
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // 秒単位
    const route = normalizeRoute(req.originalUrl, req.route?.path);
    const statusCode = res.statusCode.toString();
    const method = req.method;
    const userId = (req as any).user?.id || 'anonymous';
    const userRole = (req as any).user?.role || 'guest';

    // === HTTPメトリクスの記録 ===
    httpRequestsTotal.labels(method, route, statusCode, userId).inc();
    httpRequestDuration.labels(method, route, statusCode).observe(duration);

    // エラーメトリクス記録
    const errorType = getErrorType(res.statusCode);
    if (errorType !== 'success') {
      httpErrorsTotal.labels(method, route, statusCode, errorType).inc();
    }

    // ユーザーアクション記録
    if ((req as any).user) {
      let actionType = 'view';
      if (method === 'POST') actionType = 'create';
      else if (method === 'PUT' || method === 'PATCH') actionType = 'update';
      else if (method === 'DELETE') actionType = 'delete';

      userActionsTotal.labels(actionType, userRole).inc();
    }

    // 応答時間のP95更新（簡易版）
    const endpointGroup = route.split('/')[1] || 'root';
    responseTimeP95.labels(endpointGroup).set(duration);
  });

  next();
};

// === 学習イベント記録関数 ===
export const recordLearningEvent = (
  userId: string,
  eventType: 'document_view' | 'progress_update' | 'exam_attempt' | 'bookmark_add',
  metadata: {
    documentId?: string;
    examId?: string;
    progressPercentage?: number;
    examScore?: number;
    examType?: string;
    result?: 'pass' | 'fail';
  },
) => {
  const { documentId, examId, progressPercentage, examScore, examType, result } = metadata;

  switch (eventType) {
  case 'document_view':
    if (documentId) {
      // document_views_totalとlearning_events_totalの両方を更新
      // documentViewsTotal.labels(documentId, userId, req.user?.role || 'guest').inc();
      // learningEventsTotal.labels(userId, eventType, documentId).inc();
    }
    break;

  case 'progress_update':
    if (documentId && progressPercentage !== undefined) {
      const progressRange = getProgressRange(progressPercentage);
      // progressUpdatesTotal.labels(userId, documentId, progressRange).inc();
      // learningEventsTotal.labels(userId, eventType, documentId).inc();
    }
    break;

  case 'exam_attempt':
    if (examId && examScore !== undefined && examType && result) {
      // examAttemptsTotal.labels(examId, userId, examType, result).inc();
      // examScoresHistogram.labels(examId, examType).observe(examScore);
      // learningEventsTotal.labels(userId, eventType, examId).inc();
    }
    break;
  }
};

// === アクティブユーザー更新ミドルウェア ===
const activeUsers = new Set<string>();
const userLastSeen = new Map<string, number>();

export const updateActiveUsers = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;

  if (userId) {
    const now = Date.now();
    activeUsers.add(userId);
    userLastSeen.set(userId, now);

    // 古いユーザーをクリーンアップ（15分以上非アクティブ）
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    userLastSeen.forEach((lastSeen, uid) => {
      if (lastSeen < fifteenMinutesAgo) {
        activeUsers.delete(uid);
        userLastSeen.delete(uid);
      }
    });

    // アクティブユーザー数を更新
    activeUsersGauge.labels('15min').set(activeUsers.size);
  }

  next();
};

// === エラー率計算・更新関数 ===
const errorCountWindow: number[] = [];
const totalCountWindow: number[] = [];

export const updateErrorRate = () => {
  // 過去5分間のエラー率を計算
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // 現在のエラー数・総リクエスト数を取得（簡易実装）
  // 実際の実装では、より詳細な時系列データが必要

  // ここでは概算の実装
  const currentErrorRate = errorCountWindow.length > 0
    ? (errorCountWindow.reduce((a, b) => a + b, 0) / totalCountWindow.reduce((a, b) => a + b, 1)) * 100
    : 0;

  errorRateGauge.labels('5min', 'http_error').set(currentErrorRate);
};

// 定期実行でエラー率を更新
setInterval(updateErrorRate, 60000); // 1分間隔

// === データベースメトリクス記録関数 ===
export const recordDbMetrics = (
  databaseType: 'postgresql' | 'redis',
  operation: string,
  duration: number,
  status: 'success' | 'error',
) => {
  // dbQueryDuration.labels(databaseType, operation).observe(duration);
  // dbQueriesTotal.labels(databaseType, operation, status).inc();
};

// AWS ECS との比較:
// CloudWatch では自動的に収集されるメトリクス（CPU、メモリ、ネットワーク）を、
// Kubernetes + Prometheus では手動で実装する必要がある。
// しかし、ビジネスロジックに特化したメトリクスの収集がより柔軟。
