import React, { useState, useEffect } from 'react';
import './App.css';
import QuestCard from './components/QuestCard';
import Sidebar from './components/Sidebar';
import QuestModal from './components/QuestModal';
import CreateQuestModal from './components/CreateQuestModal';
import { useWallet } from '@cosmos-kit/react';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { CONTRACT_ADDRESS } from './config/chains';

function App() {
  const { address, isConnected, getCosmWasmClient } = useWallet();
  
  const [quests, setQuests] = useState([]);
  const [cosmwasmClient, setCosmwasmClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    level: 1,
    xp: 0,
    totalCompleted: 0,
    username: 'Developer',
    totalRewards: 0,
    address: ''
  });

  const [selectedQuest, setSelectedQuest] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuestModal, setShowQuestModal] = useState(false);
  const [error, setError] = useState('');

  // Загрузка квестов из блокчейна
  const loadQuests = async (client) => {
    try {
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "cosmos1...") {
        setError("⚠️ Замени CONTRACT_ADDRESS на адрес своего контракта!");
        return;
      }
      
      const result = await client.queryContractSmart(CONTRACT_ADDRESS, {
        list_quests: { start_after: null, limit: 10 }
      });
      setQuests(result || []);
      setError('');
    } catch (err) {
      console.error("Error loading quests:", err);
      setQuests([]);
    }
  };

  // Загрузка статистики игрока
  const loadPlayerStats = async (client, addr) => {
    try {
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "cosmos1...") return;
      
      const result = await client.queryContractSmart(CONTRACT_ADDRESS, {
        get_player_stats: { address: addr }
      });
      setUserStats({
        ...userStats,
        ...result,
        address: addr
      });
    } catch (err) {
      // Новый игрок
      setUserStats({
        level: 1,
        xp: 0,
        totalCompleted: 0,
        username: 'Developer',
        totalRewards: 0,
        address: addr
      });
    }
  };

  // Инициализация при подключении кошелька
  useEffect(() => {
    if (isConnected && address) {
      getCosmWasmClient().then(async (client) => {
        setCosmwasmClient(client);
        
        // Загружаем данные из блокчейна
        await loadQuests(client);
        await loadPlayerStats(client, address);
        setLoading(false);
      }).catch(err => {
        console.error("Failed to get client:", err);
        setError("Ошибка подключения. Проверь Keplr!");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [isConnected, address]);

  // СОЗДАНИЕ КВЕСТА
  const handleCreateQuest = async (newQuest) => {
    if (!cosmwasmClient || !address) {
      setError("Подключи кошелек!");
      return;
    }

    try {
      setLoading(true);
      const rewardAmount = (newQuest.reward * 1000000).toString(); // в uatom
      const totalAmount = (newQuest.reward * 1.25 * 1000000).toString(); // +20% комиссия

      const msg = {
        create_quest: {
          title: newQuest.title,
          description: newQuest.description,
          category: newQuest.category,
          difficulty: newQuest.difficulty,
          reward_amount: rewardAmount,
          correct_answer: newQuest.answer
        }
      };

      const result = await cosmwasmClient.execute(
        address,
        CONTRACT_ADDRESS,
        msg,
        "auto",
        `Create ${newQuest.title}`,
        [{ denom: "uatom", amount: totalAmount }]
      );

      console.log("Quest created:", result.transactionHash);
      setError('');
      
      // Перезагружаем квесты
      await loadQuests(cosmwasmClient);
      setShowCreateModal(false);
    } catch (err) {
      console.error("Create quest failed:", err);
      setError(`❌ Ошибка: ${err.message || 'Проверь баланс uatom'}`);
    } finally {
      setLoading(false);
    }
  };

  // ЗАВЕРШЕНИЕ КВЕСТА
  const handleCompleteQuest = async (questId, userAnswer) => {
    if (!cosmwasmClient || !address) {
      setError("Подключи кошелек!");
      return;
    }

    try {
      setLoading(true);
      const msg = {
        complete_quest: {
          quest_id: questId,
          user_answer: userAnswer
        }
      };

      const result = await cosmwasmClient.execute(
        address,
        CONTRACT_ADDRESS,
        msg,
        "auto",
        "Complete quest",
        []
      );

      console.log("Quest completed:", result.transactionHash);
      setError('');
      
      // Перезагружаем данные
      await loadPlayerStats(cosmwasmClient, address);
      await loadQuests(cosmwasmClient);
      setShowQuestModal(false);
    } catch (err) {
      console.error("Complete quest failed:", err);
      setError(`❌ Неправильный ответ или квест уже выполнен`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuest = (quest) => {
    setSelectedQuest(quest);
    setShowQuestModal(true);
  };

  return (
    <div className="app">
      <div className="app-container">
        <Sidebar stats={userStats} address={address} />
        
        <div className="main-content">
          <header className="app-header">
            <div className="header-content">
              <h1>⚡ QuestHub on Cosmos Hub</h1>
              
              <div className="wallet-section">
                {isConnected ? (
                  <div className="wallet-info">
                    <span className="chain-badge">🌌 cosmoshub-4</span>
                    <span className="address-badge">
                      {address ? `${address.slice(0, 10)}...${address.slice(-6)}` : 'Connecting...'}
                    </span>
                  </div>
                ) : (
                  <span className="not-connected">⚠️ Подключи Keplr кошелек</span>
                )}
              </div>

              <button 
                className="btn-create-quest"
                onClick={() => setShowCreateModal(true)}
                disabled={!isConnected || loading}
              >
                {loading ? '⏳ Загрузка...' : '+ Создать квест'}
              </button>
            </div>
          </header>

          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')} style={{marginLeft: '10px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer'}}>✕</button>
            </div>
          )}

          <div className="quests-grid">
            {loading ? (
              <p style={{gridColumn: '1/-1', textAlign: 'center', padding: '40px'}}>
                ⏳ Загрузка квестов из блокчейна...
              </p>
            ) : quests.length === 0 ? (
              <p style={{gridColumn: '1/-1', textAlign: 'center', padding: '40px'}}>
                🚀 Нет квестов. Создай первый!
              </p>
            ) : (
              quests.map((quest) => (
                <QuestCard 
                  key={quest.id}
                  quest={quest}
                  onOpen={() => handleOpenQuest(quest)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {showQuestModal && selectedQuest && (
        <QuestModal 
          quest={selectedQuest}
          onClose={() => setShowQuestModal(false)}
          onComplete={(userAnswer) => 
            handleCompleteQuest(selectedQuest.id, userAnswer)
          }
          isLoading={loading}
        />
      )}

      {showCreateModal && (
        <CreateQuestModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateQuest}
          isLoading={loading}
        />
      )}
    </div>
  );
}

export default App;
