import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * 試験一覧取得
 * GET /api/exams
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const documentId = req.query.documentId as string;

    const skip = (page - 1) * limit;

    const whereCondition: any = {
      isActive: true,
    };

    if (type) {
      whereCondition.examType = type;
    }

    if (documentId) {
      whereCondition.documentId = documentId;
    }

    const [exams, totalCount] = await Promise.all([
      prisma.exam.findMany({
        where: whereCondition,
        skip,
        take: limit,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              filePath: true,
              difficultyLevel: true,
            },
          },
          questions: {
            select: {
              id: true,
              questionType: true,
              points: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.exam.count({ where: whereCondition }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        exams: exams.map(exam => ({
          id: exam.id,
          title: exam.title,
          description: exam.description,
          examType: exam.examType,
          timeLimit: exam.timeLimit,
          passingScore: exam.passingScore,
          maxAttempts: exam.maxAttempts,
          document: exam.document,
          questionCount: exam.questions.length,
          totalPoints: exam.questions.reduce((sum, q) => sum + q.points, 0),
          createdAt: exam.createdAt,
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
    console.error('試験一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 試験詳細取得
 * GET /api/exams/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
            difficultyLevel: true,
            category: true,
          },
        },
        questions: {
          select: {
            id: true,
            questionType: true,
            questionText: true,
            options: true,
            points: true,
            orderIndex: true,
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: '試験が見つかりません',
      });
    }

    // ユーザーの過去の受験履歴を取得
    const attempts = await prisma.examAttempt.findMany({
      where: {
        userId: userId,
        examId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    res.json({
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        examType: exam.examType,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        maxAttempts: exam.maxAttempts,
        document: exam.document,
        questions: exam.questions.map(q => ({
          id: q.id,
          questionType: q.questionType,
          questionText: q.questionText,
          options: q.options,
          points: q.points,
          orderIndex: q.orderIndex,
        })),
        attempts: attempts.map(a => ({
          id: a.id,
          score: a.score,
          totalPoints: a.totalPoints,
          timeTaken: a.timeTaken,
          completedAt: a.completedAt,
          createdAt: a.createdAt,
        })),
        userStats: {
          attemptCount: attempts.length,
          bestScore: attempts.length > 0 ? Math.max(...attempts.map(a => a.score?.toNumber() || 0)) : 0,
          canAttempt: attempts.length < exam.maxAttempts,
        },
      },
    });

  } catch (error) {
    console.error('試験詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 試験作成
 * POST /api/exams
 */
router.post('/', requireAuth, requireRole(['super_admin', 'team_manager']), [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('タイトルは1文字以上200文字以下で入力してください'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('説明は1000文字以下で入力してください'),
  body('examType')
    .isIn(['concept', 'yaml', 'practical'])
    .withMessage('無効な試験タイプです'),
  body('documentId')
    .isUUID()
    .withMessage('有効なドキュメントIDを指定してください'),
  body('timeLimit')
    .isInt({ min: 1, max: 480 })
    .withMessage('制限時間は1分以上480分以下で設定してください'),
  body('passingScore')
    .isFloat({ min: 0, max: 100 })
    .withMessage('合格点は0～100の範囲で設定してください'),
  body('maxAttempts')
    .isInt({ min: 1, max: 10 })
    .withMessage('最大受験回数は1～10回で設定してください'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { title, description, examType, documentId, timeLimit, passingScore, maxAttempts } = req.body;

    // ドキュメントの存在確認
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'ドキュメントが見つかりません',
      });
    }

    // 試験作成
    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        examType,
        documentId,
        timeLimit,
        passingScore,
        maxAttempts,
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        examType: exam.examType,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        maxAttempts: exam.maxAttempts,
        document: exam.document,
        createdAt: exam.createdAt,
      },
    });

  } catch (error) {
    console.error('試験作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 試験受験開始
 * POST /api/exams/:id/attempts
 */
router.post('/:id/attempts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id: examId } = req.params;
    const userId = req.session.userId;

    // 試験の存在確認
    const exam = await prisma.exam.findUnique({
      where: { id: examId, isActive: true },
      include: {
        questions: {
          select: {
            id: true,
            questionType: true,
            questionText: true,
            options: true,
            points: true,
            orderIndex: true,
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: '試験が見つかりません',
      });
    }

    // 受験回数の確認
    const attemptCount = await prisma.examAttempt.count({
      where: {
        userId: userId,
        examId: examId,
      },
    });

    if (attemptCount >= exam.maxAttempts) {
      return res.status(403).json({
        success: false,
        message: '受験回数の上限に達しています',
      });
    }

    // 受験記録作成
    const attempt = await prisma.examAttempt.create({
      data: {
        userId: userId!,
        examId: examId,
        answers: {},
        totalPoints: exam.questions.reduce((sum, q) => sum + q.points, 0),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt.id,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          examType: exam.examType,
          timeLimit: exam.timeLimit,
          questions: exam.questions.map(q => ({
            id: q.id,
            questionType: q.questionType,
            questionText: q.questionText,
            options: q.options,
            points: q.points,
            orderIndex: q.orderIndex,
          })),
        },
        startTime: attempt.createdAt,
        timeLimit: exam.timeLimit,
      },
    });

  } catch (error) {
    console.error('試験受験開始エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 試験回答提出
 * PUT /api/exams/:id/attempts/:attemptId/submit
 */
router.put('/:id/attempts/:attemptId/submit', requireAuth, [
  body('answers')
    .isObject()
    .withMessage('回答は有効な形式で入力してください'),
  body('kubectlLogs')
    .optional()
    .isString()
    .withMessage('kubectlログは文字列で入力してください'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { id: examId, attemptId } = req.params;
    const { answers, kubectlLogs } = req.body;
    const userId = req.session.userId;

    // 受験記録の確認
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!attempt || attempt.userId !== userId || attempt.examId !== examId) {
      return res.status(404).json({
        success: false,
        message: '受験記録が見つかりません',
      });
    }

    if (attempt.completedAt) {
      return res.status(400).json({
        success: false,
        message: '既に提出済みです',
      });
    }

    // 採点処理
    let totalScore = 0;
    const questionScores: { [key: string]: number } = {};

    for (const question of attempt.exam.questions) {
      const userAnswer = answers[question.id];
      let score = 0;

      if (question.questionType === 'MULTIPLE_CHOICE') {
        // 選択式問題の採点
        const correctAnswer = question.expectedAnswer;
        if (userAnswer === correctAnswer) {
          score = question.points;
        }
      } else if (question.questionType === 'YAML_GENERATION') {
        // YAML記述問題の採点（簡易版）
        if (userAnswer && typeof userAnswer === 'string') {
          // 基本的なYAMLキーワードの存在チェック
          const requiredKeywords = ['apiVersion', 'kind', 'metadata', 'spec'];
          const foundKeywords = requiredKeywords.filter(keyword =>
            userAnswer.includes(keyword),
          );
          score = (foundKeywords.length / requiredKeywords.length) * question.points;
        }
      } else if (question.questionType === 'KUBECTL_COMMAND') {
        // kubectl実技問題の採点
        if (kubectlLogs && kubectlLogs.includes('successfully')) {
          score = question.points;
        }
      }

      questionScores[question.id] = score;
      totalScore += score;
    }

    const scorePercentage = (totalScore / (attempt.totalPoints || 1)) * 100;

    // 受験記録更新
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        answers: answers,
        kubectlLogs: kubectlLogs,
        score: scorePercentage,
        timeTaken: Math.floor((Date.now() - attempt.createdAt.getTime()) / 1000),
        completedAt: new Date(),
      },
    });

    // 習熟度レベルの更新
    await updateProficiencyLevel(userId!, attempt.exam.documentId, attempt.exam.examType, scorePercentage);

    res.json({
      success: true,
      data: {
        score: scorePercentage,
        totalPoints: attempt.totalPoints,
        earned: totalScore,
        passed: scorePercentage >= (attempt.exam.passingScore?.toNumber() || 0),
        passingScore: attempt.exam.passingScore,
        timeTaken: updatedAttempt.timeTaken,
        questionScores: questionScores,
        completedAt: updatedAttempt.completedAt,
      },
    });

  } catch (error) {
    console.error('試験回答提出エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 習熟度レベル一覧取得
 * GET /api/proficiency
 */
router.get('/proficiency', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const documentId = req.query.documentId as string;

    const whereCondition: any = {
      userId: userId,
    };

    if (documentId) {
      whereCondition.documentId = documentId;
    }

    const proficiencyLevels = await prisma.proficiencyLevel.findMany({
      where: whereCondition,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
            category: true,
            difficultyLevel: true,
          },
        },
      },
      orderBy: {
        lastUpdated: 'desc',
      },
    });

    res.json({
      success: true,
      data: proficiencyLevels.map(pl => ({
        id: pl.id,
        document: pl.document,
        level: pl.level,
        conceptScore: pl.conceptScore,
        practicalScore: pl.practicalScore,
        yamlScore: pl.yamlScore,
        overallScore: calculateOverallScore(
          pl.conceptScore?.toNumber() || 0,
          pl.practicalScore?.toNumber() || 0,
          pl.yamlScore?.toNumber() || 0,
        ),
        lastUpdated: pl.lastUpdated,
      })),
    });

  } catch (error) {
    console.error('習熟度レベル取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 習熟度レベル更新（管理者のみ）
 * PUT /api/proficiency/:id
 */
router.put('/proficiency/:id', requireAuth, requireRole(['super_admin', 'team_manager']), [
  body('level')
    .isInt({ min: 0, max: 5 })
    .withMessage('習熟度レベルは0～5で設定してください'),
  body('conceptScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('概念スコアは0～100で設定してください'),
  body('practicalScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('実技スコアは0～100で設定してください'),
  body('yamlScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('YAMLスコアは0～100で設定してください'),
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
    const { level, conceptScore, practicalScore, yamlScore } = req.body;

    const updateData: any = {
      level,
      lastUpdated: new Date(),
    };

    if (conceptScore !== undefined) updateData.conceptScore = conceptScore;
    if (practicalScore !== undefined) updateData.practicalScore = practicalScore;
    if (yamlScore !== undefined) updateData.yamlScore = yamlScore;

    const updatedProficiency = await prisma.proficiencyLevel.update({
      where: { id },
      data: updateData,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            filePath: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: updatedProficiency.id,
        document: updatedProficiency.document,
        level: updatedProficiency.level,
        conceptScore: updatedProficiency.conceptScore,
        practicalScore: updatedProficiency.practicalScore,
        yamlScore: updatedProficiency.yamlScore,
        lastUpdated: updatedProficiency.lastUpdated,
      },
    });

  } catch (error) {
    console.error('習熟度レベル更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました',
    });
  }
});

/**
 * 習熟度レベル更新関数
 */
async function updateProficiencyLevel(
  userId: string,
  documentId: string,
  examType: string,
  score: number,
) {
  try {
    // 既存の習熟度レベルを取得
    const proficiency = await prisma.proficiencyLevel.findUnique({
      where: {
        userId_documentId: {
          userId: userId,
          documentId: documentId,
        },
      },
    });

    const updateData: any = {
      lastUpdated: new Date(),
    };

    if (examType === 'concept') {
      updateData.conceptScore = score;
    } else if (examType === 'practical') {
      updateData.practicalScore = score;
    } else if (examType === 'yaml') {
      updateData.yamlScore = score;
    }

    if (proficiency) {
      // 既存の習熟度レベルを更新
      const currentConcept = examType === 'concept' ? score : proficiency.conceptScore?.toNumber() || 0;
      const currentPractical = examType === 'practical' ? score : proficiency.practicalScore?.toNumber() || 0;
      const currentYaml = examType === 'yaml' ? score : proficiency.yamlScore?.toNumber() || 0;

      const overallScore = calculateOverallScore(currentConcept, currentPractical, currentYaml);
      updateData.level = calculateProficiencyLevel(overallScore);

      await prisma.proficiencyLevel.update({
        where: { id: proficiency.id },
        data: updateData,
      });
    } else {
      // 新しい習熟度レベルを作成
      const createData = {
        userId: userId,
        documentId: documentId,
        level: calculateProficiencyLevel(score),
        conceptScore: examType === 'concept' ? score : 0,
        practicalScore: examType === 'practical' ? score : 0,
        yamlScore: examType === 'yaml' ? score : 0,
        lastUpdated: new Date(),
      };

      await prisma.proficiencyLevel.create({
        data: createData,
      });
    }
  } catch (error) {
    console.error('習熟度レベル更新エラー:', error);
  }
}

/**
 * 総合スコア計算
 */
function calculateOverallScore(conceptScore: number, practicalScore: number, yamlScore: number): number {
  const scores = [conceptScore, practicalScore, yamlScore].filter(score => score > 0);
  return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
}

/**
 * 習熟度レベル計算
 */
function calculateProficiencyLevel(score: number): number {
  if (score >= 90) return 5;
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

export default router;
