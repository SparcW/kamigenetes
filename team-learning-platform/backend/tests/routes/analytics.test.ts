import request from 'supertest';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { getTestApp } from '../helpers/app';
import { cleanDatabase, disconnectDatabase, createTestUser, createTestTeam } from '../helpers/database';
import { createAndLoginUser } from '../helpers/auth';
import bcrypt from 'bcrypt';

describe('分析API テスト', () => {
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

  describe('GET /api/analytics/leaderboard/global', () => {
    it('全体リーダーボードの取得（総合）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/analytics/leaderboard/global')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('overall');
      expect(response.body.data.ranking).toBeDefined();
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('全体リーダーボードの取得（習熟度別）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/analytics/leaderboard/global?category=proficiency')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('proficiency');
      expect(response.body.data.ranking).toBeDefined();
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('全体リーダーボードの取得（進捗別）', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/analytics/leaderboard/global?category=progress')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('progress');
      expect(response.body.data.ranking).toBeDefined();
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('リーダーボードの件数制限', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/analytics/leaderboard/global?limit=5')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ranking.length).toBeLessThanOrEqual(5);
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/analytics/leaderboard/global');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analytics/leaderboard/team/:teamId', () => {
    it('存在しないチームのリーダーボード取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const nonExistentTeamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/leaderboard/team/${nonExistentTeamId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('チームが見つかりません');
    });

    it('管理者による他チームのリーダーボード取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      
      // テスト用チームを作成
      const instructor = await createTestUser({
        email: 'instructor@test.com',
        username: 'instructor',
        password_hash: await bcrypt.hash('password123', 1),
        role: 'instructor'
      });
      
      const team = await createTestTeam({
        name: 'Test Team',
        description: 'Test Description',
        instructor_id: instructor.id
      });

      const response = await request(app)
        .get(`/api/analytics/leaderboard/team/${team.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.team).toBeDefined();
      expect(response.body.data.ranking).toBeDefined();
      expect(Array.isArray(response.body.data.ranking)).toBe(true);
    });

    it('未認証でのアクセス拒否', async () => {
      const teamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/leaderboard/team/${teamId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analytics/user/:userId', () => {
    it('自分の統計情報取得', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get(`/api/analytics/user/${user.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.recentActivity).toBeDefined();
      
      // 統計の基本構造をチェック
      expect(response.body.data.stats.overview).toBeDefined();
      expect(response.body.data.stats.categoryStats).toBeDefined();
      expect(response.body.data.stats.proficiencyBreakdown).toBeDefined();
      expect(response.body.data.stats.examStats).toBeDefined();
    });

    it('管理者による他ユーザーの統計情報取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        password_hash: await bcrypt.hash('password123', 1),
        role: 'learner'
      });

      const response = await request(app)
        .get(`/api/analytics/user/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(targetUser.id);
    });

    it('一般ユーザーによる他ユーザー統計の取得拒否', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        password_hash: await bcrypt.hash('password123', 1),
        role: 'learner'
      });

      const response = await request(app)
        .get(`/api/analytics/user/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('アクセス権限がありません');
    });

    it('存在しないユーザーの統計取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/user/${nonExistentId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザーが見つかりません');
    });

    it('未認証でのアクセス拒否', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/user/${userId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analytics/team/:teamId', () => {
    it('存在しないチームの統計取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const nonExistentTeamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/team/${nonExistentTeamId}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('チームが見つかりません');
    });

    it('管理者によるチーム統計取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      
      // テスト用チームを作成
      const instructor = await createTestUser({
        email: 'instructor@test.com',
        username: 'instructor',
        password_hash: await bcrypt.hash('password123', 1),
        role: 'instructor'
      });
      
      const team = await createTestTeam({
        name: 'Test Team',
        description: 'Test Description',
        instructor_id: instructor.id
      });

      const response = await request(app)
        .get(`/api/analytics/team/${team.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.team).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.overview).toBeDefined();
      expect(response.body.data.stats.memberStats).toBeDefined();
    });

    it('未認証でのアクセス拒否', async () => {
      const teamId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/analytics/team/${teamId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/analytics/admin/dashboard', () => {
    it('管理者ダッシュボード統計の取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const response = await request(app)
        .get('/api/analytics/admin/dashboard')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.weeklyStats).toBeDefined();
      expect(response.body.data.recentActivity).toBeDefined();
      
      // 基本統計の構造をチェック
      expect(response.body.data.overview.totalUsers).toBeDefined();
      expect(response.body.data.overview.activeUsers).toBeDefined();
      expect(response.body.data.overview.totalTeams).toBeDefined();
      expect(response.body.data.overview.totalDocuments).toBeDefined();
      expect(response.body.data.overview.totalExams).toBeDefined();
      expect(response.body.data.overview.activityRate).toBeDefined();
    });

    it('一般ユーザーによる管理者ダッシュボードアクセス拒否', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/analytics/admin/dashboard')
        .set('Cookie', cookies);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('インストラクターによる管理者ダッシュボードアクセス', async () => {
      const { cookies } = await createAndLoginUser(app, 'instructor');

      const response = await request(app)
        .get('/api/analytics/admin/dashboard')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/analytics/admin/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('分析APIの統合テスト', () => {
    it('全ての分析エンドポイントの基本動作確認', async () => {
      const { user: adminUser, cookies: adminCookies } = await createAndLoginUser(app, 'admin');
      const { user: learnerUser, cookies: learnerCookies } = await createAndLoginUser(app, 'learner');

      // 全体リーダーボード取得
      const globalLeaderboard = await request(app)
        .get('/api/analytics/leaderboard/global')
        .set('Cookie', learnerCookies);

      expect(globalLeaderboard.status).toBe(200);

      // ユーザー統計取得（自分）
      const userStats = await request(app)
        .get(`/api/analytics/user/${learnerUser.id}`)
        .set('Cookie', learnerCookies);

      expect(userStats.status).toBe(200);

      // 管理者ダッシュボード取得
      const adminDashboard = await request(app)
        .get('/api/analytics/admin/dashboard')
        .set('Cookie', adminCookies);

      expect(adminDashboard.status).toBe(200);
    });

    it('権限によるアクセス制御の確認', async () => {
      const { cookies: learnerCookies } = await createAndLoginUser(app, 'learner');
      const { user: adminUser, cookies: adminCookies } = await createAndLoginUser(app, 'admin');

      // 一般ユーザーが管理者ダッシュボードにアクセス拒否されることを確認
      const learnerAdminAccess = await request(app)
        .get('/api/analytics/admin/dashboard')
        .set('Cookie', learnerCookies);

      expect(learnerAdminAccess.status).toBe(403);

      // 一般ユーザーが他ユーザーの統計にアクセス拒否されることを確認
      const learnerOtherUserAccess = await request(app)
        .get(`/api/analytics/user/${adminUser.id}`)
        .set('Cookie', learnerCookies);

      expect(learnerOtherUserAccess.status).toBe(403);

      // 管理者が他ユーザーの統計にアクセスできることを確認
      const adminOtherUserAccess = await request(app)
        .get(`/api/analytics/user/${adminUser.id}`)
        .set('Cookie', adminCookies);

      expect(adminOtherUserAccess.status).toBe(200);
    });

    it('異なるカテゴリのリーダーボード取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      // 総合リーダーボード
      const overall = await request(app)
        .get('/api/analytics/leaderboard/global?category=overall')
        .set('Cookie', cookies);

      // 習熟度リーダーボード
      const proficiency = await request(app)
        .get('/api/analytics/leaderboard/global?category=proficiency')
        .set('Cookie', cookies);

      // 進捗リーダーボード
      const progress = await request(app)
        .get('/api/analytics/leaderboard/global?category=progress')
        .set('Cookie', cookies);

      expect(overall.status).toBe(200);
      expect(proficiency.status).toBe(200);
      expect(progress.status).toBe(200);

      expect(overall.body.data.category).toBe('overall');
      expect(proficiency.body.data.category).toBe('proficiency');
      expect(progress.body.data.category).toBe('progress');
    });
  });
});