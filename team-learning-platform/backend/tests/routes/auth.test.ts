import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { getTestApp } from '../helpers/app';
import { cleanDatabase, disconnectDatabase, createTestUser } from '../helpers/database';

describe('認証API テスト', () => {
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

  describe('POST /api/auth/login', () => {
    it('正常なログイン', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('admin');
    });

    it('無効なユーザー名でログイン失敗', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'invalid_user',
          password: 'admin123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザー名またはパスワードが正しくありません');
    });

    it('無効なパスワードでログイン失敗', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'invalid_password'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザー名またはパスワードが正しくありません');
    });

    it('必須フィールドが不足の場合のバリデーションエラー', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('メールアドレスでのログイン', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin@example.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('admin@example.com');
    });
  });

  describe('POST /api/auth/register', () => {
    it('正常な新規登録', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.displayName).toBe(userData.displayName);
    });

    it('既存ユーザー名での登録失敗', async () => {
      const userData = {
        username: 'admin',
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('このユーザー名は既に使用されています');
    });

    it('既存メールアドレスでの登録失敗', async () => {
      const userData = {
        username: 'newuser',
        email: 'admin@example.com',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('このメールアドレスは既に登録されています');
    });

    it('無効なメールアドレスでの登録失敗', async () => {
      const userData = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('短いパスワードでの登録失敗', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: '123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('無効なユーザー名文字での登録失敗', async () => {
      const userData = {
        username: 'user@name',
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('ログイン後のユーザー情報取得', async () => {
      // 先にログイン
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      const cookie = loginResponse.headers['set-cookie'];

      // ユーザー情報取得
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('admin');
    });

    it('未ログイン状態での認証エラー', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('認証が必要です');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('正常なログアウト', async () => {
      // 先にログイン
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      const cookie = loginResponse.headers['set-cookie'];

      // ログアウト
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ログアウトしました');
    });

    it('未ログイン状態でのログアウト', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ログアウトしました');
    });
  });

  describe('セッション管理', () => {
    it('ログイン後のセッション継続', async () => {
      // ログイン
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      const cookie = loginResponse.headers['set-cookie'];

      // セッション確認
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('ログアウト後のセッション無効化', async () => {
      // ログイン
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      const cookie = loginResponse.headers['set-cookie'];

      // ログアウト
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      // セッション確認（無効化されているはず）
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});