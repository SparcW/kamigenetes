import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth';
import { 
  leaderboardRequestsCounter, 
  statisticsRequestsCounter, 
  teamPerformanceAnalysisCounter, 
  individualPerformanceAnalysisCounter,
  analyticsErrorsCounter,
  analyticsResponseTimeHistogram
} from '../lib/metrics';

const router = Router();
const prisma = new PrismaClient();

/**
 * 全体リーダーボード取得
 * GET /api/analytics/leaderboard/global
 */
router.get('/leaderboard/global', requireAuth, async (req: Request, res: Response) => {
  const endTimer = analyticsResponseTimeHistogram.startTimer({ endpoint: 'leaderboard_global', method: 'GET' });
  
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const category = req.query.category as string || 'overall';
    
    // メトリクス記録
    leaderboardRequestsCounter.inc({ 
      category, 
      user_id: (req as any).user?.id || 'anonymous' 
    });

    // 習熟度別ランキング
    if (category === 'proficiency') {
      const proficiencyRanking = await prisma.user.findMany({
        where: { isActive: true },
        include: {
          proficiencyLevels: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  category: true
                }
              }
            }
          },
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        take: limit
      });

      const ranking = proficiencyRanking
        .map(user => {
          const avgProficiency = user.proficiencyLevels.length > 0 
            ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
            : 0;

          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            teams: user.teamMemberships.map(tm => tm.team.name),
            score: Math.round(avgProficiency * 100) / 100,
            details: {
              documentsCount: user.proficiencyLevels.length,
              maxLevel: user.proficiencyLevels.length > 0 
                ? Math.max(...user.proficiencyLevels.map(p => p.level))
                : 0
            }
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return res.json({
        success: true,
        data: {
          category: 'proficiency',
          ranking: ranking.map((user, index) => ({
            rank: index + 1,
            ...user
          }))
        }
      });
    }

    // 進捗別ランキング
    if (category === 'progress') {
      const progressRanking = await prisma.user.findMany({
        where: { isActive: true },
        include: {
          readingProgress: {
            include: {
              document: {
                select: {
                  id: true,
                  title: true,
                  category: true
                }
              }
            }
          },
          teamMemberships: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        take: limit
      });

      const ranking = progressRanking
        .map(user => {
          const completedDocs = user.readingProgress.filter(
            p => p.progressPercentage.toNumber() === 100
          ).length;
          const totalDocs = user.readingProgress.length;
          const avgProgress = totalDocs > 0 
            ? user.readingProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / totalDocs
            : 0;

          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            teams: user.teamMemberships.map(tm => tm.team.name),
            score: Math.round(avgProgress * 100) / 100,
            details: {
              completedDocs,
              totalDocs,
              totalReadingTime: user.readingProgress.reduce((sum, p) => sum + p.totalReadingTime, 0)
            }
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return res.json({
        success: true,
        data: {
          category: 'progress',
          ranking: ranking.map((user, index) => ({
            rank: index + 1,
            ...user
          }))
        }
      });
    }

    // 総合ランキング（デフォルト）
    const overallRanking = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        readingProgress: true,
        proficiencyLevels: true,
        examAttempts: true,
        teamMemberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      take: limit
    });

    const ranking = overallRanking
      .map(user => {
        const avgProgress = user.readingProgress.length > 0 
          ? user.readingProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / user.readingProgress.length
          : 0;

        const avgProficiency = user.proficiencyLevels.length > 0 
          ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
          : 0;

        const avgExamScore = user.examAttempts.length > 0 
          ? user.examAttempts.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) / user.examAttempts.length
          : 0;

        // 総合スコア計算 (進捗40% + 習熟度40% + 試験20%)
        const overallScore = (avgProgress * 0.4) + (avgProficiency * 20 * 0.4) + (avgExamScore * 0.2);

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          teams: user.teamMemberships.map(tm => tm.team.name),
          score: Math.round(overallScore * 100) / 100,
          details: {
            avgProgress: Math.round(avgProgress * 100) / 100,
            avgProficiency: Math.round(avgProficiency * 100) / 100,
            avgExamScore: Math.round(avgExamScore * 100) / 100,
            totalExams: user.examAttempts.length
          }
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    res.json({
      success: true,
      data: {
        category: 'overall',
        ranking: ranking.map((user, index) => ({
          rank: index + 1,
          ...user
        }))
      }
    });
    
    endTimer();

  } catch (error) {
    console.error('全体リーダーボード取得エラー:', error);
    endTimer();
    
    // エラーメトリクス記録
    analyticsErrorsCounter.inc({ 
      error_type: 'leaderboard_global_error', 
      endpoint: 'leaderboard_global' 
    });
    
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム別リーダーボード取得
 * GET /api/analytics/leaderboard/team/:teamId
 */
router.get('/leaderboard/team/:teamId', requireAuth, async (req: Request, res: Response) => {
  const endTimer = analyticsResponseTimeHistogram.startTimer({ endpoint: 'leaderboard_team', method: 'GET' });
  
  try {
    const { teamId } = req.params;
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;
    
    // メトリクス記録
    teamPerformanceAnalysisCounter.inc({ 
      team_id: teamId, 
      analysis_type: 'leaderboard' 
    });

    // チームへのアクセス権限確認
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          include: {
            user: {
              include: {
                readingProgress: true,
                proficiencyLevels: true,
                examAttempts: true
              }
            }
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
    if (currentUserRole === 'user') {
      const isMember = team.memberships.some(m => m.userId === currentUserId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'このチームへのアクセス権限がありません'
        });
      }
    }

    const ranking = team.memberships
      .map(membership => {
        const user = membership.user;
        
        const avgProgress = user.readingProgress.length > 0 
          ? user.readingProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / user.readingProgress.length
          : 0;

        const avgProficiency = user.proficiencyLevels.length > 0 
          ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
          : 0;

        const avgExamScore = user.examAttempts.length > 0 
          ? user.examAttempts.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) / user.examAttempts.length
          : 0;

        const overallScore = (avgProgress * 0.4) + (avgProficiency * 20 * 0.4) + (avgExamScore * 0.2);

        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          teamRole: membership.role,
          joinedAt: membership.joinedAt,
          score: Math.round(overallScore * 100) / 100,
          details: {
            avgProgress: Math.round(avgProgress * 100) / 100,
            avgProficiency: Math.round(avgProficiency * 100) / 100,
            avgExamScore: Math.round(avgExamScore * 100) / 100,
            completedDocs: user.readingProgress.filter(p => p.progressPercentage.toNumber() === 100).length,
            totalDocs: user.readingProgress.length,
            totalReadingTime: user.readingProgress.reduce((sum, p) => sum + p.totalReadingTime, 0)
          }
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description
        },
        ranking: ranking.map((user, index) => ({
          rank: index + 1,
          ...user
        }))
      }
    });

  } catch (error) {
    console.error('チーム別リーダーボード取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * ユーザー統計情報取得
 * GET /api/analytics/user/:userId
 */
router.get('/user/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    // 自分の情報または管理者のみ詳細統計を取得可能
    if (userId !== currentUserId && !['super_admin', 'team_manager'].includes(currentUserRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'アクセス権限がありません'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        readingProgress: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                category: true,
                difficultyLevel: true
              }
            }
          }
        },
        proficiencyLevels: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                category: true
              }
            }
          }
        },
        examAttempts: {
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                examType: true,
                document: {
                  select: {
                    id: true,
                    title: true,
                    category: true
                  }
                }
              }
            }
          }
        },
        favorites: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                category: true
              }
            }
          }
        },
        teamMemberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません'
      });
    }

    // 統計計算
    const totalReadingTime = user.readingProgress.reduce((sum, p) => sum + p.totalReadingTime, 0);
    const completedDocs = user.readingProgress.filter(p => p.progressPercentage.toNumber() === 100).length;
    const avgProgress = user.readingProgress.length > 0 
      ? user.readingProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / user.readingProgress.length
      : 0;

    const avgProficiency = user.proficiencyLevels.length > 0 
      ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
      : 0;

    const avgExamScore = user.examAttempts.length > 0 
      ? user.examAttempts.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) / user.examAttempts.length
      : 0;

    // カテゴリ別統計
    const categoryStats = user.readingProgress.reduce((stats: any, progress) => {
      const category = progress.document.category || 'その他';
      if (!stats[category]) {
        stats[category] = {
          totalDocs: 0,
          completedDocs: 0,
          avgProgress: 0,
          totalReadingTime: 0
        };
      }
      
      stats[category].totalDocs += 1;
      stats[category].totalReadingTime += progress.totalReadingTime;
      stats[category].avgProgress += progress.progressPercentage.toNumber();
      
      if (progress.progressPercentage.toNumber() === 100) {
        stats[category].completedDocs += 1;
      }
      
      return stats;
    }, {});

    // 各カテゴリの平均進捗を計算
    Object.keys(categoryStats).forEach(category => {
      categoryStats[category].avgProgress = categoryStats[category].avgProgress / categoryStats[category].totalDocs;
    });

    // 最近の活動履歴
    const recentActivity = await prisma.readingProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            category: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          teams: user.teamMemberships.map(tm => tm.team)
        },
        stats: {
          overview: {
            totalReadingTime: Math.round(totalReadingTime / 60), // 分単位
            totalDocs: user.readingProgress.length,
            completedDocs,
            avgProgress: Math.round(avgProgress * 100) / 100,
            avgProficiency: Math.round(avgProficiency * 100) / 100,
            avgExamScore: Math.round(avgExamScore * 100) / 100,
            favoritesCount: user.favorites.length,
            examAttempts: user.examAttempts.length
          },
          categoryStats,
          proficiencyBreakdown: {
            level0: user.proficiencyLevels.filter(p => p.level === 0).length,
            level1: user.proficiencyLevels.filter(p => p.level === 1).length,
            level2: user.proficiencyLevels.filter(p => p.level === 2).length,
            level3: user.proficiencyLevels.filter(p => p.level === 3).length,
            level4: user.proficiencyLevels.filter(p => p.level === 4).length,
            level5: user.proficiencyLevels.filter(p => p.level === 5).length,
          },
          examStats: {
            concept: user.examAttempts.filter(a => a.exam.examType === 'CONCEPT').length,
            yaml: user.examAttempts.filter(a => a.exam.examType === 'YAML').length,
            practical: user.examAttempts.filter(a => a.exam.examType === 'PRACTICAL').length,
          }
        },
        recentActivity: recentActivity.map(activity => ({
          document: activity.document,
          progress: activity.progressPercentage.toNumber(),
          readingTime: activity.totalReadingTime,
          lastUpdated: activity.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('ユーザー統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * チーム統計情報取得
 * GET /api/analytics/team/:teamId
 */
router.get('/team/:teamId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    // チームへのアクセス権限確認
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          include: {
            user: {
              include: {
                readingProgress: true,
                proficiencyLevels: true,
                examAttempts: true
              }
            }
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
    if (currentUserRole === 'user') {
      const isMember = team.memberships.some(m => m.userId === currentUserId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'このチームへのアクセス権限がありません'
        });
      }
    }

    // チーム全体の統計計算
    const allProgress = team.memberships.flatMap(m => m.user.readingProgress);
    const allProficiency = team.memberships.flatMap(m => m.user.proficiencyLevels);
    const allExamAttempts = team.memberships.flatMap(m => m.user.examAttempts);

    const totalReadingTime = allProgress.reduce((sum, p) => sum + p.totalReadingTime, 0);
    const completedDocs = allProgress.filter(p => p.progressPercentage.toNumber() === 100).length;
    const avgTeamProgress = allProgress.length > 0 
      ? allProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / allProgress.length
      : 0;

    const avgTeamProficiency = allProficiency.length > 0 
      ? allProficiency.reduce((sum, p) => sum + p.level, 0) / allProficiency.length
      : 0;

    const avgTeamExamScore = allExamAttempts.length > 0 
      ? allExamAttempts.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) / allExamAttempts.length
      : 0;

    // メンバー別統計
    const memberStats = team.memberships.map(membership => {
      const user = membership.user;
      
      const userAvgProgress = user.readingProgress.length > 0 
        ? user.readingProgress.reduce((sum, p) => sum + p.progressPercentage.toNumber(), 0) / user.readingProgress.length
        : 0;

      const userAvgProficiency = user.proficiencyLevels.length > 0 
        ? user.proficiencyLevels.reduce((sum, p) => sum + p.level, 0) / user.proficiencyLevels.length
        : 0;

      const userAvgExamScore = user.examAttempts.length > 0 
        ? user.examAttempts.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) / user.examAttempts.length
        : 0;

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        teamRole: membership.role,
        stats: {
          avgProgress: Math.round(userAvgProgress * 100) / 100,
          avgProficiency: Math.round(userAvgProficiency * 100) / 100,
          avgExamScore: Math.round(userAvgExamScore * 100) / 100,
          completedDocs: user.readingProgress.filter(p => p.progressPercentage.toNumber() === 100).length,
          totalDocs: user.readingProgress.length,
          totalReadingTime: user.readingProgress.reduce((sum, p) => sum + p.totalReadingTime, 0)
        }
      };
    });

    res.json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          memberCount: team.memberships.length
        },
        stats: {
          overview: {
            totalReadingTime: Math.round(totalReadingTime / 60), // 分単位
            totalDocs: allProgress.length,
            completedDocs,
            avgProgress: Math.round(avgTeamProgress * 100) / 100,
            avgProficiency: Math.round(avgTeamProficiency * 100) / 100,
            avgExamScore: Math.round(avgTeamExamScore * 100) / 100,
            totalExamAttempts: allExamAttempts.length
          },
          memberStats: memberStats.sort((a, b) => b.stats.avgProgress - a.stats.avgProgress)
        }
      }
    });

  } catch (error) {
    console.error('チーム統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

/**
 * 管理者用ダッシュボード統計
 * GET /api/analytics/admin/dashboard
 */
router.get('/admin/dashboard', requireAuth, requireRole(['super_admin', 'team_manager']), async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalTeams,
      totalDocuments,
      totalExams,
      recentActivity
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ 
        where: { 
          isActive: true,
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 過去7日
          }
        }
      }),
      prisma.team.count({ where: { isActive: true } }),
      prisma.document.count(),
      prisma.exam.count({ where: { isActive: true } }),
      prisma.readingProgress.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          },
          document: {
            select: {
              id: true,
              title: true,
              category: true
            }
          }
        }
      })
    ]);

    // 今週の統計
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [newUsersThisWeek, newProgressThisWeek, newExamAttemptsThisWeek] = await Promise.all([
      prisma.user.count({ 
        where: { 
          createdAt: { gte: weekAgo },
          isActive: true
        }
      }),
      prisma.readingProgress.count({
        where: {
          createdAt: { gte: weekAgo }
        }
      }),
      prisma.examAttempt.count({
        where: {
          createdAt: { gte: weekAgo }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          totalTeams,
          totalDocuments,
          totalExams,
          activityRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
        },
        weeklyStats: {
          newUsers: newUsersThisWeek,
          newProgress: newProgressThisWeek,
          newExamAttempts: newExamAttemptsThisWeek
        },
        recentActivity: recentActivity.map(activity => ({
          user: activity.user,
          document: activity.document,
          progress: activity.progressPercentage.toNumber(),
          updatedAt: activity.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('管理者ダッシュボード統計取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
});

export default router;
