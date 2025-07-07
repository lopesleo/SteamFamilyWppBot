import {
  ISteamService,
  SteamProfile,
  Game,
  SteamGameDetails,
  StoreApiResponse,
} from "../interfaces/ISteamService";
import { DatabaseService } from "./DatabaseService";

interface GameDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      header_image: string;
      capsule_image: string;
    };
  };
}

export class SteamService implements ISteamService {
  private readonly baseUrl = "http://api.steampowered.com";
  private readonly storeUrl = "https://store.steampowered.com/api";

  constructor(
    private apiKey: string,
    private dbService: DatabaseService
  ) {}

  private async callApi<T>(
    interfaceName: string,
    method: string,
    query: string,
    version: string = "1"
  ): Promise<T> {
    const url = `${this.baseUrl}/${interfaceName}/${method}/v${version}/?key=${this.apiKey}&${query}`;
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Steam API error: ${res.status} ${res.statusText}`);
    const json = await res.json();
    return json.response as T;
  }

  async getProfile(steamId: string): Promise<SteamProfile | null> {
    const data = await this.callApi<{ players: any[] }>(
      "ISteamUser",
      "GetPlayerSummaries",
      `steamids=${steamId}`,
      "2"
    );
    if (!data.players || data.players.length === 0) return null;

    const p = data.players[0];
    const profile: SteamProfile = {
      steamId: p.steamid,
      personaName: p.personaname,
      realName: p.realname,
      avatarSmall: p.avatar,
      avatarMedium: p.avatarmedium,
      avatarFull: p.avatarfull,
      profileUrl: p.profileurl,
      countryCode: p.loccountrycode,
      stateCode: p.locstatecode,
      timeCreated: p.timecreated,
      lastLogOff: p.lastlogoff,
      personaState: p.personastate,
    };

    await this.dbService.upsertUser(profile);
    return profile;
  }

  async getOwnedGames(steamId: string): Promise<Game[]> {
    const data = await this.callApi<{ games: any[] }>(
      "IPlayerService",
      "GetOwnedGames",
      `steamid=${steamId}&include_appinfo=true`,
      "1"
    );
    const games: Game[] = (data.games || []).map((g: any) => ({
      appId: g.appid,
      name: g.name,
      playtimeHours: Math.round((g.playtime_forever || 0) / 60),
      imgIconUrl: g.img_icon_url
        ? `http://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
        : undefined,
      imgLogoUrl: g.img_logo_url
        ? `http://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_logo_url}.jpg`
        : undefined,
    }));

    if (games.length > 0) {
      await this.dbService.updateUserGames(steamId, games);
    }

    return games;
  }

  async getRecentGames(steamId: string): Promise<Game[]> {
    const data = await this.callApi<{ games: any[] }>(
      "IPlayerService",
      "GetRecentlyPlayedGames",
      `steamid=${steamId}`,
      "1"
    );
    return (data.games || []).map((g: any) => ({
      appId: g.appid,
      name: g.name,
      playtimeHours: Math.round((g.playtime_2weeks || 0) / 60),
      imgIconUrl: g.img_icon_url
        ? `http://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
        : undefined,
      imgLogoUrl: g.img_logo_url
        ? `http://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_logo_url}.jpg`
        : undefined,
    }));
  }

  async resolveVanityURL(vanityUrl: string): Promise<string | null> {
    try {
      const data = await this.callApi<{ steamid?: string; success: number }>(
        "ISteamUser",
        "ResolveVanityURL",
        `vanityurl=${vanityUrl}`,
        "1"
      );
      if (data.success === 1 && data.steamid) {
        return data.steamid;
      }
      return null;
    } catch (error) {
      console.error("Erro ao resolver Vanity URL:", error);
      return null;
    }
  }

  async getGameInfo(appId: number): Promise<SteamGameDetails | null> {
    const url = `${this.storeUrl}/appdetails?appids=${appId}&cc=br&l=brazilian`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const json: StoreApiResponse = await res.json();
      const gameDetails = json[appId];

      if (gameDetails && gameDetails.success && gameDetails.data) {
        const details = gameDetails.data;

        // Garante que o jogo base exista na tabela 'games' primeiro
        await this.dbService.upsertGame({
          appId: details.steam_appid,
          name: details.name,
          imgLogoUrl: details.header_image,
          playtimeHours: 0,
        });

        // Salva os detalhes completos na nova tabela
        await this.dbService.upsertGameDetails(appId, details);

        return details;
      }
      return null;
    } catch (error) {
      console.error(`Erro ao buscar informações do jogo ${appId}:`, error);
      return null;
    }
  }
}
