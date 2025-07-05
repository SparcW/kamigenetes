import { Router, Request, Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
// import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  loginAttemptsCounter,
  sessionDurationHistogram,
  httpErrorsTotal,
  httpRequestDuration,
} from '../lib/metrics';

// 型定義は自動的に読み込まれるため、インポート文を削除

const router = Router();
// const prisma = new PrismaClient();

// 一時的なモックユーザーデータベース（Prisma接続前のテスト用）
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1RK8qOxBa2', // 'admin123'
    displayName: 'Administrator',
    avatarUrl: null,
    role: 'ADMIN',
    isActive: true,
    teamMemberships: [],
  },
];

// ログイン試行の制限
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5回まで
  message: 'ログイン試行回数が上限に達しました。15分後に再試行してください。',
});

interface TeamMembership {
  teamId: string;
  team: {
    id: string;
    name: string;
  };
  role: string;
}

/**
 * ローカルログイン
 * POST /api/auth/login
 */
router.post('/login',
  loginLimiter,
  [
    body('username').trim().isLength({ min: 1 }).withMessage('ユーザー名は必須です'),
    body('password').isLength({ min: 1 }).withMessage('パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        loginAttemptsCounter.labels('failure', 'local').inc();
        httpErrorsTotal.labels('POST', '/auth/login', '400', 'validation_error').inc();
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;

      // ユーザーを検索（一時的にモック使用）
      const user = mockUsers.find(u =>
        (u.username === username || u.email === username) && u.isActive,
      );

      if (!user || !user.passwordHash) {
        loginAttemptsCounter.labels('failure', 'local').inc();
        httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);
        return res.status(401).json({
          success: false,
          message: 'ユーザー名またはパスワードが正しくありません',
        });
      }

      // パスワード検証
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        loginAttemptsCounter.labels('failure', 'local').inc();
        httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);
        return res.status(401).json({
          success: false,
          message: 'ユーザー名またはパスワードが正しくありません',
        });
      }

      // ログイン時刻を更新（一時的にスキップ）
      // await prisma.user.update({
      //   where: { id: user.id },
      //   data: { lastLoginAt: new Date() }
      // });

      // セッションに保存
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;
      (req.session as any).role = user.role;
      (req.session as any).teamIds = user.teamMemberships.map((tm: TeamMembership) => tm.teamId || tm.team?.id || '');
      (req.session as any).loginTime = Date.now();

      // メトリクス記録
      loginAttemptsCounter.labels('success', 'local').inc();
      httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          teams: user.teamMemberships.map((tm: TeamMembership) => ({
            id: tm.team.id,
            name: tm.team.name,
            role: tm.role,
          })),
        },
      });

    } catch (error) {
      console.error('ログインエラー:', error);

      // エラーメトリクス記録
      loginAttemptsCounter.labels('failure', 'local').inc();
      httpErrorsTotal.labels('POST', '/auth/login', '500', 'server_error').inc();
      httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);

      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました',
      });
    }
  },
);

/**
 * ユーザー登録
 * POST /api/auth/register
 */
router.post('/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('ユーザー名は3文字以上50文字以下で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('ユーザー名は英数字とアンダースコア、ハイフンのみ使用可能です'),
    body('email')
      .isEmail()
      .withMessage('有効なメールアドレスを入力してください')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('パスワードは6文字以上で入力してください'),
    body('displayName')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('表示名は1文字以上100文字以下で入力してください'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { username, email, password, displayName } = req.body;

      // 既存ユーザーの確認（一時的にモック使用）
      const existingUser = mockUsers.find(u =>
        u.username === username || u.email === email,
      );

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: existingUser.username === username
            ? 'このユーザー名は既に使用されています'
            : 'このメールアドレスは既に登録されています',
        });
      }

      // パスワードハッシュ化
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // ユーザー作成（一時的にモック配列に追加）
      const newUser = {
        id: String(mockUsers.length + 1),
        username,
        email,
        passwordHash,
        displayName,
        avatarUrl: null,
        role: 'USER',
        isActive: true,
        teamMemberships: [],
      };
      mockUsers.push(newUser);

      // セッションに保存
      (req.session as any).userId = newUser.id;
      (req.session as any).username = newUser.username;
      (req.session as any).role = newUser.role;
      (req.session as any).teamIds = [];

      res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
          email: newUser.email,
          role: newUser.role,
          avatarUrl: newUser.avatarUrl,
          teams: [],
        },
      });

    } catch (error) {
      console.error('登録エラー:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーエラーが発生しました',
      });
    }
  },
);

/**
 * ログアウト
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  const startTime = Date.now();
  const loginTime = (req.session as any)?.loginTime;
  const userRole = (req.session as any)?.role || 'user';

  // セッション継続時間を記録
  if (loginTime) {
    const sessionDuration = (Date.now() - loginTime) / 1000;
    sessionDurationHistogram.labels(userRole).observe(sessionDuration);
  }

  req.session.destroy((err: any) => {
    if (err) {
      console.error('セッション削除エラー:', err);

      // エラーメトリクス記録
      httpErrorsTotal.labels('POST', '/auth/login', '500', 'server_error').inc();
      httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);

      return res.status(500).json({
        success: false,
        message: 'ログアウトに失敗しました',
      });
    }

    // 成功メトリクス記録
    httpRequestDuration.labels('POST', '/auth/login', '200').observe((Date.now() - startTime) / 1000);

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'ログアウトしました',
    });
  });
});

/**
 * 現在のユーザー情報取得
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!(req.session as any).userId) {
      return res.status(401).json({
        success: false,
        message: '認証が必要です',
      });
    }

    const user = mockUsers.find(u => u.id === (req.session as any).userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        teams: user.teamMemberships.map((tm: TeamMembership) => ({
          id: tm.team.id,
          name: tm.team.name,
          role: tm.role,
        })),
      },
    });

  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * OAuth認証開始 (Google)
 * GET /api/auth/oauth/google
 */
router.get('/oauth/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

/**
 * OAuth認証コールバック (Google)
 * GET /api/auth/oauth/google/callback
 */
router.get('/oauth/google/callback',
  passport.authenticate('google', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // セッションに保存
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;
      (req.session as any).role = user.role;
      (req.session as any).teamIds = user.teamIds || [];

      // フロントエンドにリダイレクト
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);

    } catch (error) {
      console.error('OAuth認証エラー:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  },
);

/**
 * OAuth認証開始 (GitHub)
 * GET /api/auth/oauth/github
 */
router.get('/oauth/github', passport.authenticate('github', {
  scope: ['user:email'],
}));

/**
 * OAuth認証コールバック (GitHub)
 * GET /api/auth/oauth/github/callback
 */
router.get('/oauth/github/callback',
  passport.authenticate('github', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      // セッションに保存
      (req.session as any).userId = user.id;
      (req.session as any).username = user.username;
      (req.session as any).role = user.role;
      (req.session as any).teamIds = user.teamIds || [];

      // フロントエンドにリダイレクト
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);

    } catch (error) {
      console.error('OAuth認証エラー:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  },
);

export default router;
