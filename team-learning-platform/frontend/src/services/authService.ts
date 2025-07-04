interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

export const authService = {
  // ユーザー登録
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: '登録に失敗しました' };
    }
  },

  // ログイン
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'ログインに失敗しました' };
    }
  },

  // ログアウト
  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'ログアウトに失敗しました' };
    }
  },

  // 現在のユーザー情報取得
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get current user error:', error);
      return { success: false, message: 'ユーザー情報の取得に失敗しました' };
    }
  },
};

export type { User, AuthResponse, RegisterRequest, LoginRequest };
