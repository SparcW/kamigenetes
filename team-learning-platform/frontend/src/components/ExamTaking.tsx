import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { examService } from '../services/examService';
import { 
  Exam, 
  ExamQuestion, 
  QUESTION_TYPE_LABELS 
} from '../types/exam';
import './ExamTaking.css';

interface ExamTakingState {
  sessionId: string;
  exam: Exam;
  timeRemaining: number;
}

const ExamTaking: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const examState = location.state as ExamTakingState;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [timeRemaining, setTimeRemaining] = useState(examState?.timeRemaining || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // 試験データが無い場合は一覧にリダイレクト
  useEffect(() => {
    if (!examState) {
      navigate('/exams');
    }
  }, [examState, navigate]);

  // タイマー処理
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // 時間切れの場合は自動提出
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleAutoSubmit = useCallback(async () => {
    if (!examState || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      const response = await examService.submitExam(
        examState.exam.id,
        examState.sessionId,
        answers
      );

      if (response.success) {
        navigate(`/exams/${examState.exam.id}/result`, {
          state: { result: response.result, exam: examState.exam }
        });
      }
    } catch (error) {
      console.error('自動提出エラー:', error);
      alert('試験の自動提出に失敗しました');
    }
  }, [examState, answers, isSubmitting, navigate]);

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = async () => {
    if (!examState || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setShowConfirmSubmit(false);
      
      const response = await examService.submitExam(
        examState.exam.id,
        examState.sessionId,
        answers
      );

      if (response.success) {
        navigate(`/exams/${examState.exam.id}/result`, {
          state: { result: response.result, exam: examState.exam }
        });
      } else {
        alert('試験の提出に失敗しました');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('試験提出エラー:', error);
      alert('試験の提出に失敗しました');
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 進捗計算の改善
  const getProgress = (): number => {
    const answered = Object.keys(answers).length;
    return (answered / examState.exam.questions.length) * 100;
  };

  const getAnsweredQuestions = (): number => {
    return Object.keys(answers).length;
  };

  const getTimeColor = (): string => {
    const percentage = (timeRemaining / (examState.exam.timeLimit * 60)) * 100;
    if (percentage > 50) return 'time-normal';
    if (percentage > 20) return 'time-warning';
    return 'time-danger';
  };

  const getTimeStatusText = (): string => {
    const percentage = (timeRemaining / (examState.exam.timeLimit * 60)) * 100;
    if (percentage > 50) return '十分な時間があります';
    if (percentage > 20) return '時間に注意してください';
    return '時間が不足しています！';
  };

  if (!examState) {
    return null; // リダイレクト処理中
  }

  const currentQuestion = examState.exam.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === examState.exam.questions.length - 1;

  return (
    <div className="exam-taking">
      {/* ヘッダー */}
      <div className="exam-header">
        <div className="exam-header-content">
          <div className="exam-title">
            <h1>{examState.exam.title}</h1>
            <span className="question-counter">
              問題 {currentQuestionIndex + 1} / {examState.exam.questions.length}
            </span>
          </div>
          
          <div className="exam-controls">
            <div className={`timer ${getTimeColor()}`}>
              <span className="timer-icon">⏰</span>
              <span className="timer-text">{formatTime(timeRemaining)}</span>
              <span className="timer-status">{getTimeStatusText()}</span>
            </div>
            
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${getProgress()}%` }}
                ></div>
              </div>
              <span className="progress-text">
                回答済み: {getAnsweredQuestions()} / {examState.exam.questions.length}問
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 問題表示 */}
      <div className="exam-content">
        <div className="question-container">
          <div className="question-header">
            <div className="question-meta">
              <span className="question-type">
                {QUESTION_TYPE_LABELS[currentQuestion.type]}
              </span>
              <span className="question-points">
                {currentQuestion.points}点
              </span>
            </div>
          </div>

          <div className="question-content">
            <h2 className="question-text">{currentQuestion.question}</h2>
            
            <div className="answer-section">
              <QuestionInput
                question={currentQuestion}
                value={answers[currentQuestion.id]}
                onChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
              />
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="question-navigation">
          <div className="nav-buttons">
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="nav-button prev-button"
            >
              ← 前の問題
            </button>
            
            {isLastQuestion ? (
              <button
                onClick={() => setShowConfirmSubmit(true)}
                className="nav-button submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? '提出中...' : '試験を提出'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex(prev => 
                  Math.min(examState.exam.questions.length - 1, prev + 1)
                )}
                className="nav-button next-button"
              >
                次の問題 →
              </button>
            )}
          </div>
        </div>

        {/* 問題一覧 */}
        <div className="question-overview">
          <h3>問題一覧</h3>
          <div className="question-grid">
            {examState.exam.questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`question-item ${
                  index === currentQuestionIndex ? 'current' : ''
                } ${
                  answers[question.id] ? 'answered' : 'unanswered'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 提出確認モーダル */}
      {showConfirmSubmit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>試験を提出しますか？</h3>
            <p>
              回答済み: {Object.keys(answers).length} / {examState.exam.questions.length} 問題
            </p>
            <p>提出後は回答を変更できません。</p>
            <div className="modal-buttons">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="cancel-button"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                className="confirm-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? '提出中...' : '提出する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 問題タイプ別の入力コンポーネント
interface QuestionInputProps {
  question: ExamQuestion;
  value: string | string[] | undefined;
  onChange: (answer: string | string[]) => void;
}

const QuestionInput: React.FC<QuestionInputProps> = ({ question, value, onChange }) => {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <MultipleChoiceInput
          question={question}
          value={value as string | string[]}
          onChange={onChange}
        />
      );
    
    case 'yaml_generation':
    case 'kubectl_command':
      return (
        <TextInput
          question={question}
          value={value as string}
          onChange={(answer) => onChange(answer)}
        />
      );
    
    default:
      return <div>未対応の問題タイプです</div>;
  }
};

// 選択問題用コンポーネント
const MultipleChoiceInput: React.FC<QuestionInputProps> = ({ question, value, onChange }) => {
  // 複数選択かどうかは問題文に（複数選択）が含まれているかで判定
  const isMultipleAnswer = question.question.includes('（複数選択）') || question.question.includes('(複数選択)');
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  const handleOptionChange = (option: string, checked: boolean) => {
    if (isMultipleAnswer) {
      const newValues = checked
        ? [...selectedValues, option]
        : selectedValues.filter(v => v !== option);
      onChange(newValues);
    } else {
      onChange(checked ? option : '');
    }
  };

  return (
    <div className="multiple-choice-input">
      {isMultipleAnswer && (
        <p className="instruction">複数選択可能です</p>
      )}
      <div className="options-list">
        {question.options?.map((option, index) => (
          <label key={index} className="option-item">
            <input
              type={isMultipleAnswer ? 'checkbox' : 'radio'}
              name={`question-${question.id}`}
              checked={selectedValues.includes(option)}
              onChange={(e) => handleOptionChange(option, e.target.checked)}
            />
            <span className="option-text">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

// テキスト入力用コンポーネント
const TextInput: React.FC<QuestionInputProps> = ({ question, value, onChange }) => {
  return (
    <div className="text-input">
      {question.type === 'yaml_generation' && (
        <p className="instruction">YAMLコードを記述してください</p>
      )}
      {question.type === 'kubectl_command' && (
        <p className="instruction">kubectlコマンドを記述してください</p>
      )}
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          question.type === 'yaml_generation' 
            ? 'apiVersion: ...\nkind: ...\n...' 
            : 'kubectl ...'
        }
        className={`answer-textarea ${question.type}`}
        rows={question.type === 'yaml_generation' ? 15 : 3}
      />
    </div>
  );
};

export default ExamTaking;
