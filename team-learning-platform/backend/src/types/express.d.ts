// Express Request型の拡張
// Redis、セッション、ユーザー情報の型定義

import { User } from '@prisma/client';
import { Redis } from 'ioredis';

declare global {
  namespace Express {
    interface Request {
      redis?: Redis;
      user?: User;
    }
  }
}

// express-sessionの型拡張
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: string;
    teamIds?: string[];
    passport?: {
      user?: string;
    };
  }
}
