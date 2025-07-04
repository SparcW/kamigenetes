import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import ExamList from './components/ExamList';
import ExamDetail from './components/ExamDetail';
import ExamTaking from './components/ExamTaking';
import ExamResult from './components/ExamResult';
import BookshelfMenu from './components/BookshelfMenu';
import DocumentViewer from './components/DocumentViewer';
import DocsLayout from './components/DocsLayout';
import { documentService, DocumentContent } from './services/documentService';
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
            <Link to="/bookshelf" className="nav-link">📚 本棚</Link>
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
          <Route path="/bookshelf" element={<BookshelfMenu />} />
          <Route path="/docs/:categoryId/:documentId" element={<DocumentPage />} />
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
          <Link to="/bookshelf" className="cta-button">
            📚 ドキュメントを見る
          </Link>
          <Link to="/exams" className="cta-button secondary">
            🧪 試験を開始する
          </Link>
        </div>
      </div>

      <div className="features-section">
        <h3>✨ 主な機能</h3>
        <div className="features-grid">
          <div className="feature-card">
            <h4>📚 学習ドキュメント</h4>
            <p>包括的なKubernetes学習ガイドとリファレンス</p>
          </div>
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
          <Link to="/bookshelf" className="quick-action-button">
            📚 ドキュメントを見る
          </Link>
          <Link to="/exams" className="quick-action-button">
            📝 試験一覧を見る
          </Link>
        </div>
      </div>
    </div>
  );
};

// ドキュメント表示ページコンポーネント
const DocumentPage: React.FC = () => {
  const { categoryId, documentId } = useParams<{ categoryId: string; documentId: string }>();
  const [content, setContent] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');

  useEffect(() => {
    if (categoryId && documentId) {
      loadDocument();
      loadCategoryInfo();
    }
  }, [categoryId, documentId]);

  const loadDocument = async () => {
    if (!categoryId || !documentId) return;

    try {
      setLoading(true);
      const fileName = `${documentId}.md`;
      const documentContent = await documentService.getDocumentContent(categoryId, fileName);
      setContent(documentContent);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ドキュメントの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryInfo = async () => {
    try {
      const categories = await documentService.getCategories();
      const category = categories.find(cat => cat.id === categoryId);
      if (category) {
        setCategoryName(category.name);
      }
    } catch (err) {
      console.error('カテゴリ情報の取得に失敗しました:', err);
    }
  };

  if (loading) {
    return (
      <DocsLayout>
        <div className="document-loading">
          <div className="loading-spinner">⏳</div>
          <p>ドキュメントを読み込み中...</p>
        </div>
      </DocsLayout>
    );
  }

  if (error) {
    return (
      <DocsLayout>
        <div className="document-error">
          <h2>❌ エラーが発生しました</h2>
          <p>{error}</p>
          <button onClick={loadDocument} className="retry-button">
            再試行
          </button>
        </div>
      </DocsLayout>
    );
  }

  if (!content) {
    return (
      <DocsLayout>
        <div className="document-not-found">
          <h2>📄 ドキュメントが見つかりません</h2>
          <p>指定されたドキュメントは存在しないか、削除された可能性があります。</p>
        </div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout>
      <DocumentViewer 
        content={content}
        categoryId={categoryId}
        categoryName={categoryName}
      />
    </DocsLayout>
  );
};

export default App;
