import "dotenv/config";
import { DatabaseService } from "../services/DatabaseService";

const API_URL = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";

interface SteamApp {
  appid: number;
  name: string;
}

/**
 * Busca a lista completa de todos os aplicativos da Steam e os insere
 * no banco de dados. Este é um processo longo e deve ser executado esporadicamente.
 */
async function syncAllSteamGames() {
  console.log(
    "--- 🚀 Iniciando a busca da lista completa de jogos da Steam... ---"
  );
  console.log("Isso pode levar alguns minutos.");

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(
        `Falha ao buscar a lista de jogos: ${response.statusText}`
      );
    }

    const data = await response.json();
    const allApps: SteamApp[] = data.applist.apps;

    console.log(
      `✅ ${allApps.length} aplicativos encontrados. Iniciando inserção no banco de dados...`
    );

    const dbService = new DatabaseService();

    // Processa a lista em lotes para não sobrecarregar a memória
    const batchSize = 1000;
    for (let i = 0; i < allApps.length; i += batchSize) {
      const batch = allApps.slice(i, i + batchSize);
      console.log(
        `Processando lote ${i / batchSize + 1} de ${Math.ceil(allApps.length / batchSize)}...`
      );
      await dbService.batchUpsertGames(batch);
    }

    console.log(
      "\n--- ✅ Sincronização do catálogo geral de jogos concluída com sucesso! ---"
    );
  } catch (error) {
    console.error(
      "❌ Erro fatal durante a sincronização do catálogo geral:",
      error
    );
    process.exit(1);
  } finally {
    console.log("Finalizando o processo.");
    process.exit(0);
  }
}

syncAllSteamGames();
