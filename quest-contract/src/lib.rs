#![cfg_attr(
    all(
        not(feature = "library"),
        target_arch = "wasm32",
    ),
    link_section = ".custom_section(\"name\")"
)]



#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult, Uint128,
    Order, Addr, StdError,
};
use cw_storage_plus::{Item, Map};
use serde::{Deserialize, Serialize};
use std::str::FromStr;  // ✅ ТОЛЬКО ИЗ std!


// ============= STATE STRUCTURES =============


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Config {
    pub owner: Addr,
    pub quest_creation_fee: Uint128,
    pub total_quests: u64,
    pub total_completed: u64,
}


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Quest {
    pub id: u64,
    pub creator: Addr,
    pub name: String,
    pub description: String,
    pub reward_amount: Uint128,
    pub completed: bool,
    pub completed_by: Option<Addr>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
}


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UserBalance {
    pub address: Addr,
    pub balance: Uint128,
    pub total_earned: Uint128,
    pub quests_created: u64,
    pub quests_completed: u64,
}


// ============= STORAGE =============


const CONFIG: Item<Config> = Item::new("config");
const BALANCES: Map<&Addr, UserBalance> = Map::new("balances");
const QUESTS: Map<u64, Quest> = Map::new("quests");
const USER_QUESTS: Map<&Addr, Vec<u64>> = Map::new("user_quests");


// ============= MESSAGES =============


#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub struct InstantiateMsg {
    pub owner: Option<String>,
    pub quest_creation_fee: String,
    pub initial_balance: String,
}


#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    CreateQuest {
        name: String,
        description: String,
        reward_amount: String,
    },
    CompleteQuest {
        quest_id: u64,
    },
    Transfer {
        recipient: String,
        amount: String,
    },
    AdminWithdraw {
        amount: String,
    },
}


#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetConfig {},
    GetBalance { address: String },
    GetQuest { quest_id: u64 },
    GetActiveQuests {},
    GetUserQuests { address: String },
    GetUserStats { address: String },
}


// ============= RESPONSE TYPES =============


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GetConfigResponse {
    pub owner: Addr,
    pub quest_creation_fee: Uint128,
    pub total_quests: u64,
    pub total_completed: u64,
}


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GetBalanceResponse {
    pub address: Addr,
    pub balance: Uint128,
    pub total_earned: Uint128,
}


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GetQuestResponse {
    pub quest: Quest,
}


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GetActiveQuestsResponse {
    pub quests: Vec<Quest>,
    pub count: u64,
}


#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GetUserStatsResponse {
    pub address: Addr,
    pub balance: Uint128,
    pub total_earned: Uint128,
    pub quests_created: u64,
    pub quests_completed: u64,
}


// ============= HELPER FUNCTION =============


fn get_or_create_balance(
    storage: &dyn cosmwasm_std::Storage,
    address: &Addr,
) -> StdResult<UserBalance> {
    Ok(BALANCES
        .may_load(storage, address)?
        .unwrap_or(UserBalance {
            address: address.clone(),
            balance: Uint128::zero(),
            total_earned: Uint128::zero(),
            quests_created: 0,
            quests_completed: 0,
        }))
}


// ============= ENTRY POINTS =============


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let owner = if let Some(owner_addr) = msg.owner {
        deps.api.addr_validate(&owner_addr)?
    } else {
        info.sender.clone()
    };

    let fee = Uint128::from_str(&msg.quest_creation_fee)
        .map_err(|_| StdError::generic_err("quest_creation_fee must be a valid number"))?;
    
    let balance = Uint128::from_str(&msg.initial_balance)
        .map_err(|_| StdError::generic_err("initial_balance must be a valid number"))?;

    let config = Config {
        owner: owner.clone(),
        quest_creation_fee: fee,
        total_quests: 0,
        total_completed: 0,
    };

    CONFIG.save(deps.storage, &config)?;

    let initial_balance = UserBalance {
        address: info.sender.clone(),
        balance,
        total_earned: Uint128::zero(),
        quests_created: 0,
        quests_completed: 0,
    };

    BALANCES.save(deps.storage, &info.sender, &initial_balance)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", owner)
        .add_attribute("initial_balance", msg.initial_balance))
}


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::CreateQuest {
            name,
            description,
            reward_amount,
        } => execute_create_quest(deps, env, info, name, description, reward_amount),
        ExecuteMsg::CompleteQuest { quest_id } => execute_complete_quest(deps, env, info, quest_id),
        ExecuteMsg::Transfer { recipient, amount } => {
            execute_transfer(deps, info, recipient, amount)
        }
        ExecuteMsg::AdminWithdraw { amount } => execute_admin_withdraw(deps, info, amount),
    }
}


// ============= EXECUTE HANDLERS =============


fn execute_create_quest(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    name: String,
    description: String,
    reward_amount: String,
) -> StdResult<Response> {
    let reward = Uint128::from_str(&reward_amount)
        .map_err(|_| StdError::generic_err("reward_amount must be a valid number"))?;

    let config = CONFIG.load(deps.storage)?;

    let mut user_balance = get_or_create_balance(deps.storage, &info.sender)?;

    if user_balance.balance < config.quest_creation_fee {
        return Err(StdError::generic_err(
            format!(
                "Недостаточно токенов. Требуется: {}, у вас: {}",
                config.quest_creation_fee, user_balance.balance
            )
        ));
    }

    user_balance.balance -= config.quest_creation_fee;
    user_balance.quests_created += 1;

    let mut new_config = config.clone();
    new_config.total_quests += 1;
    let quest_id = new_config.total_quests;

    let quest = Quest {
        id: quest_id,
        creator: info.sender.clone(),
        name: name.clone(),
        description,
        reward_amount: reward,
        completed: false,
        completed_by: None,
        created_at: env.block.time.seconds(),
        completed_at: None,
    };

    CONFIG.save(deps.storage, &new_config)?;
    QUESTS.save(deps.storage, quest_id, &quest)?;
    BALANCES.save(deps.storage, &info.sender, &user_balance)?;

    let mut user_quests = USER_QUESTS
        .may_load(deps.storage, &info.sender)?
        .unwrap_or_default();
    user_quests.push(quest_id);
    USER_QUESTS.save(deps.storage, &info.sender, &user_quests)?;

    Ok(Response::new()
        .add_attribute("method", "create_quest")
        .add_attribute("quest_id", quest_id.to_string())
        .add_attribute("quest_name", name)
        .add_attribute("creator", info.sender.to_string())
        .add_attribute("fee_deducted", config.quest_creation_fee.to_string())
        .add_attribute("reward", reward.to_string())
        .add_attribute("new_balance", user_balance.balance.to_string()))
}


fn execute_complete_quest(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    quest_id: u64,
) -> StdResult<Response> {
    let mut quest = QUESTS.load(deps.storage, quest_id)
        .map_err(|_| StdError::generic_err("Квест не найден"))?;

    if quest.completed {
        return Err(StdError::generic_err("Квест уже выполнен"));
    }

    if quest.creator == info.sender {
        return Err(StdError::generic_err(
            "Вы не можете выполнить свой собственный квест"
        ));
    }

    let mut completer_balance = get_or_create_balance(deps.storage, &info.sender)?;

    completer_balance.balance += quest.reward_amount;
    completer_balance.total_earned += quest.reward_amount;
    completer_balance.quests_completed += 1;

    let creator_balance = get_or_create_balance(deps.storage, &quest.creator)?;

    quest.completed = true;
    quest.completed_by = Some(info.sender.clone());
    quest.completed_at = Some(_env.block.time.seconds());

    let mut config = CONFIG.load(deps.storage)?;
    config.total_completed += 1;

    QUESTS.save(deps.storage, quest_id, &quest)?;
    BALANCES.save(deps.storage, &info.sender, &completer_balance)?;
    BALANCES.save(deps.storage, &quest.creator, &creator_balance)?;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "complete_quest")
        .add_attribute("quest_id", quest_id.to_string())
        .add_attribute("completed_by", info.sender.to_string())
        .add_attribute("reward", quest.reward_amount.to_string())
        .add_attribute("new_balance", completer_balance.balance.to_string())
        .add_attribute("total_earned", completer_balance.total_earned.to_string()))
}


fn execute_transfer(
    deps: DepsMut,
    info: MessageInfo,
    recipient: String,
    amount: String,
) -> StdResult<Response> {
    let transfer_amount = Uint128::from_str(&amount)
        .map_err(|_| StdError::generic_err("amount must be a valid number"))?;

    let recipient_addr = deps.api.addr_validate(&recipient)?;

    let mut sender_balance = get_or_create_balance(deps.storage, &info.sender)?;

    if sender_balance.balance < transfer_amount {
        return Err(StdError::generic_err(
            format!(
                "Недостаточно токенов. Требуется: {}, у вас: {}",
                transfer_amount, sender_balance.balance
            )
        ));
    }

    sender_balance.balance -= transfer_amount;
    let mut recipient_balance = get_or_create_balance(deps.storage, &recipient_addr)?;
    recipient_balance.balance += transfer_amount;

    BALANCES.save(deps.storage, &info.sender, &sender_balance)?;
    BALANCES.save(deps.storage, &recipient_addr, &recipient_balance)?;

    Ok(Response::new()
        .add_attribute("method", "transfer")
        .add_attribute("from", info.sender.to_string())
        .add_attribute("to", recipient)
        .add_attribute("amount", transfer_amount.to_string())
        .add_attribute("sender_new_balance", sender_balance.balance.to_string())
        .add_attribute("recipient_new_balance", recipient_balance.balance.to_string()))
}


fn execute_admin_withdraw(
    deps: DepsMut,
    info: MessageInfo,
    amount: String,
) -> StdResult<Response> {
    let withdraw_amount = Uint128::from_str(&amount)
        .map_err(|_| StdError::generic_err("amount must be a valid number"))?;

    let config = CONFIG.load(deps.storage)?;

    if info.sender != config.owner {
        return Err(StdError::generic_err("Только владелец может это делать"));
    }

    let mut owner_balance = get_or_create_balance(deps.storage, &config.owner)?;

    if owner_balance.balance < withdraw_amount {
        return Err(StdError::generic_err("Недостаточно средств для вывода"));
    }

    owner_balance.balance -= withdraw_amount;
    BALANCES.save(deps.storage, &config.owner, &owner_balance)?;

    Ok(Response::new()
        .add_attribute("method", "admin_withdraw")
        .add_attribute("amount", withdraw_amount.to_string())
        .add_attribute("new_balance", owner_balance.balance.to_string()))
}


// ============= QUERY HANDLERS =============


#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetConfig {} => to_json_binary(&query_config(deps)?),
        QueryMsg::GetBalance { address } => to_json_binary(&query_balance(deps, address)?),
        QueryMsg::GetQuest { quest_id } => to_json_binary(&query_quest(deps, quest_id)?),
        QueryMsg::GetActiveQuests {} => to_json_binary(&query_active_quests(deps)?),
        QueryMsg::GetUserQuests { address } => to_json_binary(&query_user_quests(deps, address)?),
        QueryMsg::GetUserStats { address } => to_json_binary(&query_user_stats(deps, address)?),
    }
}


fn query_config(deps: Deps) -> StdResult<GetConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(GetConfigResponse {
        owner: config.owner,
        quest_creation_fee: config.quest_creation_fee,
        total_quests: config.total_quests,
        total_completed: config.total_completed,
    })
}


fn query_balance(deps: Deps, address: String) -> StdResult<GetBalanceResponse> {
    let addr = deps.api.addr_validate(&address)?;
    let balance = get_or_create_balance(deps.storage, &addr)?;

    Ok(GetBalanceResponse {
        address: addr,
        balance: balance.balance,
        total_earned: balance.total_earned,
    })
}


fn query_quest(deps: Deps, quest_id: u64) -> StdResult<GetQuestResponse> {
    let quest = QUESTS.load(deps.storage, quest_id)
        .map_err(|_| StdError::generic_err("Квест не найден"))?;
    Ok(GetQuestResponse { quest })
}


fn query_active_quests(deps: Deps) -> StdResult<GetActiveQuestsResponse> {
    let quests: Vec<Quest> = QUESTS
        .range(deps.storage, None, None, Order::Ascending)
        .filter_map(|r| {
            if let Ok((_, quest)) = r {
                if !quest.completed {
                    return Some(quest);
                }
            }
            None
        })
        .collect();

    let count = quests.len() as u64;
    Ok(GetActiveQuestsResponse { quests, count })
}


fn query_user_quests(deps: Deps, address: String) -> StdResult<Vec<Quest>> {
    let addr = deps.api.addr_validate(&address)?;
    let quest_ids = USER_QUESTS
        .may_load(deps.storage, &addr)?
        .unwrap_or_default();

    let mut quests = Vec::new();
    for id in quest_ids {
        if let Ok(quest) = QUESTS.load(deps.storage, id) {
            quests.push(quest);
        }
    }
    Ok(quests)
}


fn query_user_stats(deps: Deps, address: String) -> StdResult<GetUserStatsResponse> {
    let addr = deps.api.addr_validate(&address)?;
    let balance = get_or_create_balance(deps.storage, &addr)?;

    Ok(GetUserStatsResponse {
        address: addr,
        balance: balance.balance,
        total_earned: balance.total_earned,
        quests_created: balance.quests_created,
        quests_completed: balance.quests_completed,
    })
}


#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{Addr, Uint128};
    use cw_multi_test::{App, ContractWrapper, Executor};

    fn setup_contract_for_user(user: &str) -> (App, Addr, Addr) {
        let mut app = App::default();
        let code = ContractWrapper::new(execute, instantiate, query);
        let code_id = app.store_code(Box::new(code));

        let user_addr = Addr::unchecked(user);

        let msg = InstantiateMsg {
            owner: None,
            quest_creation_fee: "5".to_string(),
            initial_balance: "1000".to_string(),
        };

        let contract_addr = app
            .instantiate_contract(code_id, user_addr.clone(), &msg, &[], "quest-contract", None)
            .unwrap();

        (app, contract_addr, user_addr)
    }

    #[test]
    fn test_instantiate() {
        let (_, _, _) = setup_contract_for_user("creator");
    }

    #[test]
    fn test_create_quest() {
        let (mut app, contract_addr, user) = setup_contract_for_user("creator");

        let msg = ExecuteMsg::CreateQuest {
            name: "Test Quest".to_string(),
            description: "A test quest".to_string(),
            reward_amount: "100".to_string(),
        };

        let result = app.execute_contract(user.clone(), contract_addr.clone(), &msg, &[]);
        assert!(result.is_ok(), "Failed to create quest");

        let balance_query = QueryMsg::GetBalance {
            address: user.to_string(),
        };
        let balance: GetBalanceResponse =
            app.wrap().query_wasm_smart(&contract_addr, &balance_query).unwrap();

        assert_eq!(
            balance.balance, Uint128::new(995),
            "Balance should be 995 after quest creation"
        );
    }
}