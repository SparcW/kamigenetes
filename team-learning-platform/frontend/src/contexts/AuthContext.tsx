import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: { username: string; email: string; password: string; displayName: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // アプリケーション起動時に認証状態を確認
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await authService.login({ username, password });
      if (response.success && response.user) {
        setUser(response.user);
        return true;
      } else {
        setError(response.message || 'ログインに失敗しました');
        // エラーメッセージを5秒後に自動クリア
        setTimeout(() => setError(null), 5000);
        return false;
      }
    } catch (error) {
      setError('ログインに失敗しました');
      setTimeout(() => setError(null), 5000);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: { username: string; email: string; password: string; displayName: string }): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await authService.register(userData);
      if (response.success && response.user) {
        setUser(response.user);
        return true;
      } else {
        setError(response.message || '登録に失敗しました');
        // エラーメッセージを5秒後に自動クリア
        setTimeout(() => setError(null), 5000);
        return false;
      }
    } catch (error) {
      setError('登録に失敗しました');
      setTimeout(() => setError(null), 5000);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
