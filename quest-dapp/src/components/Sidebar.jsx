import React from 'react';

const Sidebar = ({ stats }) => {
  const xpToNextLevel = (stats.level * 500) - stats.xp;
  const progressPercent = (stats.xp % 500) / 5;

  return (
    <aside className="sidebar">
      <div className="user-profile">
        <div className="avatar">
          {stats.username.charAt(0).toUpperCase()}
        </div>
        <h2 className="username">{stats.username}</h2>
      </div>

      <div className="stats-section">
        <div className="stat-item">
          <span className="stat-label">Уровень</span>
          <span className="stat-value level">{stats.level}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">XP</span>
          <div className="xp-bar">
            <div className="xp-progress" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="stat-small">{stats.xp % 500}/500</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Выполнено квестов</span>
          <span className="stat-value">{stats.totalCompleted}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Награды</span>
          <span className="stat-value rewards">{stats.totalRewards} XP</span>
        </div>
      </div>

      <div className="achievements">
        <h3>Достижения</h3>
        <div className="achievement-list">
          <div className="achievement-badge" title="Первый квест">🎖️</div>
          <div className="achievement-badge" title="5 уровень">🏅</div>
          <div className="achievement-badge" title="100 XP">⭐</div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
