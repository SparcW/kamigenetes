// 試験API サービス

import { 
  ExamListResponse, 
  ExamDetailResponse, 
  ExamStartResponse, 
  ExamSubmitResponse,
  ApiErrorResponse 
} from '../types/exam';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

// APIエラーハンドリング
class ApiError extends Error {
  constructor(public statusCode: number, public response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
  }
}

// 汎用API呼び出し関数
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    credentials: 'include', // セッションクッキーを含める
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(`API呼び出しエラー: ${error}`);
  }
}

// 試験API関数
export const examService = {
  // 試験一覧取得
  async getExams(filters?: {
    category?: string;
    difficulty?: number;
    tags?: string[];
  }): Promise<ExamListResponse> {
    let query = '';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.difficulty) params.append('difficulty', filters.difficulty.toString());
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      query = params.toString() ? `?${params.toString()}` : '';
    }
    
    return apiCall<ExamListResponse>(`/api/exams${query}`);
  },

  // 試験詳細取得
  async getExamDetail(examId: string): Promise<ExamDetailResponse> {
    return apiCall<ExamDetailResponse>(`/api/exams/${examId}`);
  },

  // 試験開始
  async startExam(examId: string): Promise<ExamStartResponse> {
    return apiCall<ExamStartResponse>(`/api/exams/${examId}/start`, {
      method: 'POST'
    });
  },

  // 試験回答提出
  async submitExam(
    examId: string, 
    sessionId: string, 
    answers: Record<string, string | string[]>
  ): Promise<ExamSubmitResponse> {
    return apiCall<ExamSubmitResponse>(`/api/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        answers
      })
    });
  },

  // 試験結果取得
  async getExamResults(examId: string): Promise<{
    success: boolean;
    attempts: Array<{
      id: string;
      score: number;
      totalPoints: number;
      timeSpent: number;
      startedAt: Date;
      completedAt: Date;
      passed: boolean;
    }>;
  }> {
    return apiCall(`/api/exams/${examId}/results`);
  }
};

export { ApiError };
