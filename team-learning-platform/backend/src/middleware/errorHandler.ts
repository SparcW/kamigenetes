import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // デフォルトエラー情報
  let error = { ...err };
  error.message = err.message;
  
  // Prismaエラーの処理
  if (err.name === 'PrismaClientKnownRequestError') {
    error.statusCode = 400;
    error.message = 'Database operation failed';
  }
  
  // JWT エラーの処理
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid token';
  }
  
  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Token expired';
  }
  
  // バリデーションエラーの処理
  if (err.name === 'ValidationError') {
    error.statusCode = 400;
    error.message = 'Validation failed';
  }
  
  const statusCode = error.statusCode || 500;
  
  // ログ出力
  if (statusCode >= 500) {
    console.error('❌ Server Error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  } else {
    console.warn('⚠️ Client Error:', {
      error: err.message,
      url: req.url,
      method: req.method,
      statusCode,
    });
  }
  
  // レスポンス
  res.status(statusCode).json({
    success: false,
    error: {
      message: error.message,
      statusCode,
      ...(isDevelopment && { 
        stack: err.stack,
        details: err,
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method,
  });
};
