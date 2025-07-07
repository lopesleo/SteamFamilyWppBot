import "dotenv/config";
import { DatabaseService } from "../services/DatabaseService";
import { SteamService } from "../services/SteamService";

/**
 * Função auxiliar para introduzir um atraso, evitando sobrecarregar a API da Steam.
 * @param ms - O tempo de espera em milissegundos.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Este script busca todos os usuários do banco de dados, sincroniza os jogos que eles possuem
 * e, em seguida, busca e armazena os detalhes completos de cada jogo único.
 */
async function syncAllFamilyData() {
  console.log(
    "--- 🚀 Iniciando sincronização completa de dados da família ---"
  );

  if (!process.env.STEAM_APIKEY) {
    console.error("❌ Chave da API da Steam não encontrada no arquivo .env!");
    process.exit(1);
  }

  const dbService = new DatabaseService();
  const steamService = new SteamService(process.env.STEAM_APIKEY, dbService);

  try {
    // 1. Busca todos os membros da família do nosso banco de dados
    const familyMembers = await dbService.getAllUsers();

    if (familyMembers.length === 0) {
      console.log("Nenhum membro da família encontrado no banco. Encerrando.");
      return;
    }

    console.log(
      `Encontrados ${familyMembers.length} membros. Iniciando sincronização de jogos...`
    );

    // Usamos um Set para armazenar todos os AppIDs únicos da família, evitando chamadas duplicadas.
    const allUniqueAppIds = new Set<number>();

    // 2. Para cada membro, busca a lista de jogos que ele possui
    for (const member of familyMembers) {
      console.log(`\n- Sincronizando jogos de: ${member.personaName}`);
      // O método getOwnedGames já busca na API e salva a relação user-game no banco.
      const ownedGames = await steamService.getOwnedGames(member.steamId);

      ownedGames.forEach((game) => allUniqueAppIds.add(game.appId));

      console.log(
        `- ${ownedGames.length} jogos de ${member.personaName} foram processados.`
      );
    }

    console.log(
      `\n--- 🔎 Total de ${allUniqueAppIds.size} jogos únicos encontrados na família. ---`
    );
    console.log(
      "--- 📝 Iniciando sincronização dos detalhes de cada jogo... ---"
    );

    // 3. Agora, busca os detalhes para cada jogo único encontrado
    let count = 0;
    for (const appId of allUniqueAppIds) {
      count++;
      console.log(
        `- Buscando detalhes do jogo ${count} de ${allUniqueAppIds.size} (AppID: ${appId})`
      );

      // O método getGameInfo busca os detalhes e salva na tabela 'game_details'
      await steamService.getGameInfo(appId);

      // IMPORTANTE: Adiciona um atraso para respeitar os limites da API da Steam (aprox. 200 reqs / 5 min)
      //   await delay(1500); // Atraso de 1.5 segundos
    }

    console.log(
      "\n--- ✅ Sincronização completa (jogos e detalhes) concluída com sucesso! ---"
    );
  } catch (error) {
    console.error("❌ Erro fatal durante a sincronização:", error);
    process.exit(1);
  } finally {
    // Encerra o processo para garantir que o script não fique pendurado
    console.log("Finalizando o processo de sincronização.");
    process.exit(0);
  }
}

// Inicia o processo
syncAllFamilyData();
