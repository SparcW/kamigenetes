import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';
import './AuthPage.css';

const AuthPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');

  const switchToLogin = () => setCurrentView('login');
  const switchToRegister = () => setCurrentView('register');

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="auth-pattern"></div>
      </div>
      
      <div className="auth-content">
        <div className="auth-welcome">
          <h1>🎓 Kubernetes学習プラットフォーム</h1>
          <p>AWS ECS管理者向けの包括的なKubernetes学習環境</p>
          <div className="auth-features">
            <div className="feature-item">
              <span className="feature-icon">🧪</span>
              <span>段階的な習熟度テスト</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>リアルタイム進捗監視</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <span>ECSとの概念比較</span>
            </div>
          </div>
        </div>
        
        <div className="auth-form-container">
          {currentView === 'login' ? (
            <Login onSwitchToRegister={switchToRegister} />
          ) : (
            <Register onSwitchToLogin={switchToLogin} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
