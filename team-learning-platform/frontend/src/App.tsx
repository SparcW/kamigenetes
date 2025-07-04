import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ExamList from './components/ExamList';
import ExamDetail from './components/ExamDetail';
import './App.css';

interface ApiStatus {
  backend: 'connected' | 'disconnected' | 'loading';
  database: 'connected' | 'disconnected' | 'loading'; 
  redis: 'connected' | 'disconnected' | 'loading';
}

const App: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    backend: 'loading',
    database: 'loading',
    redis: 'loading'
  });

  useEffect(() => {
    // バックエンドAPI接続テスト
    const testBackendConnection = async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          const data = await response.json();
          setApiStatus(prev => ({ ...prev, backend: 'connected' }));
          console.log('Backend API connected:', data);
        } else {
          setApiStatus(prev => ({ ...prev, backend: 'disconnected' }));
        }
      } catch (error) {
        console.error('Backend API connection failed:', error);
        setApiStatus(prev => ({ ...prev, backend: 'disconnected' }));
      }
    };

    testBackendConnection();
    
    // 5秒ごとに接続テスト
    const interval = setInterval(testBackendConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'disconnected': return '❌';
      case 'loading': return '⏳';
      default: return '❓';
    }
  };

  return (
    <Router>
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
              <div className="status-indicator">
                <span className="status-item">
                  {getStatusIcon(apiStatus.backend)} API
                </span>
              </div>
            </nav>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage apiStatus={apiStatus} />} />
            <Route path="/exams" element={<ExamList />} />
            <Route path="/exams/:examId" element={<ExamDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

// ホームページコンポーネント
const HomePage: React.FC<{ apiStatus: ApiStatus }> = ({ apiStatus }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'disconnected': return '❌';
      case 'loading': return '⏳';
      default: return '❓';
    }
  };

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

      <div className="status-section">
        <h3>📊 システム状況</h3>
        <div className="status-grid">
          <div className="status-card">
            <span className="status-icon">{getStatusIcon(apiStatus.backend)}</span>
            <div className="status-info">
              <h4>バックエンドAPI</h4>
              <p>{apiStatus.backend}</p>
            </div>
          </div>
          <div className="status-card">
            <span className="status-icon">🗄️</span>
            <div className="status-info">
              <h4>データベース</h4>
              <p>PostgreSQL</p>
            </div>
          </div>
          <div className="status-card">
            <span className="status-icon">🔴</span>
            <div className="status-info">
              <h4>キャッシュ</h4>
              <p>Redis</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
