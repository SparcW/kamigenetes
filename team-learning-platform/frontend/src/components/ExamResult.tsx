import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Exam, ExamSubmitResponse } from '../types/exam';
import './ExamResult.css';

interface ExamResultState {
  result: ExamSubmitResponse['result'];
  exam: Exam;
}

const ExamResult: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const resultState = location.state as ExamResultState;

  // 結果データが無い場合は一覧にリダイレクト
  React.useEffect(() => {
    if (!resultState) {
      navigate('/exams');
    }
  }, [resultState, navigate]);

  if (!resultState) {
    return null; // リダイレクト処理中
  }

  const { result, exam } = resultState;

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  const getGradeColor = (): string => {
    if (result.passed) {
      if (result.percentage >= 90) return 'grade-excellent';
      if (result.percentage >= 80) return 'grade-good';
      return 'grade-pass';
    }
    return 'grade-fail';
  };

  const getGradeText = (): string => {
    if (result.passed) {
      if (result.percentage >= 90) return '優秀';
      if (result.percentage >= 80) return '良好';
      return '合格';
    }
    return '不合格';
  };

  const getEncouragementMessage = (): string => {
    if (result.passed) {
      if (result.percentage >= 90) {
        return '素晴らしい成績です！Kubernetesの概念をしっかりと理解されています。';
      }
      if (result.percentage >= 80) {
        return 'よくできました！基本的な理解は十分です。';
      }
      return '合格おめでとうございます！継続して学習を進めましょう。';
    }
    return '今回は惜しくも不合格でした。復習して再チャレンジしてください。';
  };

  const getNextStepRecommendations = (): string[] => {
    if (result.passed) {
      if (result.percentage >= 90) {
        return [
          '次のレベルの試験に挑戦してみましょう',
          '実際のKubernetesクラスターで実践してみましょう',
          '他のチームメンバーにアドバイスを共有してみましょう'
        ];
      }
      return [
        '間違えた問題を重点的に復習しましょう',
        '関連するドキュメントを読み直してみましょう',
        '次のレベルの試験に挑戦してみましょう'
      ];
    }
    return [
      '間違えた問題の解説をよく読んで理解を深めましょう',
      'Kubernetesの公式ドキュメントで概念を復習しましょう',
      '基礎的な演習から再度取り組んでみましょう',
      '準備ができたら再度試験に挑戦しましょう'
    ];
  };

  const getWeakAreas = (): string[] => {
    const incorrectResults = result.results.filter(r => !r.isCorrect);
    if (incorrectResults.length === 0) return [];
    
    // 簡易的な分析（実際はより詳細な分析が可能）
    return [
      'Pod の基本概念',
      'Service の設定',
      'Deployment の管理'
    ].slice(0, Math.min(incorrectResults.length, 3));
  };

  return (
    <div className="exam-result">
      <div className="result-header">
        <div className="result-header-content">
          <Link to="/exams" className="back-link">
            ← 試験一覧に戻る
          </Link>
          <h1>{exam.title} - 結果</h1>
        </div>
      </div>

      <div className="result-content">
        {/* 結果サマリー */}
        <div className="result-summary">
          <div className={`grade-badge ${getGradeColor()}`}>
            <div className="grade-icon">
              {result.passed ? '🎉' : '📚'}
            </div>
            <div className="grade-info">
              <div className="grade-text">{getGradeText()}</div>
              <div className="grade-percentage">{result.percentage}%</div>
            </div>
          </div>

          <div className="result-stats">
            <div className="stat-item">
              <div className="stat-value">{result.score}</div>
              <div className="stat-label">獲得点数</div>
            </div>
            <div className="stat-divider">/</div>
            <div className="stat-item">
              <div className="stat-value">{result.totalPoints}</div>
              <div className="stat-label">満点</div>
            </div>
          </div>

          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">正答数:</span>
              <span className="detail-value">
                {result.correctAnswers} / {result.totalQuestions} 問
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">所要時間:</span>
              <span className="detail-value">{formatTime(result.timeSpent)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">合格基準:</span>
              <span className="detail-value">{exam.passingScore}%</span>
            </div>
          </div>

          <div className="encouragement">
            <p>{getEncouragementMessage()}</p>
          </div>
        </div>

        {/* 問題別結果 */}
        <div className="question-results">
          <h2>問題別結果</h2>
          <div className="results-list">
            {result.results.map((questionResult, index) => (
              <div 
                key={questionResult.questionId} 
                className={`question-result ${questionResult.isCorrect ? 'correct' : 'incorrect'}`}
              >
                <div className="question-result-header">
                  <div className="question-number">問題 {index + 1}</div>
                  <div className={`result-icon ${questionResult.isCorrect ? 'correct' : 'incorrect'}`}>
                    {questionResult.isCorrect ? '✅' : '❌'}
                  </div>
                </div>

                <div className="question-result-content">
                  <div className="answer-comparison">
                    <div className="answer-section">
                      <h4>あなたの回答:</h4>
                      <div className="answer-value user-answer">
                        {Array.isArray(questionResult.userAnswer) 
                          ? questionResult.userAnswer.join(', ')
                          : questionResult.userAnswer || '未回答'
                        }
                      </div>
                    </div>

                    {!questionResult.isCorrect && (
                      <div className="answer-section">
                        <h4>正解:</h4>
                        <div className="answer-value correct-answer">
                          {Array.isArray(questionResult.correctAnswer)
                            ? questionResult.correctAnswer.join(', ')
                            : questionResult.correctAnswer
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="explanation">
                    <h4>解説:</h4>
                    <p>{questionResult.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクション */}
        <div className="result-actions">
          <div className="action-buttons">
            <Link to="/exams" className="action-button secondary">
              他の試験を受ける
            </Link>
            
            {!result.passed && (
              <Link 
                to={`/exams/${exam.id}`} 
                className="action-button primary"
              >
                再チャレンジ
              </Link>
            )}

            <button 
              onClick={() => window.print()} 
              className="action-button secondary"
            >
              結果を印刷
            </button>
          </div>

          {/* 学習のヒントセクション */}
          <div className="learning-guidance">
            <h3>📚 学習のヒント</h3>
            <div className="recommendations">
              {getNextStepRecommendations().map((recommendation, index) => (
                <div key={index} className="recommendation">
                  <span className="rec-icon">✨</span>
                  <span>{recommendation}</span>
                </div>
              ))}
            </div>
            
            {!result.passed && getWeakAreas().length > 0 && (
              <div className="weak-areas">
                <h4>🎯 重点復習エリア</h4>
                <div className="weak-area-tags">
                  {getWeakAreas().map((area, index) => (
                    <span key={index} className="weak-area-tag">{area}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResult;
