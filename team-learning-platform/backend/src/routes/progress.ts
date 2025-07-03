import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * 読書進捗一覧取得
 * GET /api/progress
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string || '';
    const completed = req.query.completed as string;

    const skip = (page - 1) * limit;

    const whereCondition: any = {
      userId: userId
    };

    if (category) {
      whereCondition.document = {
        category: category
      };
    }

    if (completed === 'true') {
      whereCondition.progressPercentage = 100;
    } else if (completed === 'false') {
      whereCondition.progressPercentage = { lt: 100 };
    }

    const [progress, totalCount] = await Promise.all([
      prisma.readingProgress.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              filePath: true,
              category: true,
              estimatedReadingTime: true,
              difficultyLevel: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      }),
      prisma.readingProgress.count({ where: whereCondition })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        progress: progress.map(p => ({
          id: p.id,
          document: p.document,
          progressPercentage: p.progressPercentage.toNumber(),
          totalReadingTime: p.totalReadingTime,
          lastPosition: p.lastPosition,
          completedAt: p.completedAt,
          updatedAt: p.updatedAt
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
    console.error('読書進捗一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 特定ドキュメントの読書進捗取得
 * GET /api/progress/:documentId
 */
router.get('/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = req.session.userId;

    const progress = await prisma.readingProgress.findUnique({
      where: {
        userId_documentId: {
          userId: userId!,
          documentId: documentId
        }
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
            category: true,
            estimatedReadingTime: true,
            difficultyLevel: true
          }
        }
      }
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: '読書進捗が見つかりません'
      });
    }

    res.json({
      success: true,
      data: {
        id: progress.id,
        document: progress.document,
        progressPercentage: progress.progressPercentage.toNumber(),
        totalReadingTime: progress.totalReadingTime,
        lastPosition: progress.lastPosition,
        completedAt: progress.completedAt,
        updatedAt: progress.updatedAt
      }
    });

  } catch (error) {
    console.error('読書進捗取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 読書進捗作成・更新
 * POST /api/progress
 */
router.post('/', requireAuth, [
  body('documentId')
    .isUUID()
    .withMessage('有効なドキュメントIDを指定してください'),
  body('progressPercentage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('進捗率は0から100の間で指定してください'),
  body('totalReadingTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('読書時間は0以上の整数で指定してください'),
  body('lastPosition')
    .optional()
    .isInt({ min: 0 })
    .withMessage('最後の位置は0以上の整数で指定してください')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { documentId, progressPercentage, totalReadingTime = 0, lastPosition = 0 } = req.body;
    const userId = req.session.userId;

    // ドキュメントの存在確認
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'ドキュメントが見つかりません'
      });
    }

    // 既存の進捗を確認
    const existingProgress = await prisma.readingProgress.findUnique({
      where: {
        userId_documentId: {
          userId: userId!,
          documentId: documentId
        }
      }
    });

    let progress;
    const now = new Date();
    const completedAt = progressPercentage >= 100 ? now : null;

    if (existingProgress) {
      // 更新
      progress = await prisma.readingProgress.update({
        where: {
          userId_documentId: {
            userId: userId!,
            documentId: documentId
          }
        },
        data: {
          progressPercentage,
          totalReadingTime: existingProgress.totalReadingTime + totalReadingTime,
          lastPosition,
          completedAt,
          updatedAt: now
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              filePath: true,
              category: true
            }
          }
        }
      });
    } else {
      // 作成
      progress = await prisma.readingProgress.create({
        data: {
          userId: userId!,
          documentId,
          progressPercentage,
          totalReadingTime,
          lastPosition,
          completedAt
        },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              filePath: true,
              category: true
            }
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: progress.id,
        document: progress.document,
        progressPercentage: progress.progressPercentage.toNumber(),
        totalReadingTime: progress.totalReadingTime,
        lastPosition: progress.lastPosition,
        completedAt: progress.completedAt,
        updatedAt: progress.updatedAt
      }
    });

  } catch (error) {
    console.error('読書進捗作成・更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 読書進捗削除
 * DELETE /api/progress/:documentId
 */
router.delete('/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = req.session.userId;

    const deletedProgress = await prisma.readingProgress.deleteMany({
      where: {
        userId: userId!,
        documentId: documentId
      }
    });

    if (deletedProgress.count === 0) {
      return res.status(404).json({
        success: false,
        message: '読書進捗が見つかりません'
      });
    }

    res.json({
      success: true,
      message: '読書進捗を削除しました'
    });

  } catch (error) {
    console.error('読書進捗削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * お気に入り一覧取得
 * GET /api/favorites
 */
router.get('/favorites', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    const favorites = await prisma.favorite.findMany({
      where: {
        userId: userId!
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
            category: true,
            estimatedReadingTime: true,
            difficultyLevel: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: favorites.map(fav => ({
        id: fav.id,
        document: fav.document,
        notes: fav.notes,
        createdAt: fav.createdAt
      }))
    });

  } catch (error) {
    console.error('お気に入り一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * お気に入り追加
 * POST /api/favorites
 */
router.post('/favorites', requireAuth, [
  body('documentId')
    .isUUID()
    .withMessage('有効なドキュメントIDを指定してください'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('ノートは500文字以下で入力してください')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { documentId, notes } = req.body;
    const userId = req.session.userId;

    // ドキュメントの存在確認
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'ドキュメントが見つかりません'
      });
    }

    // 既にお気に入りに追加済みかチェック
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_documentId: {
          userId: userId!,
          documentId: documentId
        }
      }
    });

    if (existingFavorite) {
      return res.status(409).json({
        success: false,
        message: '既にお気に入りに追加されています'
      });
    }

    // お気に入り作成
    const favorite = await prisma.favorite.create({
      data: {
        userId: userId!,
        documentId,
        notes
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
            category: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: favorite.id,
        document: favorite.document,
        notes: favorite.notes,
        createdAt: favorite.createdAt
      }
    });

  } catch (error) {
    console.error('お気に入り追加エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * お気に入り削除
 * DELETE /api/favorites/:documentId
 */
router.delete('/favorites/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const userId = req.session.userId;

    const deletedFavorite = await prisma.favorite.deleteMany({
      where: {
        userId: userId!,
        documentId: documentId
      }
    });

    if (deletedFavorite.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'お気に入りが見つかりません'
      });
    }

    res.json({
      success: true,
      message: 'お気に入りを削除しました'
    });

  } catch (error) {
    console.error('お気に入り削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 学習統計取得
 * GET /api/progress/stats
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    const [
      totalProgress,
      completedCount,
      totalReadingTime,
      favoriteCount,
      avgProficiency
    ] = await Promise.all([
      prisma.readingProgress.count({
        where: { userId: userId! }
      }),
      prisma.readingProgress.count({
        where: { 
          userId: userId!,
          progressPercentage: 100
        }
      }),
      prisma.readingProgress.aggregate({
        where: { userId: userId! },
        _sum: { totalReadingTime: true }
      }),
      prisma.favorite.count({
        where: { userId: userId! }
      }),
      prisma.proficiencyLevel.aggregate({
        where: { userId: userId! },
        _avg: { level: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalDocuments: totalProgress,
        completedDocuments: completedCount,
        totalReadingTime: totalReadingTime._sum.totalReadingTime || 0,
        favoriteCount,
        averageProficiency: avgProficiency._avg.level || 0,
        completionRate: totalProgress > 0 ? (completedCount / totalProgress) * 100 : 0
      }
    });

  } catch (error) {
    console.error('学習統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
