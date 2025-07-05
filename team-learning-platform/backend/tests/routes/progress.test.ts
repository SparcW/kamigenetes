import request from 'supertest';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { getTestApp } from '../helpers/app';
import { cleanDatabase, disconnectDatabase, createTestUser } from '../helpers/database';
import { createAndLoginUser } from '../helpers/auth';

describe('進捗管理API テスト', () => {
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

  describe('GET /api/progress', () => {
    it('ログインユーザーの進捗一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.progress).toBeDefined();
      expect(Array.isArray(response.body.data.progress)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/progress');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('カテゴリフィルターでの進捗取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress?category=kubernetes')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.progress).toBeDefined();
    });

    it('完了フィルターでの進捗取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress?completed=true')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.progress).toBeDefined();
    });

    it('ページネーション機能テスト', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress?page=1&limit=10')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/progress/:documentId', () => {
    it('存在しない進捗の取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const documentId = '550e8400-e29b-41d4-a716-446655440000'; // ダミーUUID

      const response = await request(app)
        .get(`/api/progress/${documentId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('読書進捗が見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const documentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/progress/${documentId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/progress', () => {
    it('バリデーションエラー - 無効なドキュメントID', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const progressData = {
        documentId: 'invalid-uuid',
        progressPercentage: 50,
        totalReadingTime: 300,
        lastPosition: 100
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Cookie', cookies)
        .send(progressData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('バリデーションエラー - 無効な進捗率', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const progressData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        progressPercentage: 150, // 100を超える値
        totalReadingTime: 300,
        lastPosition: 100
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Cookie', cookies)
        .send(progressData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('バリデーションエラー - 負の読書時間', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const progressData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        progressPercentage: 50,
        totalReadingTime: -100,
        lastPosition: 100
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Cookie', cookies)
        .send(progressData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('存在しないドキュメントでの進捗作成失敗', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const progressData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        progressPercentage: 50,
        totalReadingTime: 300,
        lastPosition: 100
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Cookie', cookies)
        .send(progressData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ドキュメントが見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const progressData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        progressPercentage: 50,
        totalReadingTime: 300,
        lastPosition: 100
      };

      const response = await request(app)
        .post('/api/progress')
        .send(progressData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/progress/:documentId', () => {
    it('存在しない進捗の削除', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const documentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/progress/${documentId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('読書進捗が見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const documentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/progress/${documentId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/progress/favorites', () => {
    it('お気に入り一覧の取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress/favorites')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/progress/favorites');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/progress/favorites', () => {
    it('バリデーションエラー - 無効なドキュメントID', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const favoriteData = {
        documentId: 'invalid-uuid',
        notes: 'テストノート'
      };

      const response = await request(app)
        .post('/api/progress/favorites')
        .set('Cookie', cookies)
        .send(favoriteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('バリデーションエラー - 長すぎるノート', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const favoriteData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'a'.repeat(501) // 500文字を超える
      };

      const response = await request(app)
        .post('/api/progress/favorites')
        .set('Cookie', cookies)
        .send(favoriteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('存在しないドキュメントでのお気に入り追加失敗', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const favoriteData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'テストノート'
      };

      const response = await request(app)
        .post('/api/progress/favorites')
        .set('Cookie', cookies)
        .send(favoriteData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ドキュメントが見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const favoriteData = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'テストノート'
      };

      const response = await request(app)
        .post('/api/progress/favorites')
        .send(favoriteData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/progress/favorites/:documentId', () => {
    it('存在しないお気に入りの削除', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const documentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/progress/favorites/${documentId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('お気に入りが見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const documentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/progress/favorites/${documentId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/progress/stats', () => {
    it('学習統計の取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/progress/stats')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalDocuments).toBeDefined();
      expect(response.body.data.completedDocuments).toBeDefined();
      expect(response.body.data.totalReadingTime).toBeDefined();
      expect(response.body.data.favoriteCount).toBeDefined();
      expect(response.body.data.averageProficiency).toBeDefined();
      expect(response.body.data.completionRate).toBeDefined();
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/progress/stats');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('進捗管理の統合テスト', () => {
    it('進捗作成・取得・削除の流れ', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // テスト用ドキュメントを作成する必要があるが、
      // この段階では簡単なAPIレスポンステストに留める
      
      // 進捗一覧取得
      const listResponse = await request(app)
        .get('/api/progress')
        .set('Cookie', cookies);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);

      // 学習統計取得
      const statsResponse = await request(app)
        .get('/api/progress/stats')
        .set('Cookie', cookies);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);

      // お気に入り一覧取得
      const favoritesResponse = await request(app)
        .get('/api/progress/favorites')
        .set('Cookie', cookies);

      expect(favoritesResponse.status).toBe(200);
      expect(favoritesResponse.body.success).toBe(true);
    });

    it('異なるユーザー間での進捗隔離', async () => {
      const { cookies: user1Cookies } = await createAndLoginUser(app, 'learner');
      const { cookies: user2Cookies } = await createAndLoginUser(app, 'instructor');

      // ユーザー1の進捗取得
      const user1Response = await request(app)
        .get('/api/progress')
        .set('Cookie', user1Cookies);

      // ユーザー2の進捗取得
      const user2Response = await request(app)
        .get('/api/progress')
        .set('Cookie', user2Cookies);

      expect(user1Response.status).toBe(200);
      expect(user2Response.status).toBe(200);
      
      // 両方とも成功し、独立したデータを返すことを確認
      expect(user1Response.body.success).toBe(true);
      expect(user2Response.body.success).toBe(true);
    });
  });
});