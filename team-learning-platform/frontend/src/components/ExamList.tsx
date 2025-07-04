import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examService } from '../services/examService';
import { 
  Exam, 
  ExamListResponse, 
  DIFFICULTY_LABELS, 
  CATEGORY_LABELS 
} from '../types/exam';
import './ExamList.css';

interface ExamListProps {
  className?: string;
}

const ExamList: React.FC<ExamListProps> = ({ className }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    difficulty: 0,
    tags: ''
  });

  useEffect(() => {
    fetchExams();
  }, [filters]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching exams with filters:', filters);
      
      const filterParams = {
        category: filters.category || undefined,
        difficulty: filters.difficulty || undefined,
        tags: filters.tags ? filters.tags.split(',').map(tag => tag.trim()) : undefined
      };

      console.log('Filter params:', filterParams);
      const response: ExamListResponse = await examService.getExams(filterParams);
      console.log('Exams response:', response);
      
      if (response.success) {
        setExams(response.exams);
      } else {
        setError('試験一覧の取得に失敗しました');
      }
    } catch (err) {
      console.error('試験一覧取得エラー:', err);
      
      // 詳細なエラー情報を表示
      if (err instanceof Error) {
        console.error('エラーメッセージ:', err.message);
        console.error('エラー名:', err.name);
        console.error('エラースタック:', err.stack);
        
        // ApiErrorの場合は詳細情報を表示
        if (err.name === 'ApiError') {
          const apiError = err as any;
          console.error('ステータスコード:', apiError.statusCode);
          console.error('レスポンス:', apiError.response);
          setError(`API呼び出しエラー (${apiError.statusCode}): ${apiError.response?.message || err.message}`);
        } else {
          setError(`試験一覧の取得に失敗しました: ${err.message}`);
        }
      } else {
        setError(`試験一覧の取得に失敗しました: ${err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1: return 'difficulty-1';
      case 2: return 'difficulty-2';
      case 3: return 'difficulty-3';
      case 4: return 'difficulty-4';
      case 5: return 'difficulty-5';
      default: return 'difficulty-default';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'concept': return 'category-concept';
      case 'yaml': return 'category-yaml';
      case 'practical': return 'category-practical';
      default: return 'category-default';
    }
  };

  if (loading) {
    return (
      <div className={`exam-list ${className || ''}`}>
        <div className="exam-list-header">
          <h2>🧪 Kubernetes試験</h2>
          <p>AWS ECS管理者向けのKubernetes習熟度テスト</p>
        </div>
        <div className="loading">
          <div className="spinner"></div>
          <p>試験一覧を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`exam-list ${className || ''}`}>
        <div className="exam-list-header">
          <h2>🧪 Kubernetes試験</h2>
          <p>AWS ECS管理者向けのKubernetes習熟度テスト</p>
        </div>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchExams} className="retry-button">
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`exam-list ${className || ''}`}>
      <div className="exam-list-header">
        <h2>🧪 Kubernetes試験</h2>
        <p>AWS ECS管理者向けのKubernetes習熟度テスト</p>
      </div>

      {/* フィルター */}
      <div className="exam-filters">
        <div className="filter-group">
          <label htmlFor="category-filter">カテゴリー:</label>
          <select
            id="category-filter"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">すべて</option>
            <option value="concept">概念</option>
            <option value="yaml">YAML</option>
            <option value="practical">実践</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="difficulty-filter">難易度:</label>
          <select
            id="difficulty-filter"
            value={filters.difficulty}
            onChange={(e) => handleFilterChange('difficulty', parseInt(e.target.value))}
          >
            <option value={0}>すべて</option>
            <option value={1}>初級</option>
            <option value={2}>初中級</option>
            <option value={3}>中級</option>
            <option value={4}>中上級</option>
            <option value={5}>上級</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="tags-filter">タグ:</label>
          <input
            id="tags-filter"
            type="text"
            placeholder="Pod,Service,Deployment"
            value={filters.tags}
            onChange={(e) => handleFilterChange('tags', e.target.value)}
          />
        </div>
      </div>

      {/* 試験一覧 */}
      <div className="exam-grid">
        {exams.length === 0 ? (
          <div className="no-exams">
            <p>条件に一致する試験がありません</p>
          </div>
        ) : (
          exams.map(exam => (
            <div key={exam.id} className="exam-card">
              <div className="exam-card-header">
                <h3>{exam.title}</h3>
                <div className="exam-badges">
                  <span className={`badge ${getCategoryColor(exam.category)}`}>
                    {CATEGORY_LABELS[exam.category]}
                  </span>
                  <span className={`badge ${getDifficultyColor(exam.difficulty)}`}>
                    {DIFFICULTY_LABELS[exam.difficulty]}
                  </span>
                </div>
              </div>
              
              <div className="exam-card-body">
                <p className="exam-description">{exam.description}</p>
                
                <div className="exam-meta">
                  <div className="meta-item">
                    <span className="meta-label">⏱️ 制限時間:</span>
                    <span className="meta-value">{exam.timeLimit}分</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">🎯 合格点:</span>
                    <span className="meta-value">{exam.passingScore}%</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">📝 問題数:</span>
                    <span className="meta-value">{exam.questions.length}問</span>
                  </div>
                </div>

                {exam.prerequisites && exam.prerequisites.length > 0 && (
                  <div className="prerequisites">
                    <span className="prereq-label">前提条件:</span>
                    <div className="prereq-tags">
                      {exam.prerequisites.map(prereq => (
                        <span key={prereq} className="prereq-tag">{prereq}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="exam-tags">
                  {exam.tags.map(tag => (
                    <span key={tag} className="exam-tag">{tag}</span>
                  ))}
                </div>
              </div>
              
              <div className="exam-card-footer">
                <Link 
                  to={`/exams/${exam.id}`} 
                  className="exam-start-button"
                >
                  試験を開始
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExamList;
