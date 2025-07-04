import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DocumentCategory, documentService } from '../services/documentService';
import { DocumentSearch } from './DocumentSearch';
import './BookshelfMenu.css';

interface BookshelfMenuProps {
  className?: string;
}

/**
 * 本棚メニューコンポーネント
 * ドキュメントカテゴリとファイル一覧を表示
 */
export const BookshelfMenu: React.FC<BookshelfMenuProps> = ({ className = '' }) => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={`bookshelf-menu ${className}`}>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>ドキュメントを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bookshelf-menu ${className}`}>
        <div className="error-state">
          <div className="error-icon">❌</div>
          <h3>エラーが発生しました</h3>
          <p>{error}</p>
          <button 
            onClick={loadCategories}
            className="retry-button"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bookshelf-menu ${className}`}>
      <div className="bookshelf-header">
        <h1>📚 Kubernetes学習ドキュメント</h1>
        <p>AWS ECS管理者向けの包括的なKubernetes学習ガイド</p>
      </div>

      <div className="search-section">
        <DocumentSearch />
      </div>

      <div className="categories-grid">
        {categories.map((category) => (
          <div key={category.id} className="category-card">
            <div 
              className="category-header"
              onClick={() => toggleCategory(category.id)}
            >
              <div className="category-info">
                <span className="category-icon">{category.icon}</span>
                <div>
                  <h3 className="category-name">{category.name}</h3>
                  <p className="category-description">{category.description}</p>
                </div>
              </div>
              <div className="category-meta">
                <span className="file-count">{category.files.length} ファイル</span>
                <span className={`expand-icon ${expandedCategories.has(category.id) ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>
            </div>

            {expandedCategories.has(category.id) && (
              <div className="files-list">
                {category.files.map((file) => (
                  <Link
                    key={file.id}
                    to={`/docs/${category.id}/${file.id}`}
                    className="file-item"
                  >
                    <div className="file-info">
                      <span className="file-icon">📄</span>
                      <div>
                        <h4 className="file-title">{file.title}</h4>
                        <p className="file-name">{file.name}</p>
                      </div>
                    </div>
                    <div className="file-meta">
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      <span className="file-date">{formatDate(file.lastModified)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookshelfMenu;
