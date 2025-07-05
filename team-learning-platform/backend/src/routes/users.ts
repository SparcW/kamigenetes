import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  userListRequestsCounter,
  userCreationCounter,
  userUpdateCounter,
  userDeletionCounter,
  passwordChangeCounter,
  userProfileRequestsCounter,
  usersErrorsCounter,
  usersResponseTimeHistogram,
} from '../lib/metrics';

const router = Router();
const prisma = new PrismaClient();

/**
 * ユーザー一覧取得
 * GET /api/users
 */
router.get('/', requireAuth, requireRole(['super_admin', 'team_manager']), async (req: Request, res: Response) => {
  const endTimer = usersResponseTimeHistogram.startTimer({ endpoint: 'users_list', method: 'GET' });

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const role = req.query.role as string || '';

    // メトリクス記録
    userListRequestsCounter.inc({
      search_type: search ? 'with_search' : 'without_search',
      role_filter: role || 'all',
      user_id: (req as any).session?.userId || 'anonymous',
    });

    const skip = (page - 1) * limit;

    const whereCondition: any = {
      isActive: true,
    };

    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      whereCondition.role = role;
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatarUrl: user.avatarUrl,
          oauthProvider: user.oauthProvider,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          teams: user.teamMemberships.map(tm => ({
            id: tm.team.id,
            name: tm.team.name,
            role: tm.role,
          })),
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });

  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * ユーザー詳細取得
 * GET /api/users/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    // 自分の情報または管理者のみ詳細情報を取得可能
    if (id !== currentUserId && !['super_admin', 'team_manager'].includes(currentUserRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'アクセス権限がありません',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teamMemberships: {
          include: {
            team: true,
          },
        },
        readingProgress: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                filePath: true,
              },
            },
          },
        },
        proficiencyLevels: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                filePath: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        oauthProvider: user.oauthProvider,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        teams: user.teamMemberships.map(tm => ({
          id: tm.team.id,
          name: tm.team.name,
          description: tm.team.description,
          role: tm.role,
          joinedAt: tm.joinedAt,
        })),
        stats: {
          totalDocuments: user.readingProgress.length,
          completedDocuments: user.readingProgress.filter(p => p.progressPercentage.toNumber() === 100).length,
          averageProficiency: user.proficiencyLevels.length > 0
            ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
            : 0,
          totalReadingTime: user.readingProgress.reduce((sum, p) => sum + p.totalReadingTime, 0),
        },
      },
    });

  } catch (error) {
    console.error('ユーザー詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * ユーザー作成
 * POST /api/users
 */
router.post('/', requireAuth, requireRole(['super_admin']), [
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
    .isLength({ min: 8 })
    .withMessage('パスワードは8文字以上で入力してください')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('パスワードは大文字、小文字、数字を含む必要があります'),
  body('displayName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('表示名は1文字以上100文字以下で入力してください'),
  body('role')
    .isIn(['super_admin', 'team_manager', 'user'])
    .withMessage('無効な権限です'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { username, email, password, displayName, role } = req.body;

    // 既存ユーザーの確認
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email },
        ],
      },
    });

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

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        displayName,
        role,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * ユーザー更新
 * PUT /api/users/:id
 */
router.put('/:id', requireAuth, [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('表示名は1文字以上100文字以下で入力してください'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['super_admin', 'team_manager', 'user'])
    .withMessage('無効な権限です'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    // 自分の情報または管理者のみ更新可能
    if (id !== currentUserId && !['super_admin', 'team_manager'].includes(currentUserRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'アクセス権限がありません',
      });
    }

    const { displayName, email, role } = req.body;
    const updateData: any = {};

    if (displayName !== undefined) updateData.displayName = displayName;
    if (email !== undefined) updateData.email = email;

    // 権限変更はスーパー管理者のみ可能
    if (role !== undefined) {
      if (currentUserRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: '権限変更はスーパー管理者のみ可能です',
        });
      }
      updateData.role = role;
    }

    updateData.updatedAt = new Date();

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        updatedAt: user.updatedAt,
      },
    });

  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * ユーザー削除（論理削除）
 * DELETE /api/users/:id
 */
router.delete('/:id', requireAuth, requireRole(['super_admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserId = req.session.userId;

    // 自分自身は削除できない
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: '自分自身は削除できません',
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'ユーザーを削除しました',
    });

  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * パスワード変更
 * PUT /api/users/:id/password
 */
router.put('/:id/password', requireAuth, [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('現在のパスワードは必須です'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('新しいパスワードは8文字以上で入力してください')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('新しいパスワードは大文字、小文字、数字を含む必要があります'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const currentUserId = req.session.userId;

    // 自分のパスワードのみ変更可能
    if (id !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: '他のユーザーのパスワードは変更できません',
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || !user.passwordHash) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません',
      });
    }

    // 現在のパスワード検証
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '現在のパスワードが正しくありません',
      });
    }

    // 新しいパスワードハッシュ化
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'パスワードを変更しました',
    });

  } catch (error) {
    console.error('パスワード変更エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

export default router;
