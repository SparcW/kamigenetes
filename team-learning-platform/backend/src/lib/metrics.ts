// カスタムメトリクス定義
// team-learning-platform/backend/src/lib/metrics.ts

import { Counter, Histogram, Gauge, register } from 'prom-client';

// === HTTP関連メトリクス ===
export const httpRequestsTotal = new Counter({
  name: 'team_learning_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_id'],
});

export const httpRequestDuration = new Histogram({
  name: 'team_learning_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpErrorsTotal = new Counter({
  name: 'team_learning_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
});

// === 認証関連メトリクス ===
export const authAttemptsTotal = new Counter({
  name: 'team_learning_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'status'], // method: login/logout, status: success/failure
});

export const activeSessionsGauge = new Gauge({
  name: 'team_learning_active_sessions',
  help: 'Number of active user sessions',
});

export const sessionDuration = new Histogram({
  name: 'team_learning_session_duration_seconds',
  help: 'Duration of user sessions in seconds',
  labelNames: ['user_role'],
  buckets: [300, 600, 1800, 3600, 7200, 14400, 28800], // 5min, 10min, 30min, 1h, 2h, 4h, 8h
});

// === データベース関連メトリクス ===
export const dbConnectionsActive = new Gauge({
  name: 'team_learning_db_connections_active',
  help: 'Number of active database connections',
  labelNames: ['database_type'], // postgresql, redis
});

export const dbQueryDuration = new Histogram({
  name: 'team_learning_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['database_type', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const dbQueriesTotal = new Counter({
  name: 'team_learning_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['database_type', 'operation', 'status'],
});

// === 学習関連ビジネスメトリクス ===
export const learningEventsTotal = new Counter({
  name: 'team_learning_learning_events_total',
  help: 'Total number of learning events',
  labelNames: ['user_id', 'event_type', 'course_section'],
});

export const documentViewsTotal = new Counter({
  name: 'team_learning_document_views_total',
  help: 'Total number of document views',
  labelNames: ['document_id', 'user_id', 'user_role'],
});

export const progressUpdatesTotal = new Counter({
  name: 'team_learning_progress_updates_total',
  help: 'Total number of progress updates',
  labelNames: ['user_id', 'document_id', 'progress_percentage_range'],
});

export const examAttemptsTotal = new Counter({
  name: 'team_learning_exam_attempts_total',
  help: 'Total number of exam attempts',
  labelNames: ['exam_id', 'user_id', 'exam_type', 'result'],
});

export const examScoresHistogram = new Histogram({
  name: 'team_learning_exam_scores',
  help: 'Distribution of exam scores',
  labelNames: ['exam_id', 'exam_type'],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

// === システムリソースメトリクス ===
export const memoryUsageGauge = new Gauge({
  name: 'team_learning_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // heap_used, heap_total, external, rss
});

export const cpuUsageGauge = new Gauge({
  name: 'team_learning_cpu_usage_percent',
  help: 'CPU usage percentage',
});

// === アクティブユーザー関連メトリクス ===
export const activeUsersGauge = new Gauge({
  name: 'team_learning_active_users',
  help: 'Number of active users',
  labelNames: ['time_range'], // 5min, 15min, 1hour, 1day
});

export const userActionsTotal = new Counter({
  name: 'team_learning_user_actions_total',
  help: 'Total number of user actions',
  labelNames: ['action_type', 'user_role'],
});

// === エラー・アラート関連メトリクス ===
export const errorRateGauge = new Gauge({
  name: 'team_learning_error_rate_percent',
  help: 'Error rate percentage over time window',
  labelNames: ['time_window', 'error_type'],
});

export const responseTimeP95 = new Gauge({
  name: 'team_learning_response_time_p95_seconds',
  help: '95th percentile response time',
  labelNames: ['endpoint_group'],
});

// === ドキュメントAPI専用メトリクス ===

// ドキュメント取得回数（カテゴリ別）
export const documentViewsCounter = new Counter({
  name: 'document_views_total',
  help: 'Total number of document views',
  labelNames: ['category', 'document_name', 'user_id'],
});

// ドキュメント検索回数
export const documentSearchCounter = new Counter({
  name: 'document_search_total',
  help: 'Total number of document searches',
  labelNames: ['search_type', 'category', 'has_results'],
});

// ドキュメント検索結果数
export const documentSearchResultsHistogram = new Histogram({
  name: 'document_search_results_count',
  help: 'Number of search results returned',
  buckets: [0, 1, 5, 10, 25, 50, 100],
  labelNames: ['search_type', 'category'],
});

// ドキュメント検索応答時間
export const documentSearchDuration = new Histogram({
  name: 'document_search_duration_seconds',
  help: 'Time spent on document search operations',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
  labelNames: ['search_type', 'category'],
});

// カテゴリ別人気ランキング
export const documentCategoryCounter = new Counter({
  name: 'document_category_access_total',
  help: 'Total number of category accesses',
  labelNames: ['category'],
});

// ドキュメント取得エラー
export const documentErrorCounter = new Counter({
  name: 'document_errors_total',
  help: 'Total number of document access errors',
  labelNames: ['error_type', 'category', 'endpoint'],
});

// ドキュメント取得時間
export const documentResponseTime = new Histogram({
  name: 'document_response_time_seconds',
  help: 'Time to serve document requests',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
  labelNames: ['endpoint', 'category'],
});

// タグ検索の利用状況
export const documentTagSearchCounter = new Counter({
  name: 'document_tag_search_total',
  help: 'Total number of tag-based searches',
  labelNames: ['tag_count', 'has_results'],
});

// === 進捗API専用メトリクス ===

// 進捗更新回数
export const progressUpdateCounter = new Counter({
  name: 'progress_updates_total',
  help: 'Total number of progress updates',
  labelNames: ['user_id', 'category', 'is_completion'],
});

// 進捗取得時間
export const progressResponseTime = new Histogram({
  name: 'progress_response_time_seconds',
  help: 'Time to serve progress requests',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
  labelNames: ['endpoint', 'operation'],
});

// 読書時間記録
export const readingTimeHistogram = new Histogram({
  name: 'reading_time_minutes',
  help: 'Distribution of reading time per session',
  buckets: [1, 5, 10, 15, 30, 60, 120, 240],
  labelNames: ['category', 'user_id'],
});

// お気に入り追加回数
export const favoriteCounter = new Counter({
  name: 'favorites_total',
  help: 'Total number of favorites added',
  labelNames: ['category', 'user_id'],
});

// === 認証API専用メトリクス ===

// ログイン試行回数
export const loginAttemptsCounter = new Counter({
  name: 'login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status', 'auth_type'], // status: success/failure, auth_type: local/oauth
});

// セッション継続時間
export const sessionDurationHistogram = new Histogram({
  name: 'session_duration_seconds',
  help: 'Distribution of session duration',
  buckets: [300, 600, 1800, 3600, 7200, 14400, 28800],
  labelNames: ['user_role'],
});

// === 試験API専用メトリクス ===

// 試験開始回数
export const examStartCounter = new Counter({
  name: 'exam_starts_total',
  help: 'Total number of exam starts',
  labelNames: ['exam_type', 'category', 'difficulty'],
});

// 試験完了回数
export const examCompletionCounter = new Counter({
  name: 'exam_completions_total',
  help: 'Total number of exam completions',
  labelNames: ['exam_type', 'category', 'passed'],
});

// 試験スコア分布
export const examScoreHistogram = new Histogram({
  name: 'exam_scores',
  help: 'Distribution of exam scores',
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  labelNames: ['exam_type', 'category'],
});

// 試験所要時間
export const examDurationHistogram = new Histogram({
  name: 'exam_duration_seconds',
  help: 'Time spent on exams',
  buckets: [60, 300, 600, 900, 1800, 3600, 7200],
  labelNames: ['exam_type', 'category'],
});

// === 分析API専用メトリクス ===

// リーダーボード取得回数
export const leaderboardRequestsCounter = new Counter({
  name: 'analytics_leaderboard_requests_total',
  help: 'Total number of leaderboard requests',
  labelNames: ['category', 'user_id'],
});

// 統計データ取得回数
export const statisticsRequestsCounter = new Counter({
  name: 'analytics_statistics_requests_total',
  help: 'Total number of statistics requests',
  labelNames: ['report_type', 'user_id'],
});

// チームパフォーマンス分析回数
export const teamPerformanceAnalysisCounter = new Counter({
  name: 'analytics_team_performance_analysis_total',
  help: 'Total number of team performance analysis requests',
  labelNames: ['team_id', 'analysis_type'],
});

// 個人パフォーマンス分析回数
export const individualPerformanceAnalysisCounter = new Counter({
  name: 'analytics_individual_performance_analysis_total',
  help: 'Total number of individual performance analysis requests',
  labelNames: ['user_id', 'analysis_type'],
});

// Analytics APIエラー追跡
export const analyticsErrorsCounter = new Counter({
  name: 'analytics_errors_total',
  help: 'Total number of analytics API errors',
  labelNames: ['error_type', 'endpoint'],
});

// Analytics API応答時間
export const analyticsResponseTimeHistogram = new Histogram({
  name: 'analytics_response_time_seconds',
  help: 'Analytics API response time in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
});

// === Users API専用メトリクス ===

// ユーザー一覧取得回数
export const userListRequestsCounter = new Counter({
  name: 'users_list_requests_total',
  help: 'Total number of user list requests',
  labelNames: ['search_type', 'role_filter', 'user_id'],
});

// ユーザー作成回数
export const userCreationCounter = new Counter({
  name: 'users_creation_total',
  help: 'Total number of user creation attempts',
  labelNames: ['role', 'status', 'created_by'],
});

// ユーザー更新回数
export const userUpdateCounter = new Counter({
  name: 'users_update_total',
  help: 'Total number of user update attempts',
  labelNames: ['field_updated', 'status', 'updated_by'],
});

// ユーザー削除回数
export const userDeletionCounter = new Counter({
  name: 'users_deletion_total',
  help: 'Total number of user deletion attempts',
  labelNames: ['deletion_type', 'status', 'deleted_by'],
});

// パスワード変更回数
export const passwordChangeCounter = new Counter({
  name: 'users_password_change_total',
  help: 'Total number of password change attempts',
  labelNames: ['change_type', 'status', 'user_id'],
});

// ユーザープロファイル取得回数
export const userProfileRequestsCounter = new Counter({
  name: 'users_profile_requests_total',
  help: 'Total number of user profile requests',
  labelNames: ['profile_type', 'requested_by'],
});

// Users APIエラー追跡
export const usersErrorsCounter = new Counter({
  name: 'users_errors_total',
  help: 'Total number of users API errors',
  labelNames: ['error_type', 'endpoint'],
});

// Users API応答時間
export const usersResponseTimeHistogram = new Histogram({
  name: 'users_response_time_seconds',
  help: 'Users API response time in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
});

// === ヘルパー関数 ===

// システムメトリクス更新関数
export const updateSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  memoryUsageGauge.labels('heap_used').set(memUsage.heapUsed);
  memoryUsageGauge.labels('heap_total').set(memUsage.heapTotal);
  memoryUsageGauge.labels('external').set(memUsage.external);
  memoryUsageGauge.labels('rss').set(memUsage.rss);

  // CPU使用率計算（簡易版）
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // マイクロ秒→秒
  cpuUsageGauge.set(cpuPercent);
};

// 定期実行でシステムメトリクスを更新
setInterval(updateSystemMetrics, 30000); // 30秒間隔

// メトリクス取得関数
export const getMetrics = () => {
  return register.metrics();
};

// メトリクス初期化関数
export const initializeMetrics = () => {
  console.log('🔥 Team Learning Platform メトリクスを初期化しました');

  // 初期値設定
  activeSessionsGauge.set(0);
  dbConnectionsActive.labels('postgresql').set(0);
  dbConnectionsActive.labels('redis').set(0);
  activeUsersGauge.labels('5min').set(0);
  activeUsersGauge.labels('15min').set(0);
  activeUsersGauge.labels('1hour').set(0);
  activeUsersGauge.labels('1day').set(0);

  // システムメトリクスの初期更新
  updateSystemMetrics();
};

// AWS ECS比較メモ:
// CloudWatchでは自動で提供される多くのメトリクスを、
// Kubernetesでは手動で実装・設定する必要がある。
// しかし、より詳細で柔軟なメトリクス収集が可能。
