// deploy-example.ts
// Пример развертывания и использования Quest Contract с помощью CosmJS

import {
  SigningCosmWasmClient,
  CosmWasmClient,
} from "@cosmjs/cosmwasm-stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Uint128 } from "cosmwasm";

// ============= CONFIGURATION =============
const RPC_ENDPOINT = "https://rpc.juno.network";
const CHAIN_ID = "juno-1";
const MNEMONIC = "YOUR_MNEMONIC_HERE";

// ============= HELPER TYPES =============
interface InstantiateMsg {
  owner?: string;
  quest_creation_fee: string;
  initial_balance: string;
}

interface CreateQuestMsg {
  create_quest: {
    name: string;
    description: string;
    reward_amount: string;
  };
}

interface CompleteQuestMsg {
  complete_quest: {
    quest_id: string;
  };
}

interface TransferMsg {
  transfer: {
    recipient: string;
    amount: string;
  };
}

interface GetBalanceQuery {
  address: string;
}

interface GetActiveQuestsQuery {}

interface GetUserStatsQuery {
  address: string;
}

// ============= MAIN CLASS =============
class QuestContractManager {
  private client: SigningCosmWasmClient | null = null;
  private readOnlyClient: CosmWasmClient | null = null;
  private contractAddress: string = "";
  private signer: DirectSecp256k1HdWallet | null = null;
  private userAddress: string = "";

  /**
   * Инициализируем клиент и подключаемся к сети
   */
  async initialize(): Promise<void> {
    console.log("🔗 Подключение к Cosmos сети...");
    
    this.signer = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, {
      prefix: "juno",
    });

    const [account] = await this.signer.getAccounts();
    this.userAddress = account.address;
    console.log("✅ Адрес пользователя:", this.userAddress);

    this.client = await SigningCosmWasmClient.connectWithSigner(
      RPC_ENDPOINT,
      this.signer
    );

    this.readOnlyClient = await CosmWasmClient.connect(RPC_ENDPOINT);
    console.log("✅ Клиент инициализирован");
  }

  /**
   * Развертываем контракт (требует сохраненный код контракта)
   * @param codeId - ID сохраненного кода контракта
   * @param label - Метка для контракта
   */
  async instantiateContract(
    codeId: number,
    label: string = "Quest Contract"
  ): Promise<string> {
    if (!this.client) throw new Error("Client not initialized");

    console.log("📦 Развертывание контракта...");

    const initMsg: InstantiateMsg = {
      owner: undefined, // Будет установлен на адрес отправителя
      quest_creation_fee: "5", // 5 токенов
      initial_balance: "1000", // 1000 токенов для инициализации
    };

    const result = await this.client.instantiate(
      this.userAddress,
      codeId,
      initMsg,
      label,
      "auto"
    );

    this.contractAddress = result.contractAddress;
    console.log("✅ Контракт развернут:", this.contractAddress);
    console.log("📝 TX Hash:", result.transactionHash);

    return this.contractAddress;
  }

  /**
   * Создаем новый квест (списываются токены)
   */
  async createQuest(
    name: string,
    description: string,
    rewardAmount: number
  ): Promise<string> {
    if (!this.client) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n➕ Создание квеста: "${name}"`);

    const msg: CreateQuestMsg = {
      create_quest: {
        name,
        description,
        reward_amount: rewardAmount.toString(),
      },
    };

    const result = await this.client.execute(
      this.userAddress,
      this.contractAddress,
      msg,
      "auto"
    );

    console.log("✅ Квест создан!");
    console.log("📝 TX Hash:", result.transactionHash);
    console.log("📊 Logs:", result.logs);

    return result.transactionHash;
  }

  /**
   * Выполняем квест (получаем награду)
   */
  async completeQuest(questId: number): Promise<string> {
    if (!this.client) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n✅ Выполнение квеста ID: ${questId}`);

    const msg: CompleteQuestMsg = {
      complete_quest: {
        quest_id: questId.toString(),
      },
    };

    const result = await this.client.execute(
      this.userAddress,
      this.contractAddress,
      msg,
      "auto"
    );

    console.log("✅ Квест выполнен!");
    console.log("📝 TX Hash:", result.transactionHash);
    console.log("📊 Logs:", result.logs);

    return result.transactionHash;
  }

  /**
   * Передаем токены другому пользователю
   */
  async transferTokens(
    recipient: string,
    amount: number
  ): Promise<string> {
    if (!this.client) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(
      `\n💸 Передача ${amount} токенов адресу: ${recipient}`
    );

    const msg: TransferMsg = {
      transfer: {
        recipient,
        amount: amount.toString(),
      },
    };

    const result = await this.client.execute(
      this.userAddress,
      this.contractAddress,
      msg,
      "auto"
    );

    console.log("✅ Токены переданы!");
    console.log("📝 TX Hash:", result.transactionHash);
    console.log("📊 Logs:", result.logs);

    return result.transactionHash;
  }

  /**
   * Получаем баланс пользователя
   */
  async getBalance(address: string): Promise<any> {
    if (!this.readOnlyClient) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n💰 Получение баланса адреса: ${address}`);

    const query: GetBalanceQuery = { address };

    const result = await this.readOnlyClient.queryContractSmart(
      this.contractAddress,
      { get_balance: query }
    );

    console.log("📊 Баланс:");
    console.log(`  Адрес: ${result.address}`);
    console.log(`  Баланс: ${result.balance} токенов`);
    console.log(`  Всего заработано: ${result.total_earned} токенов`);

    return result;
  }

  /**
   * Получаем активные квесты
   */
  async getActiveQuests(): Promise<any> {
    if (!this.readOnlyClient) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n📋 Получение активных квестов`);

    const result = await this.readOnlyClient.queryContractSmart(
      this.contractAddress,
      { get_active_quests: {} }
    );

    console.log(`📊 Активных квестов: ${result.count}`);
    result.quests.forEach((quest: any, index: number) => {
      console.log(`\n  Квест ${index + 1}:`);
      console.log(`    ID: ${quest.id}`);
      console.log(`    Название: ${quest.name}`);
      console.log(`    Описание: ${quest.description}`);
      console.log(`    Награда: ${quest.reward_amount} токенов`);
      console.log(`    Выполнен: ${quest.completed ? "Да" : "Нет"}`);
      console.log(`    Создатель: ${quest.creator}`);
    });

    return result;
  }

  /**
   * Получаем статистику пользователя
   */
  async getUserStats(address: string): Promise<any> {
    if (!this.readOnlyClient) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n📈 Получение статистики пользователя: ${address}`);

    const query: GetUserStatsQuery = { address };

    const result = await this.readOnlyClient.queryContractSmart(
      this.contractAddress,
      { get_user_stats: query }
    );

    console.log("📊 Статистика:");
    console.log(`  Адрес: ${result.address}`);
    console.log(`  Текущий баланс: ${result.balance} токенов`);
    console.log(`  Всего заработано: ${result.total_earned} токенов`);
    console.log(`  Создано квестов: ${result.quests_created}`);
    console.log(`  Выполнено квестов: ${result.quests_completed}`);

    return result;
  }

  /**
   * Получаем конфиг контракта
   */
  async getConfig(): Promise<any> {
    if (!this.readOnlyClient) throw new Error("Client not initialized");
    if (!this.contractAddress) throw new Error("Contract not instantiated");

    console.log(`\n⚙️ Получение конфига контракта`);

    const result = await this.readOnlyClient.queryContractSmart(
      this.contractAddress,
      { get_config: {} }
    );

    console.log("📊 Конфиг:");
    console.log(`  Владелец: ${result.owner}`);
    console.log(`  Комиссия за создание: ${result.quest_creation_fee} токенов`);
    console.log(`  Всего квестов: ${result.total_quests}`);
    console.log(`  Выполнено квестов: ${result.total_completed}`);

    return result;
  }

  /**
   * Сохраняем адрес контракта для последующих использований
   */
  setContractAddress(address: string): void {
    this.contractAddress = address;
    console.log("✅ Адрес контракта установлен:", address);
  }

  /**
   * Получаем текущий адрес контракта
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Получаем адрес пользователя
   */
  getUserAddress(): string {
    return this.userAddress;
  }
}

// ============= EXAMPLE USAGE =============
async function main() {
  const manager = new QuestContractManager();

  try {
    // 1. Инициализируем
    await manager.initialize();

    // 2. Развертываем контракт (нужно заменить codeId на реальный)
    // await manager.instantiateContract(123); // заменить 123 на реальный CODE_ID

    // ИЛИ используем существующий контракт
    manager.setContractAddress(
      "juno1h3cy7dq3jhz9c8x2j4k4ly7wy5ja5mk89cdm4mq89l4spvhgrrfs6d8nk"
    );

    // 3. Создаем квесты
    console.log("\n" + "=".repeat(50));
    console.log("🎮 ДЕМОНСТРАЦИЯ СИСТЕМЫ КВЕСТОВ");
    console.log("=".repeat(50));

    await manager.createQuest(
      "Помощь соседу",
      "Помочь соседу с уборкой квартиры",
      100
    );

    await manager.createQuest(
      "Покупка продуктов",
      "Купить молоко и хлеб в магазине",
      50
    );

    // 4. Получаем активные квесты
    await manager.getActiveQuests();

    // 5. Получаем статистику
    await manager.getUserStats(manager.getUserAddress());

    // 6. Получаем конфиг
    await manager.getConfig();

    console.log("\n" + "=".repeat(50));
    console.log("✅ Демонстрация завершена успешно!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Ошибка:", error);
  }
}

// Запуск
main().catch(console.error);
