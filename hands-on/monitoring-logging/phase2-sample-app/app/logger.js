const winston = require('winston');

// ログレベルの定義
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

// 開発環境とプロダクション環境でのログ形式の違い
const isDevelopment = process.env.NODE_ENV === 'development';
const logFormat = process.env.LOG_FORMAT === 'production' ? 'json' : 'development';

// カスタムログ形式の定義
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logEntry = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    // エラーの場合はスタックトレースを追加
    if (stack) {
      logEntry += `\n${stack}`;
    }
    
    // 追加のメタデータがある場合は表示
    if (Object.keys(meta).length > 0) {
      logEntry += ` ${JSON.stringify(meta)}`;
    }
    
    return logEntry;
  })
);

// JSON形式のログ設定
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Kubernetesメタデータの追加
    const logEntry = {
      '@timestamp': info.timestamp,
      level: info.level,
      message: info.message,
      service: 'monitoring-webapp',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      // Kubernetes関連メタデータ
      kubernetes: {
        pod: process.env.HOSTNAME || 'unknown',
        namespace: process.env.NAMESPACE || 'default',
        node: process.env.NODE_NAME || 'unknown'
      },
      ...info
    };
    
    // プライベート情報を除去
    delete logEntry.timestamp;
    
    return JSON.stringify(logEntry);
  })
);

// ロガーの作成
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: logFormat === 'json' ? jsonFormat : customFormat,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
});

// リクエストログ用のミドルウェア関数
logger.requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || require('uuid').v4();
  
  // リクエストIDをレスポンスヘッダーに追加
  res.setHeader('X-Request-ID', requestId);
  
  // リクエスト開始ログ
  logger.info('HTTP Request Started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    headers: req.headers
  });
  
  // レスポンス完了時の処理
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('HTTP Request Completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: duration,
      contentLength: data ? data.length : 0
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

// エラーログ用のミドルウェア関数
logger.errorLogger = (err, req, res, next) => {
  const requestId = res.getHeader('X-Request-ID');
  
  logger.error('HTTP Request Error', {
    requestId,
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
    statusCode: err.status || 500
  });
  
  next(err);
};

// ログレベル動的変更機能
logger.setLevel = (level) => {
  if (logLevels.hasOwnProperty(level)) {
    logger.level = level;
    logger.info('Log level changed', { newLevel: level });
    return true;
  }
  return false;
};

// ログレベル取得機能
logger.getLevel = () => {
  return logger.level;
};

module.exports = logger;
