import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    role?: string;
    teamIds?: string[];
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
  }
}
