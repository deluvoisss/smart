// tests/integration_tests.rs
#[cfg(test)]
mod tests {
    use cosmwasm_std::{Addr, Uint128};
    use cw_multi_test::{App, ContractWrapper, Executor};

    // Импортируем функции из контракта
    use quest_contract::{execute, instantiate, query};

    // Вспомогательная функция для создания контракта в тестовой среде
    fn setup_contract() -> (App, Addr) {
        let mut app = App::default();
        let code = ContractWrapper::new(execute, instantiate, query);
        let code_id = app.store_code(Box::new(code));

        let msg = quest_contract::InstantiateMsg {
            owner: None,
            quest_creation_fee: Uint128::new(5),
            initial_balance: Uint128::new(1000),
        };

        let contract_addr = app
            .instantiate_contract(code_id, Addr::unchecked("admin"), &msg, &[], "quest-contract", None)
            .unwrap();

        (app, contract_addr)
    }

    #[test]
    fn test_create_quest() {
        let (mut app, contract_addr) = setup_contract();
        let user = Addr::unchecked("user1");

        let msg = quest_contract::ExecuteMsg::CreateQuest {
            name: "Test Quest".to_string(),
            description: "A test quest".to_string(),
            reward_amount: Uint128::new(100),
        };

        let result = app.execute_contract(user.clone(), contract_addr.clone(), &msg, &[]);
        assert!(result.is_ok(), "Failed to create quest");

        // Проверяем, что токены списались
        let balance_query = quest_contract::QueryMsg::GetBalance {
            address: user.to_string(),
        };
        let balance: quest_contract::GetBalanceResponse =
            app.wrap().query_wasm_smart(&contract_addr, &balance_query).unwrap();
        
        assert_eq!(balance.balance, Uint128::new(995)); // 1000 - 5 (комиссия)
    }

    #[test]
    fn test_complete_quest() {
        let (mut app, contract_addr) = setup_contract();
        let creator = Addr::unchecked("creator");
        let completer = Addr::unchecked("completer");

        // Создаем квест
        let create_msg = quest_contract::ExecuteMsg::CreateQuest {
            name: "Test Quest".to_string(),
            description: "A test quest".to_string(),
            reward_amount: Uint128::new(100),
        };

        app.execute_contract(creator.clone(), contract_addr.clone(), &create_msg, &[])
            .unwrap();

        // Выполняем квест
        let complete_msg = quest_contract::ExecuteMsg::CompleteQuest { quest_id: 1 };
        app.execute_contract(completer.clone(), contract_addr.clone(), &complete_msg, &[])
            .unwrap();

        // Проверяем баланс выполнившего
        let balance_query = quest_contract::QueryMsg::GetBalance {
            address: completer.to_string(),
        };
        let balance: quest_contract::GetBalanceResponse =
            app.wrap().query_wasm_smart(&contract_addr, &balance_query).unwrap();
        
        assert_eq!(balance.balance, Uint128::new(1100)); // 1000 + 100 (награда)
    }

    #[test]
    fn test_cannot_complete_own_quest() {
        let (mut app, contract_addr) = setup_contract();
        let creator = Addr::unchecked("creator");

        // Создаем квест
        let create_msg = quest_contract::ExecuteMsg::CreateQuest {
            name: "Test Quest".to_string(),
            description: "A test quest".to_string(),
            reward_amount: Uint128::new(100),
        };

        app.execute_contract(creator.clone(), contract_addr.clone(), &create_msg, &[])
            .unwrap();

        // Пытаемся выполнить свой же квест (должно ошибиться)
        let complete_msg = quest_contract::ExecuteMsg::CompleteQuest { quest_id: 1 };
        let result = app.execute_contract(creator.clone(), contract_addr.clone(), &complete_msg, &[]);
        
        assert!(result.is_err(), "Should not allow completing own quest");
    }

    #[test]
    fn test_transfer() {
        let (mut app, contract_addr) = setup_contract();
        let sender = Addr::unchecked("sender");
        let recipient = Addr::unchecked("recipient");

        // Отправляем токены
        let transfer_msg = quest_contract::ExecuteMsg::Transfer {
            recipient: recipient.to_string(),
            amount: Uint128::new(200),
        };

        app.execute_contract(sender.clone(), contract_addr.clone(), &transfer_msg, &[])
            .unwrap();

        // Проверяем баланс отправителя
        let sender_balance_query = quest_contract::QueryMsg::GetBalance {
            address: sender.to_string(),
        };
        let sender_balance: quest_contract::GetBalanceResponse =
            app.wrap().query_wasm_smart(&contract_addr, &sender_balance_query).unwrap();
        
        assert_eq!(sender_balance.balance, Uint128::new(800)); // 1000 - 200

        // Проверяем баланс получателя
        let recipient_balance_query = quest_contract::QueryMsg::GetBalance {
            address: recipient.to_string(),
        };
        let recipient_balance: quest_contract::GetBalanceResponse =
            app.wrap().query_wasm_smart(&contract_addr, &recipient_balance_query).unwrap();
        
        assert_eq!(recipient_balance.balance, Uint128::new(1200)); // 1000 + 200
    }

    #[test]
    fn test_insufficient_balance() {
        let (mut app, contract_addr) = setup_contract();
        let user = Addr::unchecked("user");

        // Пытаемся создать квест при 0 балансе
        let transfer_msg = quest_contract::ExecuteMsg::Transfer {
            recipient: Addr::unchecked("other").to_string(),
            amount: Uint128::new(1500), // Больше, чем есть
        };

        let result = app.execute_contract(user, contract_addr, &transfer_msg, &[]);
        assert!(result.is_err(), "Should fail with insufficient balance");
    }

    #[test]
    fn test_get_active_quests() {
        let (mut app, contract_addr) = setup_contract();
        let creator = Addr::unchecked("creator");

        // Создаем несколько квестов
        for i in 1..=3 {
            let create_msg = quest_contract::ExecuteMsg::CreateQuest {
                name: format!("Quest {}", i),
                description: "A test quest".to_string(),
                reward_amount: Uint128::new(100),
            };
            app.execute_contract(creator.clone(), contract_addr.clone(), &create_msg, &[])
                .unwrap();
        }

        // Получаем активные квесты
        let query_msg = quest_contract::QueryMsg::GetActiveQuests {};
        let quests: quest_contract::GetActiveQuestsResponse =
            app.wrap().query_wasm_smart(&contract_addr, &query_msg).unwrap();
        
        assert_eq!(quests.count, 3);
        assert_eq!(quests.quests.len(), 3);
    }

    #[test]
    fn test_user_stats() {
        let (mut app, contract_addr) = setup_contract();
        let user = Addr::unchecked("user");
        let other = Addr::unchecked("other");

        // Создаем 2 квеста
        for i in 1..=2 {
            let create_msg = quest_contract::ExecuteMsg::CreateQuest {
                name: format!("Quest {}", i),
                description: "A test quest".to_string(),
                reward_amount: Uint128::new(100),
            };
            app.execute_contract(user.clone(), contract_addr.clone(), &create_msg, &[])
                .unwrap();
        }

        // Выполняем 1 квест
        let complete_msg = quest_contract::ExecuteMsg::CompleteQuest { quest_id: 1 };
        app.execute_contract(other.clone(), contract_addr.clone(), &complete_msg, &[])
            .unwrap();

        // Получаем статистику
        let stats_query = quest_contract::QueryMsg::GetUserStats {
            address: user.to_string(),
        };
        let stats: quest_contract::GetUserStatsResponse =
            app.wrap().query_wasm_smart(&contract_addr, &stats_query).unwrap();
        
        assert_eq!(stats.quests_created, 2);
        assert_eq!(stats.balance, Uint128::new(990)); // 1000 - 5*2 (две комиссии)
    }
}
