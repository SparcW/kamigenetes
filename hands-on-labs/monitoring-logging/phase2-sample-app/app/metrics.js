const promClient = require('prom-client');

// デフォルトメトリクスの収集を有効化
promClient.collectDefaultMetrics({
  prefix: 'webapp_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 10
});

// カスタムメトリクスの定義

// HTTPリクエスト処理時間のヒストグラム
const httpRequestDuration = new promClient.Histogram({
  name: 'webapp_http_request_duration_seconds',
  help: 'HTTPリクエスト処理時間（秒）',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// HTTPリクエスト総数のカウンター
const httpRequestsTotal = new promClient.Counter({
  name: 'webapp_http_requests_total',
  help: 'HTTPリクエスト総数',
  labelNames: ['method', 'route', 'status_code']
});

// アクティブな接続数のゲージ
const activeConnections = new promClient.Gauge({
  name: 'webapp_active_connections',
  help: 'アクティブなHTTP接続数'
});

// データベース関連メトリクス
const dbConnectionPool = new promClient.Gauge({
  name: 'webapp_database_connections_active',
  help: 'アクティブなデータベース接続数'
});

const dbQueryDuration = new promClient.Histogram({
  name: 'webapp_database_query_duration_seconds',
  help: 'データベースクエリ実行時間（秒）',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

const dbQueriesTotal = new promClient.Counter({
  name: 'webapp_database_queries_total',
  help: 'データベースクエリ実行回数',
  labelNames: ['query_type', 'table', 'status']
});

// ビジネスメトリクス
const userRegistrations = new promClient.Counter({
  name: 'webapp_user_registrations_total',
  help: 'ユーザー登録数'
});

const userLogins = new promClient.Counter({
  name: 'webapp_user_logins_total',
  help: 'ユーザーログイン数',
  labelNames: ['status']
});

// キャッシュ関連メトリクス
const cacheHits = new promClient.Counter({
  name: 'webapp_cache_hits_total',
  help: 'キャッシュヒット数',
  labelNames: ['cache_type']
});

const cacheMisses = new promClient.Counter({
  name: 'webapp_cache_misses_total',
  help: 'キャッシュミス数',
  labelNames: ['cache_type']
});

// アプリケーション固有メトリクス
const apiErrors = new promClient.Counter({
  name: 'webapp_api_errors_total',
  help: 'APIエラー発生回数',
  labelNames: ['endpoint', 'error_type']
});

const backgroundJobs = new promClient.Counter({
  name: 'webapp_background_jobs_total',
  help: 'バックグラウンドジョブ実行回数',
  labelNames: ['job_type', 'status']
});

// メトリクス記録用のミドルウェア関数
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // アクティブ接続数増加
  activeConnections.inc();
  
  // レスポンス完了時の処理
  const originalSend = res.send;
  res.send = function(data) {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    // HTTPメトリクス記録
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    
    // アクティブ接続数減少
    activeConnections.dec();
    
    // エラーの場合は専用メトリクス記録
    if (res.statusCode >= 400) {
      apiErrors
        .labels(route, res.statusCode >= 500 ? 'server_error' : 'client_error')
        .inc();
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// データベースメトリクス記録用関数
const recordDbMetrics = (queryType, table, duration, success = true) => {
  dbQueryDuration
    .labels(queryType, table)
    .observe(duration);
  
  dbQueriesTotal
    .labels(queryType, table, success ? 'success' : 'error')
    .inc();
};

// キャッシュメトリクス記録用関数
const recordCacheMetrics = (cacheType, hit = true) => {
  if (hit) {
    cacheHits.labels(cacheType).inc();
  } else {
    cacheMisses.labels(cacheType).inc();
  }
};

// ビジネスメトリクス記録用関数
const recordBusinessMetrics = {
  userRegistration: () => userRegistrations.inc(),
  userLogin: (success = true) => userLogins.labels(success ? 'success' : 'failed').inc(),
  backgroundJob: (jobType, success = true) => backgroundJobs.labels(jobType, success ? 'success' : 'failed').inc()
};

// データベース接続プール監視関数（定期実行用）
const updateDbPoolMetrics = (pool) => {
  if (pool && pool.totalCount !== undefined) {
    dbConnectionPool.set(pool.totalCount - pool.idleCount);
  }
};

// メトリクス取得エンドポイント用関数
const getMetrics = () => {
  return promClient.register.metrics();
};

// メトリクス初期化関数
const initMetrics = () => {
  // 初期値設定
  activeConnections.set(0);
  dbConnectionPool.set(0);
  
  console.log('Prometheus metrics initialized');
};

module.exports = {
  metricsMiddleware,
  recordDbMetrics,
  recordCacheMetrics,
  recordBusinessMetrics,
  updateDbPoolMetrics,
  getMetrics,
  initMetrics,
  
  // 直接アクセス用（必要に応じて）
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections,
  dbConnectionPool,
  userRegistrations,
  apiErrors
};
