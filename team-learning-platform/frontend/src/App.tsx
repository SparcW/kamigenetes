import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import ExamList from './components/ExamList';
import ExamDetail from './components/ExamDetail';
import ExamTaking from './components/ExamTaking';
import ExamResult from './components/ExamResult';
import './App.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">⏳</div>
        <p>認証状態を確認中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <Link to="/" className="logo-link">
              🎓 チーム学習プラットフォーム
            </Link>
          </h1>
          <nav className="main-nav">
            <Link to="/" className="nav-link">ホーム</Link>
            <Link to="/exams" className="nav-link">試験一覧</Link>
            <div className="user-info">
              <span className="user-name">👤 {user?.displayName}</span>
              <button 
                onClick={logout}
                className="logout-button"
              >
                ログアウト
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/exams" element={<ExamList />} />
          <Route path="/exams/:examId" element={<ExamDetail />} />
          <Route path="/exams/:examId/take" element={<ExamTaking />} />
          <Route path="/exams/:examId/result" element={<ExamResult />} />
        </Routes>
      </main>
    </div>
  );
};

// ホームページコンポーネント
const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h2>🚀 AWS ECS管理者向けKubernetes学習プラットフォーム</h2>
        <p>段階的な学習プロセスで、AWS ECSからKubernetesへの移行をサポートします。</p>
        <div className="hero-actions">
          <Link to="/exams" className="cta-button">
            試験を開始する
          </Link>
        </div>
      </div>

      <div className="features-section">
        <h3>✨ 主な機能</h3>
        <div className="features-grid">
          <div className="feature-card">
            <h4>🧪 習熟度テスト</h4>
            <p>段階的な試験でKubernetesの理解度を確認</p>
          </div>
          <div className="feature-card">
            <h4>📊 リアルタイム監視</h4>
            <p>学習進捗と習熟度の可視化</p>
          </div>
          <div className="feature-card">
            <h4>🔄 ECS比較</h4>
            <p>AWS ECSとKubernetesの概念マッピング</p>
          </div>
        </div>
      </div>

      <div className="welcome-section">
        <h3>🎯 学習を開始しましょう</h3>
        <p>右上の「試験一覧」から、あなたのレベルに合った試験を選択してください。</p>
        <div className="quick-actions">
          <Link to="/exams" className="quick-action-button">
            📝 試験一覧を見る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default App;
