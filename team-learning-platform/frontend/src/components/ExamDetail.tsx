import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examService } from '../services/examService';
import { 
  Exam, 
  ExamDetailResponse, 
  DIFFICULTY_LABELS, 
  CATEGORY_LABELS,
  QUESTION_TYPE_LABELS 
} from '../types/exam';
import './ExamDetail.css';

const ExamDetail: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (examId) {
      fetchExamDetail();
    }
  }, [examId]);

  const fetchExamDetail = async () => {
    if (!examId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response: ExamDetailResponse = await examService.getExamDetail(examId);
      
      if (response.success) {
        setExam(response.exam);
      } else {
        setError('試験詳細の取得に失敗しました');
      }
    } catch (err) {
      console.error('試験詳細取得エラー:', err);
      setError('試験詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async () => {
    if (!examId || !exam) return;
    
    try {
      setStarting(true);
      const response = await examService.startExam(examId);
      
      if (response.success) {
        // 試験受験画面へ遷移
        navigate(`/exams/${examId}/take`, {
          state: {
            sessionId: response.sessionId,
            exam: response.exam,
            timeRemaining: response.timeRemaining
          }
        });
      } else {
        setError('試験の開始に失敗しました');
      }
    } catch (err) {
      console.error('試験開始エラー:', err);
      setError('試験の開始に失敗しました');
    } finally {
      setStarting(false);
    }
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

  const getQuestionTypeCount = (type: string): number => {
    if (!exam) return 0;
    return exam.questions.filter(q => q.type === type).length;
  };

  if (loading) {
    return (
      <div className="exam-detail">
        <div className="loading">
          <div className="spinner"></div>
          <p>試験詳細を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-detail">
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchExamDetail} className="retry-button">
            再試行
          </button>
          <button onClick={() => navigate('/exams')} className="back-button">
            試験一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="exam-detail">
        <div className="error">
          <p>試験が見つかりません</p>
          <button onClick={() => navigate('/exams')} className="back-button">
            試験一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-detail">
      <div className="exam-detail-header">
        <button 
          onClick={() => navigate('/exams')} 
          className="back-link"
        >
          ← 試験一覧に戻る
        </button>
        
        <div className="exam-title-section">
          <h1>{exam.title}</h1>
          <div className="exam-badges">
            <span className={`badge ${getCategoryColor(exam.category)}`}>
              {CATEGORY_LABELS[exam.category]}
            </span>
            <span className={`badge ${getDifficultyColor(exam.difficulty)}`}>
              {DIFFICULTY_LABELS[exam.difficulty]}
            </span>
          </div>
        </div>
      </div>

      <div className="exam-detail-content">
        <div className="exam-info-section">
          <div className="exam-description">
            <h2>📝 試験概要</h2>
            <p>{exam.description}</p>
          </div>

          <div className="exam-specs">
            <h2>📊 試験仕様</h2>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-label">⏱️ 制限時間</span>
                <span className="spec-value">{exam.timeLimit}分</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">🎯 合格点</span>
                <span className="spec-value">{exam.passingScore}%</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">📝 問題数</span>
                <span className="spec-value">{exam.questions.length}問</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">🏆 難易度</span>
                <span className="spec-value">{DIFFICULTY_LABELS[exam.difficulty]}</span>
              </div>
            </div>
          </div>

          <div className="question-breakdown">
            <h2>❓ 問題構成</h2>
            <div className="breakdown-grid">
              {getQuestionTypeCount('multiple_choice') > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">
                    {QUESTION_TYPE_LABELS['multiple_choice']}
                  </span>
                  <span className="breakdown-count">
                    {getQuestionTypeCount('multiple_choice')}問
                  </span>
                </div>
              )}
              {getQuestionTypeCount('yaml_generation') > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">
                    {QUESTION_TYPE_LABELS['yaml_generation']}
                  </span>
                  <span className="breakdown-count">
                    {getQuestionTypeCount('yaml_generation')}問
                  </span>
                </div>
              )}
              {getQuestionTypeCount('kubectl_command') > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">
                    {QUESTION_TYPE_LABELS['kubectl_command']}
                  </span>
                  <span className="breakdown-count">
                    {getQuestionTypeCount('kubectl_command')}問
                  </span>
                </div>
              )}
            </div>
          </div>

          {exam.prerequisites && exam.prerequisites.length > 0 && (
            <div className="prerequisites-section">
              <h2>⚠️ 前提条件</h2>
              <div className="prerequisites-list">
                {exam.prerequisites.map(prereq => (
                  <span key={prereq} className="prereq-tag">{prereq}</span>
                ))}
              </div>
            </div>
          )}

          <div className="exam-tags-section">
            <h2>🏷️ 関連タグ</h2>
            <div className="tags-list">
              {exam.tags.map(tag => (
                <span key={tag} className="exam-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="exam-action-section">
          <div className="action-card">
            <h2>🚀 試験開始</h2>
            <p className="action-description">
              準備ができたら試験を開始してください。<br />
              開始後は制限時間内に回答する必要があります。
            </p>
            
            <div className="action-warnings">
              <div className="warning-item">
                <span className="warning-icon">⚠️</span>
                <span>試験開始後は中断できません</span>
              </div>
              <div className="warning-item">
                <span className="warning-icon">⏰</span>
                <span>制限時間は{exam.timeLimit}分です</span>
              </div>
              <div className="warning-item">
                <span className="warning-icon">🎯</span>
                <span>合格には{exam.passingScore}%以上の得点が必要</span>
              </div>
            </div>

            <button 
              onClick={handleStartExam}
              disabled={starting}
              className={`start-exam-button ${starting ? 'loading' : ''}`}
            >
              {starting ? '開始中...' : '試験を開始する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamDetail;
