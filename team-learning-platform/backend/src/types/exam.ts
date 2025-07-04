// Kubernetes試験システムの型定義

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'yaml_generation' | 'kubectl_command';
  question: string;
  options?: string[]; // 選択肢（multiple_choice用）
  correctAnswer: string | string[]; // 正解
  explanation: string; // 解説
  points: number; // 配点
  difficulty: 1 | 2 | 3 | 4 | 5; // 難易度
  tags: string[]; // タグ（Pod, Service, Deployment等）
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  category: 'concept' | 'yaml' | 'practical';
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeLimit: number; // 分
  passingScore: number; // 合格点（%）
  questions: ExamQuestion[];
  prerequisites?: string[]; // 前提条件
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  answers: Record<string, string | string[]>; // questionId → answer
  score: number;
  totalPoints: number;
  timeSpent: number; // 秒
  startedAt: Date;
  completedAt: Date;
  passed: boolean;
}

export interface ExamSession {
  id: string;
  examId: string;
  userId: string;
  startedAt: Date;
  timeLimit: number;
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>;
  isActive: boolean;
}

// レスポンス型
export interface ExamListResponse {
  success: boolean;
  exams: Exam[];
  total: number;
}

export interface ExamDetailResponse {
  success: boolean;
  exam: Exam;
}

export interface ExamStartResponse {
  success: boolean;
  sessionId: string;
  exam: Omit<Exam, 'questions'> & {
    questions: Omit<ExamQuestion, 'correctAnswer' | 'explanation'>[];
  };
  timeRemaining: number;
}

export interface ExamSubmitResponse {
  success: boolean;
  result: {
    score: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
    timeSpent: number;
    correctAnswers: number;
    totalQuestions: number;
    results: Array<{
      questionId: string;
      isCorrect: boolean;
      userAnswer: string | string[];
      correctAnswer: string | string[];
      explanation: string;
    }>;
  };
}
