// カスタムメトリクス・ログ設定
// ビジネス指標とアプリケーション固有のメトリクス

import { metrics, trace } from '@opentelemetry/api';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import winston from 'winston';
import ElasticsearchTransport from 'winston-elasticsearch';

// Prometheus メトリクス設定
export class CustomMetrics {
  // HTTPリクエストメトリクス
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  
  // ビジネスメトリクス
  public readonly activeUsersGauge: Gauge<string>;
  public readonly learningProgressCounter: Counter<string>;
  public readonly quizAttemptsCounter: Counter<string>;
  public readonly teamActivitiesCounter: Counter<string>;
  
  // システムメトリクス
  public readonly databaseQueriesCounter: Counter<string>;
  public readonly redisOperationsCounter: Counter<string>;
  public readonly errorCounter: Counter<string>;

  constructor() {
    // HTTPリクエストメトリクス
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_role'],
      registers: [register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
      registers: [register]
    });

    // ビジネスメトリクス
    this.activeUsersGauge = new Gauge({
      name: 'active_users_total',
      help: 'Number of currently active users',
      labelNames: ['user_type'],
      registers: [register]
    });

    this.learningProgressCounter = new Counter({
      name: 'learning_progress_total',
      help: 'Total learning progress events',
      labelNames: ['user_id', 'course_id', 'progress_type'],
      registers: [register]
    });

    this.quizAttemptsCounter = new Counter({
      name: 'quiz_attempts_total',
      help: 'Total quiz attempts',
      labelNames: ['user_id', 'quiz_id', 'result'],
      registers: [register]
    });

    this.teamActivitiesCounter = new Counter({
      name: 'team_activities_total',
      help: 'Total team activities',
      labelNames: ['team_id', 'activity_type', 'user_role'],
      registers: [register]
    });

    // システムメトリクス
    this.databaseQueriesCounter = new Counter({
      name: 'database_queries_total',
      help: 'Total database queries',
      labelNames: ['operation', 'table', 'status'],
      registers: [register]
    });

    this.redisOperationsCounter = new Counter({
      name: 'redis_operations_total',
      help: 'Total Redis operations',
      labelNames: ['operation', 'key_pattern'],
      registers: [register]
    });

    this.errorCounter = new Counter({
      name: 'application_errors_total',
      help: 'Total application errors',
      labelNames: ['error_type', 'severity', 'component'],
      registers: [register]
    });
  }

  // アクティブユーザー数更新
  updateActiveUsers(count: number, userType: string = 'total'): void {
    this.activeUsersGauge.set({ user_type: userType }, count);
  }

  // 学習進捗記録
  recordLearningProgress(userId: string, courseId: string, progressType: string): void {
    // 個人情報保護: userIdをハッシュ化
    const hashedUserId = this.hashUserId(userId);
    this.learningProgressCounter.inc({
      user_id: hashedUserId,
      course_id: courseId,
      progress_type: progressType
    });
  }

  // クイズ試行記録
  recordQuizAttempt(userId: string, quizId: string, result: string): void {
    const hashedUserId = this.hashUserId(userId);
    this.quizAttemptsCounter.inc({
      user_id: hashedUserId,
      quiz_id: quizId,
      result: result
    });
  }

  // チーム活動記録
  recordTeamActivity(teamId: string, activityType: string, userRole: string): void {
    this.teamActivitiesCounter.inc({
      team_id: teamId,
      activity_type: activityType,
      user_role: userRole
    });
  }

  // データベースクエリ記録
  recordDatabaseQuery(operation: string, table: string, status: string): void {
    this.databaseQueriesCounter.inc({
      operation: operation,
      table: table,
      status: status
    });
  }

  // Redis操作記録
  recordRedisOperation(operation: string, keyPattern: string): void {
    this.redisOperationsCounter.inc({
      operation: operation,
      key_pattern: keyPattern
    });
  }

  // エラー記録
  recordError(errorType: string, severity: string, component: string): void {
    this.errorCounter.inc({
      error_type: errorType,
      severity: severity,
      component: component
    });
  }

  // ユーザーIDハッシュ化（個人情報保護）
  private hashUserId(userId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  }
}

// 構造化ログ設定
export class StructuredLogger {
  private logger: winston.Logger;

  constructor() {
    // Elasticsearch transport設定
    const esTransport = new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      },
      index: 'team-learning-logs',
      indexPrefix: 'team-learning-logs',
      indexSuffixPattern: 'YYYY.MM.DD',
      transformer: (logData: any) => {
        // ログデータの変換・個人情報除去
        return this.transformLogData(logData);
      }
    });

    // Winston logger設定
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf((info) => {
          // トレース情報の追加
          const span = trace.getActiveSpan();
          if (span) {
            const spanContext = span.spanContext();
            info.trace_id = spanContext.traceId;
            info.span_id = spanContext.spanId;
          }
          
          // サービス情報の追加
          info.service = 'team-learning-backend';
          info.environment = process.env.NODE_ENV || 'development';
          info.version = process.env.npm_package_version || '1.0.0';
          
          return JSON.stringify(info);
        })
      ),
      transports: [
        // コンソール出力
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // ファイル出力
        new winston.transports.File({
          filename: '/var/log/team-learning/app.log',
          format: winston.format.json()
        }),
        // Elasticsearch出力
        esTransport
      ]
    });
  }

  // ログデータ変換（個人情報除去）
  private transformLogData(logData: any): any {
    const transformed = { ...logData };
    
    // 個人情報フィールドの除去
    const sensitiveFields = ['password', 'email', 'phone', 'ssn', 'token', 'secret'];
    sensitiveFields.forEach(field => {
      if (transformed[field]) {
        transformed[field] = '[REDACTED]';
      }
    });

    // ユーザーIDのハッシュ化
    if (transformed.userId) {
      transformed.userId = this.hashValue(transformed.userId);
    }

    // IPアドレスの部分マスキング
    if (transformed.ip) {
      transformed.ip = this.maskIpAddress(transformed.ip);
    }

    return transformed;
  }

  // 値のハッシュ化
  private hashValue(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
  }

  // IPアドレスのマスキング
  private maskIpAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'xxx.xxx.xxx.xxx';
  }

  // ログメソッド
  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // ビジネスイベントログ
  logUserAction(userId: string, action: string, details?: any): void {
    this.info('User action', {
      userId: this.hashValue(userId),
      action: action,
      details: details,
      category: 'user_action'
    });
  }

  logLearningEvent(userId: string, courseId: string, event: string, progress?: number): void {
    this.info('Learning event', {
      userId: this.hashValue(userId),
      courseId: courseId,
      event: event,
      progress: progress,
      category: 'learning'
    });
  }

  logSecurityEvent(event: string, severity: string, details?: any): void {
    this.warn('Security event', {
      event: event,
      severity: severity,
      details: details,
      category: 'security'
    });
  }
}

// シングルトンインスタンス
export const customMetrics = new CustomMetrics();
export const structuredLogger = new StructuredLogger();
