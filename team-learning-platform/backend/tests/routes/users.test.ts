import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { getTestApp } from '../helpers/app';
import { cleanDatabase, disconnectDatabase, createTestUser } from '../helpers/database';
import { createAndLoginUser, testUsers } from '../helpers/auth';

describe('ユーザー管理API テスト', () => {
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

  describe('GET /api/users', () => {
    it('管理者権限でのユーザー一覧取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      // テストユーザーを複数作成
      await createTestUser({
        email: 'user1@test.com',
        username: 'user1',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'User 1',
        role: 'USER'
      });

      await createTestUser({
        email: 'user2@test.com',
        username: 'user2',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'User 2',
        role: 'TEAM_MANAGER'
      });

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toBeDefined();
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('一般ユーザーでの権限エラー', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get('/api/users')
        .set('Cookie', cookies);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('未認証でのアクセス拒否', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('検索機能テスト', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      await createTestUser({
        email: 'search@test.com',
        username: 'searchuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const response = await request(app)
        .get('/api/users?search=search')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('ページネーション機能テスト', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const response = await request(app)
        .get('/api/users?page=1&limit=5')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/users/:id', () => {
    it('自分の詳細情報取得', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const response = await request(app)
        .get(`/api/users/${user.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(user.id);
      expect(response.body.data.username).toBe(user.username);
      expect(response.body.data.stats).toBeDefined();
    });

    it('管理者による他ユーザーの詳細情報取得', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const response = await request(app)
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(targetUser.id);
    });

    it('一般ユーザーによる他ユーザー情報の取得拒否', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const response = await request(app)
        .get(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('存在しないユーザー', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const response = await request(app)
        .get('/api/users/nonexistent-id')
        .set('Cookie', cookies);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users', () => {
    it('管理者による正常なユーザー作成', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const newUserData = {
        username: 'newuser123',
        email: 'newuser@test.com',
        password: 'Password123',
        displayName: 'New User',
        role: 'learner'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send(newUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(newUserData.username);
      expect(response.body.data.email).toBe(newUserData.email);
      expect(response.body.data.role).toBe(newUserData.role);
    });

    it('一般ユーザーによるユーザー作成の権限エラー', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');

      const newUserData = {
        username: 'newuser123',
        email: 'newuser@test.com',
        password: 'Password123',
        displayName: 'New User',
        role: 'learner'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send(newUserData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('既存ユーザー名での作成失敗', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      await createTestUser({
        email: 'existing@test.com',
        username: 'existinguser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const newUserData = {
        username: 'existinguser',
        email: 'newemail@test.com',
        password: 'Password123',
        displayName: 'New User',
        role: 'learner'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send(newUserData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ユーザー名は既に使用されています');
    });

    it('バリデーションエラー - 無効なメールアドレス', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const newUserData = {
        username: 'newuser123',
        email: 'invalid-email',
        password: 'Password123',
        displayName: 'New User',
        role: 'learner'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send(newUserData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('バリデーションエラー - 弱いパスワード', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');

      const newUserData = {
        username: 'newuser123',
        email: 'newuser@test.com',
        password: 'weak',
        displayName: 'New User',
        role: 'learner'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Cookie', cookies)
        .send(newUserData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/users/:id', () => {
    it('自分の情報更新', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const updateData = {
        displayName: 'Updated Name',
        email: 'updated@test.com'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}`)
        .set('Cookie', cookies)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe(updateData.displayName);
      expect(response.body.data.email).toBe(updateData.email);
    });

    it('管理者による他ユーザー情報更新', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const updateData = {
        displayName: 'Admin Updated Name',
        role: 'instructor'
      };

      const response = await request(app)
        .put(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe(updateData.displayName);
      expect(response.body.data.role).toBe(updateData.role);
    });

    it('一般ユーザーによる他ユーザー情報更新の権限エラー', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const updateData = {
        displayName: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('一般ユーザーによる権限変更の拒否', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const updateData = {
        role: 'admin'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}`)
        .set('Cookie', cookies)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('権限変更はスーパー管理者のみ可能');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('管理者による他ユーザー削除', async () => {
      const { cookies } = await createAndLoginUser(app, 'admin');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const response = await request(app)
        .delete(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ユーザーを削除しました');
    });

    it('管理者による自己削除の拒否', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'admin');

      const response = await request(app)
        .delete(`/api/users/${user.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('自分自身は削除できません');
    });

    it('一般ユーザーによる削除の権限エラー', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const response = await request(app)
        .delete(`/api/users/${targetUser.id}`)
        .set('Cookie', cookies);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id/password', () => {
    it('正常なパスワード変更', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const passwordData = {
        currentPassword: testUsers.learner.password,
        newPassword: 'NewPassword123'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}/password`)
        .set('Cookie', cookies)
        .send(passwordData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('パスワードを変更しました');
    });

    it('間違った現在のパスワード', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const passwordData = {
        currentPassword: 'wrong_password',
        newPassword: 'NewPassword123'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}/password`)
        .set('Cookie', cookies)
        .send(passwordData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('現在のパスワードが正しくありません');
    });

    it('他ユーザーのパスワード変更の拒否', async () => {
      const { cookies } = await createAndLoginUser(app, 'learner');
      const targetUser = await createTestUser({
        email: 'target@test.com',
        username: 'targetuser',
        passwordHash: await bcrypt.hash('password123', 1),
        displayName: 'Test User',
        role: 'USER'
      });

      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'NewPassword123'
      };

      const response = await request(app)
        .put(`/api/users/${targetUser.id}/password`)
        .set('Cookie', cookies)
        .send(passwordData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('他のユーザーのパスワードは変更できません');
    });

    it('弱い新パスワードでのバリデーションエラー', async () => {
      const { user, cookies } = await createAndLoginUser(app, 'learner');

      const passwordData = {
        currentPassword: testUsers.learner.password,
        newPassword: 'weak'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}/password`)
        .set('Cookie', cookies)
        .send(passwordData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });
});