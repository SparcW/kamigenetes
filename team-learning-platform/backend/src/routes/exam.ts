import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  Exam, 
  ExamAttempt, 
  ExamSession, 
  ExamListResponse, 
  ExamDetailResponse, 
  ExamStartResponse, 
  ExamSubmitResponse 
} from '../types/exam';
import { sampleExams } from '../data/sampleExams';
import {
  examStartCounter,
  examCompletionCounter,
  examScoreHistogram,
  examDurationHistogram,
  httpErrorsTotal,
  httpRequestDuration
} from '../lib/metrics';

const router = express.Router();

// メモリ内のデータストア（開発用）
let examSessions: ExamSession[] = [];
let examAttempts: ExamAttempt[] = [];

// 認証チェックミドルウェア
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!(req.session as any)?.userId) {
    return res.status(401).json({ success: false, message: 'ログインが必要です' });
  }
  next();
};

// GET /api/exams - 試験一覧取得
router.get('/', requireAuth, (req: express.Request, res: express.Response) => {
  try {
    const { category, difficulty, tags } = req.query;
    
    let filteredExams = sampleExams.filter((exam: Exam) => exam.isActive);
    
    // カテゴリーフィルタ
    if (category) {
      filteredExams = filteredExams.filter((exam: Exam) => exam.category === category);
    }
    
    // 難易度フィルタ
    if (difficulty) {
      const difficultyNum = parseInt(difficulty as string);
      filteredExams = filteredExams.filter((exam: Exam) => exam.difficulty === difficultyNum);
    }
    
    // タグフィルタ
    if (tags) {
      const tagArray = (tags as string).split(',');
      filteredExams = filteredExams.filter((exam: Exam) => 
        tagArray.some(tag => exam.tags.includes(tag))
      );
    }
    
    const response: ExamListResponse = {
      success: true,
      exams: filteredExams,
      total: filteredExams.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('試験一覧取得エラー:', error);
    res.status(500).json({ success: false, message: '内部サーバーエラー' });
  }
});

// GET /api/exams/:id - 試験詳細取得
router.get('/:id', requireAuth, (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const exam = sampleExams.find((e: Exam) => e.id === id && e.isActive);
    
    if (!exam) {
      return res.status(404).json({ success: false, message: '試験が見つかりません' });
    }
    
    const response: ExamDetailResponse = {
      success: true,
      exam
    };
    
    res.json(response);
  } catch (error) {
    console.error('試験詳細取得エラー:', error);
    res.status(500).json({ success: false, message: '内部サーバーエラー' });
  }
});

// POST /api/exams/:id/start - 試験開始
router.post('/:id/start', requireAuth, (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const userId = (req.session as any)?.userId as string;
    
    const exam = sampleExams.find((e: Exam) => e.id === id && e.isActive);
    
    if (!exam) {
      httpErrorsTotal.labels("POST", "/exam", "500", "server_error").inc();
      httpRequestDuration.labels("POST", "/exam", "200").observe((Date.now() - startTime) / 1000);
      return res.status(404).json({ success: false, message: '試験が見つかりません' });
    }
    
    // 既存のアクティブセッションをチェック
    const existingSession = examSessions.find(
      s => s.examId === id && s.userId === userId && s.isActive
    );
    
    if (existingSession) {
      httpErrorsTotal.labels("POST", "/exam", "500", "server_error").inc();
      httpRequestDuration.labels("POST", "/exam", "200").observe((Date.now() - startTime) / 1000);
      return res.status(400).json({ 
        success: false, 
        message: '既に試験が開始されています' 
      });
    }
    
    // 新しいセッションを作成
    const sessionId = uuidv4();
    const session: ExamSession = {
      id: sessionId,
      examId: id,
      userId,
      startedAt: new Date(),
      timeLimit: exam.timeLimit,
      currentQuestionIndex: 0,
      answers: {},
      isActive: true
    };
    
    examSessions.push(session);
    
    // 正解と解説を除いた試験データを返す
    const examForStudent = {
      ...exam,
      questions: exam.questions.map((q: any) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        points: q.points,
        difficulty: q.difficulty,
        tags: q.tags
      }))
    };
    
    // メトリクス記録
    examStartCounter.labels(exam.category || 'unknown', exam.category, exam.difficulty.toString()).inc();
    httpRequestDuration.labels("POST", "/exam", "200").observe((Date.now() - startTime) / 1000);
    
    const response: ExamStartResponse = {
      success: true,
      sessionId,
      exam: examForStudent,
      timeRemaining: exam.timeLimit * 60 // 秒に変換
    };
    
    res.json(response);
  } catch (error) {
    console.error('試験開始エラー:', error);
    
    // エラーメトリクス記録
    httpErrorsTotal.labels("POST", "/exam", "500", "server_error").inc();
    httpRequestDuration.labels("POST", "/exam", "200").observe((Date.now() - startTime) / 1000);
    
    res.status(500).json({ success: false, message: '内部サーバーエラー' });
  }
});

// POST /api/exams/:id/submit - 試験回答提出
router.post('/:id/submit', requireAuth, (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const userId = (req.session as any)?.userId as string;
    const { sessionId, answers } = req.body;
    
    const session = examSessions.find(
      s => s.id === sessionId && s.examId === id && s.userId === userId && s.isActive
    );
    
    if (!session) {
      return res.status(404).json({ success: false, message: '有効なセッションが見つかりません' });
    }
    
    const exam = sampleExams.find((e: Exam) => e.id === id);
    if (!exam) {
      return res.status(404).json({ success: false, message: '試験が見つかりません' });
    }
    
    // セッションを終了
    session.isActive = false;
    session.answers = answers;
    
    // 採点処理
    let score = 0;
    let totalPoints = 0;
    let correctAnswers = 0;
    const results: any[] = [];
    
    for (const question of exam.questions) {
      totalPoints += question.points;
      const userAnswer = answers[question.id];
      const correctAnswer = question.correctAnswer;
      
      let isCorrect = false;
      
      if (Array.isArray(correctAnswer)) {
        // 複数正解の場合
        isCorrect = Array.isArray(userAnswer) && 
          userAnswer.length === correctAnswer.length &&
          userAnswer.every(ans => correctAnswer.includes(ans));
      } else {
        // 単一正解の場合
        isCorrect = userAnswer === correctAnswer;
      }
      
      if (isCorrect) {
        score += question.points;
        correctAnswers++;
      }
      
      results.push({
        questionId: question.id,
        isCorrect,
        userAnswer,
        correctAnswer,
        explanation: question.explanation
      });
    }
    
    const percentage = Math.round((score / totalPoints) * 100);
    const passed = percentage >= exam.passingScore;
    const timeSpent = Math.floor((new Date().getTime() - session.startedAt.getTime()) / 1000);
    
    // 受験記録を保存
    const attempt: ExamAttempt = {
      id: uuidv4(),
      examId: id,
      userId,
      answers,
      score,
      totalPoints,
      timeSpent,
      startedAt: session.startedAt,
      completedAt: new Date(),
      passed
    };
    
    examAttempts.push(attempt);
    
    // メトリクス記録
    examCompletionCounter.labels(exam.category, exam.category, passed ? 'true' : 'false').inc();
    examScoreHistogram.labels(exam.category, exam.category).observe(percentage);
    examDurationHistogram.labels(exam.category, exam.category).observe(timeSpent);
    httpRequestDuration.labels("POST", "/exam", "200").observe((Date.now() - startTime) / 1000);
    
    const response: ExamSubmitResponse = {
      success: true,
      result: {
        score,
        totalPoints,
        percentage,
        passed,
        timeSpent,
        correctAnswers,
        totalQuestions: exam.questions.length,
        results
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('試験提出エラー:', error);
    res.status(500).json({ success: false, message: '内部サーバーエラー' });
  }
});

// GET /api/exams/:id/results - 試験結果取得
router.get('/:id/results', requireAuth, (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const userId = (req.session as any)?.userId as string;
    
    const userAttempts = examAttempts.filter(
      a => a.examId === id && a.userId === userId
    ).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    
    if (userAttempts.length === 0) {
      return res.status(404).json({ success: false, message: '受験記録が見つかりません' });
    }
    
    res.json({
      success: true,
      attempts: userAttempts
    });
  } catch (error) {
    console.error('試験結果取得エラー:', error);
    res.status(500).json({ success: false, message: '内部サーバーエラー' });
  }
});

export default router;
