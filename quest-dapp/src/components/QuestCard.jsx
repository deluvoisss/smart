import React from 'react';

const QuestCard = ({ quest, onOpen }) => {
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'task': return '✓';
      case 'puzzle': return '🧩';
      case 'riddle': return '🎭';
      default: return '⭐';
    }
  };

  const getDifficultyStars = (difficulty) => {
    return '⭐'.repeat(difficulty);
  };

  return (
    <div className={`quest-card ${quest.completed ? 'completed' : ''}`}>
      <div className="quest-header">
        <span className="quest-icon">{getCategoryIcon(quest.category)}</span>
        <span className="quest-difficulty">{getDifficultyStars(quest.difficulty)}</span>
      </div>

      <h3 className="quest-title">{quest.title}</h3>
      <p className="quest-description">{quest.description}</p>

      <div className="quest-footer">
        <div className="quest-reward">
          <span className="reward-icon">💰</span>
          <span className="reward-amount">{quest.reward} XP</span>
        </div>
        <button 
          className={`btn-quest ${quest.completed ? 'disabled' : ''}`}
          onClick={onOpen}
          disabled={quest.completed}
        >
          {quest.completed ? '✓ Выполнено' : 'Начать'}
        </button>
      </div>

      {quest.completed && <div className="quest-badge">COMPLETED</div>}
    </div>
  );
};

export default QuestCard;
