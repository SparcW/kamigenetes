// フロントエンド用 Kubernetes試験システムの型定義

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'yaml_generation' | 'kubectl_command';
  question: string;
  options?: string[]; // 選択肢（multiple_choice用）
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
  exam: Exam;
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

// API エラーレスポンス
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// 試験の難易度ラベル
export const DIFFICULTY_LABELS = {
  1: '初級',
  2: '初中級',
  3: '中級',
  4: '中上級',
  5: '上級'
} as const;

// 試験カテゴリーラベル
export const CATEGORY_LABELS = {
  concept: '概念',
  yaml: 'YAML',
  practical: '実践'
} as const;

// 試験タイプラベル
export const QUESTION_TYPE_LABELS = {
  multiple_choice: '選択問題',
  yaml_generation: 'YAML作成',
  kubectl_command: 'kubectlコマンド'
} as const;
