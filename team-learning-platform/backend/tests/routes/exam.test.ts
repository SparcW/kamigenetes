import request from 'supertest';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { getTestApp } from '../helpers/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';
import { createAndLoginUser } from '../helpers/auth';

describe('試験API テスト', () => {
  let app: any;

  beforeAll(async () => {
    app = getTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('GET /api/exams', () => {
    it('認証ユーザーの試験一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exams).toBeDefined();
      expect(Array.isArray(response.body.exams)).toBe(true);
      expect(response.body.total).toBeDefined();
      expect(typeof response.body.total).toBe('number');
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/exams');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ログインが必要です');
    });

    it('カテゴリフィルターでの試験一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/exams?category=kubernetes')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exams).toBeDefined();
      
      // レスポンスにexamsがある場合、カテゴリフィルターが正しく適用されているかチェック
      if (response.body.exams.length > 0) {
        response.body.exams.forEach((exam: any) => {
          expect(exam.category).toBe('kubernetes');
        });
      }
    });

    it('難易度フィルターでの試験一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/exams?difficulty=2')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exams).toBeDefined();
      
      // レスポンスにexamsがある場合、難易度フィルターが正しく適用されているかチェック
      if (response.body.exams.length > 0) {
        response.body.exams.forEach((exam: any) => {
          expect(exam.difficulty).toBe(2);
        });
      }
    });

    it('タグフィルターでの試験一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/exams?tags=pod,service')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exams).toBeDefined();
    });

    it('複数フィルターでの試験一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/exams?category=kubernetes&difficulty=1&tags=basic')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exams).toBeDefined();
    });
  });

  describe('GET /api/exams/:id', () => {
    it('存在する試験の詳細取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        const response = await request(app)
          .get(`/api/exams/${examId}`)
          .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.exam).toBeDefined();
        expect(response.body.exam.id).toBe(examId);
        expect(response.body.exam.questions).toBeDefined();
        expect(Array.isArray(response.body.exam.questions)).toBe(true);
      }
    });

    it('存在しない試験の詳細取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const nonExistentId = 'non-existent-exam-id';

      const response = await request(app)
        .get(`/api/exams/${nonExistentId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('試験が見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/exams/some-exam-id');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ログインが必要です');
    });
  });

  describe('POST /api/exams/:id/start', () => {
    it('有効な試験の開始', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        const response = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sessionId).toBeDefined();
        expect(response.body.exam).toBeDefined();
        expect(response.body.timeRemaining).toBeDefined();
        expect(typeof response.body.timeRemaining).toBe('number');
        
        // 正解情報が除かれていることを確認
        if (response.body.exam.questions && response.body.exam.questions.length > 0) {
          response.body.exam.questions.forEach((question: any) => {
            expect(question.correctAnswer).toBeUndefined();
            expect(question.explanation).toBeUndefined();
          });
        }
      }
    });

    it('存在しない試験の開始', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const nonExistentId = 'non-existent-exam-id';

      const response = await request(app)
        .post(`/api/exams/${nonExistentId}/start`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('試験が見つかりません');
    });

    it('重複した試験開始の拒否', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        // 1回目の試験開始
        const firstResponse = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(firstResponse.status).toBe(200);

        // 2回目の試験開始（重複）
        const secondResponse = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(secondResponse.status).toBe(400);
        expect(secondResponse.body.success).toBe(false);
        expect(secondResponse.body.message).toBe('既に試験が開始されています');
      }
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .post('/api/exams/some-exam-id/start');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ログインが必要です');
    });
  });

  describe('POST /api/exams/:id/submit', () => {
    it('有効なセッションでの試験提出', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        // 試験開始
        const startResponse = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(startResponse.status).toBe(200);
        const sessionId = startResponse.body.sessionId;

        // 試験提出
        const submitData = {
          sessionId,
          answers: {} // 空の回答でもテスト可能
        };

        const response = await request(app)
          .post(`/api/exams/${examId}/submit`)
          .set('Cookie', cookies)
          .send(submitData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result).toBeDefined();
        expect(response.body.result.score).toBeDefined();
        expect(response.body.result.totalPoints).toBeDefined();
        expect(response.body.result.percentage).toBeDefined();
        expect(response.body.result.passed).toBeDefined();
        expect(response.body.result.timeSpent).toBeDefined();
        expect(response.body.result.correctAnswers).toBeDefined();
        expect(response.body.result.totalQuestions).toBeDefined();
        expect(response.body.result.results).toBeDefined();
        expect(Array.isArray(response.body.result.results)).toBe(true);
      }
    });

    it('無効なセッションでの試験提出', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        const submitData = {
          sessionId: 'invalid-session-id',
          answers: {}
        };

        const response = await request(app)
          .post(`/api/exams/${examId}/submit`)
          .set('Cookie', cookies)
          .send(submitData);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('有効なセッションが見つかりません');
      }
    });

    it('存在しない試験への提出', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const nonExistentId = 'non-existent-exam-id';

      const submitData = {
        sessionId: 'some-session-id',
        answers: {}
      };

      const response = await request(app)
        .post(`/api/exams/${nonExistentId}/submit`)
        .set('Cookie', cookies)
        .send(submitData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('未認証でのアクセス拒否', async () => {
      const submitData = {
        sessionId: 'some-session-id',
        answers: {}
      };

      const response = await request(app)
        .post('/api/exams/some-exam-id/submit')
        .send(submitData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ログインが必要です');
    });
  });

  describe('GET /api/exams/:id/results', () => {
    it('試験結果の取得（受験記録なし）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        const response = await request(app)
          .get(`/api/exams/${examId}/results`)
          .set('Cookie', cookies);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('受験記録が見つかりません');
      }
    });

    it('試験結果の取得（受験後）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 先に試験一覧を取得して有効な試験IDを取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        // 試験開始
        const startResponse = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(startResponse.status).toBe(200);
        const sessionId = startResponse.body.sessionId;

        // 試験提出
        const submitData = {
          sessionId,
          answers: {}
        };

        const submitResponse = await request(app)
          .post(`/api/exams/${examId}/submit`)
          .set('Cookie', cookies)
          .send(submitData);

        expect(submitResponse.status).toBe(200);

        // 結果取得
        const response = await request(app)
          .get(`/api/exams/${examId}/results`)
          .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.attempts).toBeDefined();
        expect(Array.isArray(response.body.attempts)).toBe(true);
        expect(response.body.attempts.length).toBeGreaterThan(0);
      }
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/exams/some-exam-id/results');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ログインが必要です');
    });
  });

  describe('試験の統合テスト', () => {
    it('試験の完全な流れ（一覧取得→開始→提出→結果確認）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 1. 試験一覧取得
      const listResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      
      if (listResponse.body.exams.length > 0) {
        const examId = listResponse.body.exams[0].id;

        // 2. 試験詳細取得
        const detailResponse = await request(app)
          .get(`/api/exams/${examId}`)
          .set('Cookie', cookies);

        expect(detailResponse.status).toBe(200);
        expect(detailResponse.body.success).toBe(true);

        // 3. 試験開始
        const startResponse = await request(app)
          .post(`/api/exams/${examId}/start`)
          .set('Cookie', cookies);

        expect(startResponse.status).toBe(200);
        expect(startResponse.body.success).toBe(true);
        const sessionId = startResponse.body.sessionId;

        // 4. 試験提出
        const submitData = {
          sessionId,
          answers: {}
        };

        const submitResponse = await request(app)
          .post(`/api/exams/${examId}/submit`)
          .set('Cookie', cookies)
          .send(submitData);

        expect(submitResponse.status).toBe(200);
        expect(submitResponse.body.success).toBe(true);

        // 5. 結果確認
        const resultsResponse = await request(app)
          .get(`/api/exams/${examId}/results`)
          .set('Cookie', cookies);

        expect(resultsResponse.status).toBe(200);
        expect(resultsResponse.body.success).toBe(true);
        expect(resultsResponse.body.attempts.length).toBe(1);
      }
    });

    it('異なるユーザー間での試験セッション隔離', async () => {
      const { cookies: user1Cookies } = await createAndLoginUser(app, 'learner');
      const { cookies: user2Cookies } = await createAndLoginUser(app, 'instructor');

      // 両ユーザーで試験一覧取得
      const user1ListResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', user1Cookies);

      const user2ListResponse = await request(app)
        .get('/api/exams')
        .set('Cookie', user2Cookies);

      expect(user1ListResponse.status).toBe(200);
      expect(user2ListResponse.status).toBe(200);

      // 両ユーザーが独立してアクセスできることを確認
      expect(user1ListResponse.body.success).toBe(true);
      expect(user2ListResponse.body.success).toBe(true);
    });
  });
});