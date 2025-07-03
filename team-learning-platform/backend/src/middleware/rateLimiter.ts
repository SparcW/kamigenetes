import rateLimit from 'express-rate-limit';

/**
 * レート制限ミドルウェア
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // デフォルトは100リクエスト
  message: 'リクエストが多すぎます。しばらくしてから再試行してください。',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * カスタムレート制限ミドルウェア
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};
