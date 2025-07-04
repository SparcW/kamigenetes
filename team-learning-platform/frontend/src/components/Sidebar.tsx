import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DocumentCategory, documentService } from '../services/documentService';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * サイドバーナビゲーションコンポーネント
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, className = '' }) => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const location = useLocation();

  useEffect(() => {
    loadCategories();
  }, []);

  // 現在のパスに基づいてカテゴリを展開
  useEffect(() => {
    const currentPath = location.pathname;
    const pathSegments = currentPath.split('/');
    
    if (pathSegments[1] === 'docs' && pathSegments[2]) {
      setExpandedCategories(prev => new Set([...prev, pathSegments[2]]));
    }
  }, [location.pathname]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await documentService.getCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'カテゴリの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const isActiveDocument = (categoryId: string, fileName: string): boolean => {
    const currentPath = location.pathname;
    const documentPath = `/docs/${categoryId}/${fileName.replace('.md', '')}`;
    return currentPath === documentPath;
  };

  const isActiveCategory = (categoryId: string): boolean => {
    const currentPath = location.pathname;
    return currentPath.startsWith(`/docs/${categoryId}`);
  };

  if (loading) {
    return (
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${className}`}>
        <div className="sidebar-content">
          <div className="sidebar-loading">
            <div className="loading-spinner"></div>
            <p>読み込み中...</p>
          </div>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${className}`}>
        <div className="sidebar-content">
          <div className="sidebar-error">
            <p>❌ エラーが発生しました</p>
            <button onClick={loadCategories} className="retry-button">
              再試行
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* オーバーレイ（モバイル用） */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
      
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${className}`}>
        <div className="sidebar-header">
          <h2>📚 ドキュメント</h2>
          <button 
            className="sidebar-toggle-btn"
            onClick={onToggle}
            aria-label="サイドバーを閉じる"
          >
            ✕
          </button>
        </div>

        <div className="sidebar-content">
          <nav className="sidebar-nav">
            <ul className="category-list">
              {categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const isActive = isActiveCategory(category.id);
                
                return (
                  <li key={category.id} className="category-item">
                    <div 
                      className={`category-header ${isActive ? 'active' : ''}`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <span className="category-icon">{category.icon}</span>
                      <span className="category-name">{category.name}</span>
                      <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </div>
                    
                    {isExpanded && (
                      <ul className="document-list">
                        {category.files.map((file) => {
                          const isActiveDoc = isActiveDocument(category.id, file.name);
                          
                          return (
                            <li key={file.id} className="document-item">
                              <Link
                                to={`/docs/${category.id}/${file.id}`}
                                className={`document-link ${isActiveDoc ? 'active' : ''}`}
                                title={file.title}
                              >
                                <span className="document-icon">📄</span>
                                <span className="document-title">{file.title}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer">
          <Link to="/docs" className="view-all-link">
            📚 すべてのドキュメントを表示
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
