import React, { useState } from 'react';

const QuestModal = ({ quest, onClose, onComplete }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const validateAnswer = () => {
    setIsChecking(true);
    
    // Простая проверка ответа (можно улучшить)
    const isCorrect = userAnswer.toLowerCase().trim() === quest.answer.toLowerCase().trim();
    
    setTimeout(() => {
      if (isCorrect) {
        setFeedback('✓ Правильно!');
        setTimeout(() => onComplete(true), 1500);
      } else {
        setFeedback('✗ Неправильно. Попробуй еще раз!');
        setIsChecking(false);
      }
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isChecking) {
      validateAnswer();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>{quest.title}</h2>
        <p className="modal-description">{quest.description}</p>

        <div className="modal-input-section">
          <label>Твой ответ:</label>
          <textarea 
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введи ответ здесь..."
            disabled={isChecking}
          />
        </div>

        {feedback && (
          <div className={`feedback ${feedback.includes('✓') ? 'success' : 'error'}`}>
            {feedback}
          </div>
        )}

        <div className="modal-buttons">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button 
            className="btn-primary" 
            onClick={validateAnswer}
            disabled={!userAnswer.trim() || isChecking}
          >
            {isChecking ? 'Проверка...' : 'Проверить ответ'}
          </button>
        </div>

        <div className="reward-info">
          За правильный ответ ты получишь <strong>{quest.reward} XP</strong>
        </div>
      </div>
    </div>
  );
};

export default QuestModal;
