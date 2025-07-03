import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { requireAuth, requireRole, requireTeamManagerOrAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * チーム一覧取得
 * GET /api/teams
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const userRole = req.session.role;
    const userId = req.session.userId;

    const skip = (page - 1) * limit;

    const whereCondition: any = {
      isActive: true
    };

    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 一般ユーザーは自分の所属チームのみ表示
    if (userRole === 'user') {
      whereCondition.memberships = {
        some: {
          userId: userId
        }
      };
    }

    const [teams, totalCount] = await Promise.all([
      prisma.team.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  role: true
                }
              }
            }
          },
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.team.count({ where: whereCondition })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        teams: teams.map(team => ({
          id: team.id,
          name: team.name,
          description: team.description,
          createdBy: team.creator,
          createdAt: team.createdAt,
          memberCount: team.memberships.length,
          members: team.memberships.map((tm: any) => ({
            id: tm.user.id,
            username: tm.user.username,
            displayName: tm.user.displayName,
            avatarUrl: tm.user.avatarUrl,
            role: tm.role,
            joinedAt: tm.joinedAt
          }))
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('チーム一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム詳細取得
 * GET /api/teams/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.session.role;
    const userId = req.session.userId;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                lastLoginAt: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'チームが見つかりません'
      });
    }

    // 一般ユーザーは自分の所属チームのみ閲覧可能
    if (userRole === 'user') {
      const isMember = team.memberships.some((tm: any) => tm.userId === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'このチームへのアクセス権限がありません'
        });
      }
    }

    // チーム統計情報を取得
    const stats = await prisma.readingProgress.groupBy({
      by: ['userId'],
      where: {
        user: {
          teamMemberships: {
            some: {
              teamId: id
            }
          }
        }
      },
      _avg: {
        progressPercentage: true
      },
      _sum: {
        totalReadingTime: true
      }
    });

    const averageProgress = stats.length > 0 
      ? stats.reduce((sum, s) => sum + (s._avg.progressPercentage?.toNumber() || 0), 0) / stats.length
      : 0;

    const totalReadingTime = stats.reduce((sum, s) => sum + (s._sum.totalReadingTime || 0), 0);

    res.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        createdBy: team.creator,
        createdAt: team.createdAt,
        members: team.memberships.map((tm: any) => ({
          id: tm.user.id,
          username: tm.user.username,
          displayName: tm.user.displayName,
          avatarUrl: tm.user.avatarUrl,
          role: tm.role,
          joinedAt: tm.joinedAt,
          lastLoginAt: tm.user.lastLoginAt
        })),
        stats: {
          memberCount: team.memberships.length,
          averageProgress: Math.round(averageProgress * 100) / 100,
          totalReadingTime: totalReadingTime
        }
      }
    });

  } catch (error) {
    console.error('チーム詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム作成
 * POST /api/teams
 */
router.post('/', requireAuth, requireTeamManagerOrAdmin, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('チーム名は1文字以上100文字以下で入力してください'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('説明は500文字以下で入力してください')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, description } = req.body;
    const createdBy = req.session.userId;

    // 同名チームの存在確認
    const existingTeam = await prisma.team.findFirst({
      where: {
        name: name,
        isActive: true
      }
    });

    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'このチーム名は既に使用されています'
      });
    }

    // チーム作成
    const team = await prisma.team.create({
      data: {
        name,
        description,
        createdBy: createdBy!
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        createdBy: team.creator,
        createdAt: team.createdAt,
        memberCount: 0,
        members: []
      }
    });

  } catch (error) {
    console.error('チーム作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム更新
 * PUT /api/teams/:id
 */
router.put('/:id', requireAuth, requireTeamManagerOrAdmin, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('チーム名は1文字以上100文字以下で入力してください'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('説明は500文字以下で入力してください')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const updateData: any = {};

    if (name !== undefined) {
      // 同名チームの存在確認（自分以外）
      const existingTeam = await prisma.team.findFirst({
        where: {
          name: name,
          isActive: true,
          NOT: { id: id }
        }
      });

      if (existingTeam) {
        return res.status(409).json({
          success: false,
          message: 'このチーム名は既に使用されています'
        });
      }

      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    updateData.updatedAt = new Date();

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        createdBy: team.creator,
        updatedAt: team.updatedAt
      }
    });

  } catch (error) {
    console.error('チーム更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム削除（論理削除）
 * DELETE /api/teams/:id
 */
router.delete('/:id', requireAuth, requireRole(['super_admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.team.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'チームを削除しました'
    });

  } catch (error) {
    console.error('チーム削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チームメンバー追加
 * POST /api/teams/:id/members
 */
router.post('/:id/members', requireAuth, requireTeamManagerOrAdmin, [
  body('userId')
    .isUUID()
    .withMessage('有効なユーザーIDを指定してください'),
  body('role')
    .optional()
    .isIn(['manager', 'member'])
    .withMessage('無効な権限です')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id: teamId } = req.params;
    const { userId, role = 'member' } = req.body;

    // チームの存在確認
    const team = await prisma.team.findUnique({
      where: { id: teamId, isActive: true }
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'チームが見つかりません'
      });
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    // 既にメンバーかどうか確認
    const existingMembership = await prisma.teamMembership.findFirst({
      where: {
        userId: userId,
        teamId: teamId
      }
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'ユーザーは既にチームのメンバーです'
      });
    }

    // メンバーシップ作成
    const membership = await prisma.teamMembership.create({
      data: {
        userId,
        teamId,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: membership.id,
        user: membership.user,
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    });

  } catch (error) {
    console.error('チームメンバー追加エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チームメンバー削除
 * DELETE /api/teams/:id/members/:userId
 */
router.delete('/:id/members/:userId', requireAuth, requireTeamManagerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { id: teamId, userId } = req.params;

    // メンバーシップの削除
    const deletedMembership = await prisma.teamMembership.deleteMany({
      where: {
        userId: userId,
        teamId: teamId
      }
    });

    if (deletedMembership.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'メンバーシップが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'チームメンバーを削除しました'
    });

  } catch (error) {
    console.error('チームメンバー削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チームメンバーの権限変更
 * PUT /api/teams/:id/members/:userId/role
 */
router.put('/:id/members/:userId/role', requireAuth, requireTeamManagerOrAdmin, [
  body('role')
    .isIn(['manager', 'member'])
    .withMessage('無効な権限です')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id: teamId, userId } = req.params;
    const { role } = req.body;

    // メンバーシップの更新
    const updatedMembership = await prisma.teamMembership.updateMany({
      where: {
        userId: userId,
        teamId: teamId
      },
      data: {
        role: role
      }
    });

    if (updatedMembership.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'メンバーシップが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'メンバーの権限を変更しました'
    });

  } catch (error) {
    console.error('チームメンバー権限変更エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 現在のユーザーの所属チーム一覧
 * GET /api/teams/my-teams
 */
router.get('/my-teams', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    const memberships = await prisma.teamMembership.findMany({
      where: {
        userId: userId
      },
      include: {
        team: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true
                  }
                }
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: memberships.map(membership => ({
        id: membership.team.id,
        name: membership.team.name,
        description: membership.team.description,
        role: membership.role,
        joinedAt: membership.joinedAt,
        memberCount: membership.team.memberships.length
      }))
    });

  } catch (error) {
    console.error('所属チーム一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
