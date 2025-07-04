import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

interface LoginProps {
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const { login, isLoading, error } = useAuth();

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!username.trim()) {
      errors.username = 'ユーザー名を入力してください';
    }
    
    if (!password.trim()) {
      errors.password = 'パスワードを入力してください';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const success = await login(username, password);
    if (!success) {
      // エラーは AuthContext で管理されます
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>🔐 ログイン</h2>
          <p>アカウントにログインして試験を受験しましょう</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">ユーザー名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={validationErrors.username ? 'error' : ''}
              placeholder="ユーザー名を入力"
              disabled={isLoading}
            />
            {validationErrors.username && (
              <span className="error-message">{validationErrors.username}</span>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={validationErrors.password ? 'error' : ''}
              placeholder="パスワードを入力"
              disabled={isLoading}
            />
            {validationErrors.password && (
              <span className="error-message">{validationErrors.password}</span>
            )}
          </div>
          
          {error && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? '⏳ ログイン中...' : '🚀 ログイン'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>
            アカウントをお持ちでない方は{' '}
            <button 
              type="button"
              className="switch-button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              新規登録
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
