import request from 'supertest';
import bcrypt from 'bcrypt';
import { createTestUser } from './database';

// テスト用ユーザーデータ
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    username: 'admin_user',
    password: 'admin_password123',
    role: 'SUPER_ADMIN' as const
  },
  instructor: {
    email: 'instructor@test.com',
    username: 'instructor_user',
    password: 'instructor_password123',
    role: 'TEAM_MANAGER' as const
  },
  learner: {
    email: 'learner@test.com',
    username: 'learner_user',
    password: 'learner_password123',
    role: 'USER' as const
  }
};

// テスト用ユーザー作成とログイン
export const createAndLoginUser = async (app: any, userType: keyof typeof testUsers) => {
  const userData = testUsers[userType];
  
  // パスワードハッシュ化
  const passwordHash = await bcrypt.hash(userData.password, 1);
  
  // ユーザー作成
  const user = await createTestUser({
    email: userData.email,
    username: userData.username,
    passwordHash,
    displayName: userData.username,
    role: userData.role
  });
  
  // ログイン
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: userData.email,
      password: userData.password
    });
  
  return {
    user,
    token: loginResponse.body.token,
    cookies: loginResponse.headers['set-cookie']
  };
};

// 認証ヘッダー取得
export const getAuthHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

// セッションCookie取得
export const getSessionCookie = (cookies: string[]) => {
  const sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='));
  return sessionCookie ? sessionCookie.split(';')[0] : '';
};