import React, { useState, useEffect } from 'react';
import { DocumentService, DocumentSearchResult } from '../services/documentService';
import './DocumentSearch.css';

interface DocumentSearchProps {
  onResultClick?: (result: DocumentSearchResult) => void;
}

/**
 * ドキュメント検索コンポーネント
 */
export const DocumentSearch: React.FC<DocumentSearchProps> = ({ onResultClick }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const documentService = new DocumentService();

  // カテゴリ一覧の取得
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await documentService.getCategories();
        setCategories(cats.map(cat => ({ id: cat.id, name: cat.name })));
      } catch (error) {
        console.error('カテゴリ取得エラー:', error);
      }
    };
    loadCategories();
  }, []);

  // 検索実行
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await documentService.searchDocuments(
        query.trim(),
        category || undefined
      );
      setResults(searchResults);
      setShowResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索に失敗しました');
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  };

  // 検索結果のクリック処理
  const handleResultClick = (result: DocumentSearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    } else {
      // デフォルトの処理：ウィンドウのURLを直接変更
      // .md拡張子を削除してパスを生成
      const fileName = result.name.replace('.md', '');
      window.location.href = `/docs/${result.category}/${fileName}`;
    }
    setShowResults(false);
  };

  // 検索クリア
  const handleClear = () => {
    setQuery('');
    setCategory('');
    setResults([]);
    setShowResults(false);
    setError(null);
  };

  return (
    <div className="document-search">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ドキュメントを検索..."
            className="search-input"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            <option value="">すべてのカテゴリ</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading} className="search-button">
            {loading ? '検索中...' : '🔍'}
          </button>
          {(query || category) && (
            <button type="button" onClick={handleClear} className="clear-button">
              ✕
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="search-error">
          ❌ {error}
        </div>
      )}

      {showResults && (
        <div className="search-results">
          <div className="results-header">
            <h3>検索結果</h3>
            <span className="results-count">{results.length}件</span>
          </div>
          
          {results.length === 0 ? (
            <div className="no-results">
              <p>「{query}」に一致するドキュメントが見つかりませんでした。</p>
            </div>
          ) : (
            <ul className="results-list">
              {results.map((result) => (
                <li
                  key={`${result.category}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="result-item"
                >
                  <div className="result-header">
                    <h4 className="result-title">{result.title}</h4>
                    <span className="result-category">{result.category}</span>
                  </div>
                  {result.snippet && (
                    <p className="result-snippet">{result.snippet}</p>
                  )}
                  <div className="result-meta">
                    <span className="result-file">{result.name}</span>
                    <span className="result-date">
                      {new Date(result.lastModified).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentSearch;
