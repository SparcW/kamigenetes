import dotenv from 'dotenv';
import path from 'path';

// 環境変数の読み込み
dotenv.config();

interface Config {
  nodeEnv: string;
  port: number;

  // データベース設定
  database: {
    url: string;
  };

  // Redis設定
  redis: {
    url: string;
    password?: string;
  };

  // JWT設定
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };

  // セッション設定
  session: {
    secret: string;
  };

  // OAuth設定
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
    };
    github: {
      clientId: string;
      clientSecret: string;
    };
  };

  // CORS設定
  cors: {
    origin: string | string[];
  };

  // レート制限
  rateLimit: {
    max: number;
  };

  // ファイル設定
  upload: {
    maxSize: number;
    allowedTypes: string[];
  };
}

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
];

// 必須環境変数のチェック
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL!,
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRE || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRE || '7d',
  },

  session: {
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET!,
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
  },

  cors: {
    origin: process.env.FRONTEND_URL ?
      process.env.FRONTEND_URL.split(',') :
      ['http://localhost:3000', 'http://localhost:3002'],
  },

  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10), // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'text/yaml', 'application/x-yaml'],
  },
};

// 設定情報の出力（開発環境のみ）
if (config.nodeEnv === 'development') {
  console.log('🔧 Configuration loaded:', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    database: { url: config.database.url.replace(/:[^:]*@/, ':***@') },
    redis: { url: config.redis.url.replace(/:[^:]*@/, ':***@') },
    cors: config.cors,
    rateLimit: config.rateLimit,
  });
}
