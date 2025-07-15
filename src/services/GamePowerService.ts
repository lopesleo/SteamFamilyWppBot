// src/services/GamerPowerService.ts

import { IGamerPowerService, Giveaway } from "../interfaces/IGamerPowerService";

export class GamerPowerService implements IGamerPowerService {
  private readonly baseUrl = "https://www.gamerpower.com/api";

  async getGiveaways(
    filters: { platform?: string; type?: string; "sort-by"?: string } = {}
  ): Promise<Giveaway[]> {
    const params = new URLSearchParams();
    if (filters.platform) params.append("platform", filters.platform);
    if (filters.type) params.append("type", filters.type);
    if (filters["sort-by"]) params.append("sort-by", filters["sort-by"]);

    const url = `${this.baseUrl}/filter?${params.toString()}`;

    console.log(`Buscando giveaways com URL: ${url}`);
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });
      if (!response.ok) {
        console.error(`Erro ao buscar giveaways: ${response.statusText}`);
        return [];
      }
      const data: Giveaway[] | { status: 0; status_message: string } =
        await response.json();

      if (!Array.isArray(data)) {
        console.error("A API da GamerPower não retornou uma lista válida.");
        return [];
      }

      return data;
    } catch (error) {
      console.error("Falha na comunicação com a API da GamerPower:", error);
      return [];
    }
  }
}
