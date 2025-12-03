import React, { useState } from 'react';

const CreateQuestModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'task',
    difficulty: 1,
    reward: 100,
    answer: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'difficulty' || name === 'reward' ? parseInt(value) : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title && formData.description && formData.answer) {
      onCreate(formData);
      setFormData({
        title: '',
        description: '',
        category: 'task',
        difficulty: 1,
        reward: 100,
        answer: ''
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-create" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>Создать новый квест</h2>

        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-group">
            <label>Название квеста</label>
            <input 
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Введи название..."
              required
            />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea 
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Описание задачи..."
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Тип квеста</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="task">Решить задачу</option>
                <option value="puzzle">Собрать пазл</option>
                <option value="riddle">Отгадать загадку</option>
              </select>
            </div>

            <div className="form-group">
              <label>Сложность</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Награда (XP)</label>
            <input 
              type="number"
              name="reward"
              value={formData.reward}
              onChange={handleChange}
              min="10"
              step="10"
            />
          </div>

          <div className="form-group">
            <label>Правильный ответ</label>
            <textarea 
              name="answer"
              value={formData.answer}
              onChange={handleChange}
              placeholder="Ответ для проверки..."
              required
            />
          </div>

          <div className="modal-buttons">
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn-primary">Создать квест</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuestModal;
