import { Pool } from "pg";
import {
  Game,
  SteamGameDetails,
  SteamProfile,
  Vaquinha,
} from "../interfaces/ISteamService";
import "dotenv/config";

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
    });

    this.pool.on("error", (err: any, client: any) => {
      console.error(
        "Erro inesperado no cliente do pool de banco de dados",
        err
      );
      process.exit(-1);
    });
  }

  public async getUserByNickname(
    nickname: string
  ): Promise<SteamProfile | null> {
    const query = "SELECT * FROM users WHERE LOWER(persona_name) = LOWER($1)";
    const res = await this.pool.query(query, [nickname]);

    if (res.rows.length === 0) {
      return null;
    }
    return this.mapRowToSteamProfile(res.rows[0]);
  }

  public async upsertUser(
    profile: Partial<SteamProfile> & { steamId: string }
  ): Promise<void> {
    const query = `
      INSERT INTO users (steam_id, whatsapp_id, persona_name, real_name, avatar_small, avatar_medium, avatar_full, profile_url, last_log_off, persona_state, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(steam_id) DO UPDATE SET
        whatsapp_id = COALESCE(EXCLUDED.whatsapp_id, users.whatsapp_id),
        persona_name = EXCLUDED.persona_name,
        real_name = EXCLUDED.real_name,
        avatar_small = EXCLUDED.avatar_small,
        avatar_medium = EXCLUDED.avatar_medium,
        avatar_full = EXCLUDED.avatar_full,
        profile_url = EXCLUDED.profile_url,
        last_log_off = EXCLUDED.last_log_off,
        persona_state = EXCLUDED.persona_state,
        updated_at = EXCLUDED.updated_at;
    `;
    const values = [
      profile.steamId,
      profile.whatsappId,
      profile.personaName,
      profile.realName,
      profile.avatarSmall,
      profile.avatarMedium,
      profile.avatarFull,
      profile.profileUrl,
      profile.lastLogOff,
      profile.personaState,
      Date.now(),
    ];
    await this.pool.query(query, values);
  }

  public async getUserByWhatsappId(
    whatsappId: string
  ): Promise<SteamProfile | null> {
    const query = "SELECT * FROM users WHERE whatsapp_id = $1";
    const res = await this.pool.query(query, [whatsappId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToSteamProfile(res.rows[0]);
  }

  public async updateUserGames(steamId: string, games: Game[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const game of games) {
        const gameQuery = `
          INSERT INTO games (app_id, name, img_logo_url, updated_at) VALUES ($1, $2, $3, $4)
          ON CONFLICT (app_id) DO NOTHING;
        `;
        await client.query(gameQuery, [
          game.appId,
          game.name,
          game.imgLogoUrl,
          Date.now(),
        ]);

        const userGameQuery = `
          INSERT INTO user_games (user_id, game_id, playtime_hours) VALUES ($1, $2, $3)
          ON CONFLICT (user_id, game_id) DO UPDATE SET playtime_hours = EXCLUDED.playtime_hours;
        `;
        await client.query(userGameQuery, [
          steamId,
          game.appId,
          game.playtimeHours,
        ]);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  public async getAllUsers(): Promise<SteamProfile[]> {
    const query = "SELECT * FROM users ORDER BY updated_at DESC";
    const res = await this.pool.query(query);
    return res.rows.map(this.mapRowToSteamProfile);
  }

  public async getOwnedGames(steamId: string): Promise<Game[]> {
    const query = `
      SELECT g.app_id, g.name, ug.playtime_hours, g.img_logo_url
      FROM user_games ug
      JOIN games g ON ug.game_id = g.app_id
      WHERE ug.user_id = $1
      ORDER BY ug.playtime_hours DESC;
    `;
    const res = await this.pool.query(query, [steamId]);
    return res.rows.map((row: any) => ({
      appId: row.app_id,
      name: row.name,
      playtimeHours: row.playtime_hours,
      imgLogoUrl: row.img_logo_url,
    }));
  }

  public async upsertGameDetails(
    appId: number,
    details: SteamGameDetails
  ): Promise<void> {
    const query = `
      INSERT INTO game_details (app_id, details, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (app_id) DO UPDATE SET
        details = EXCLUDED.details,
        updated_at = EXCLUDED.updated_at;
    `;
    await this.pool.query(query, [appId, details, Date.now()]);
  }

  public async upsertGame(game: Game): Promise<void> {
    const query = `
      INSERT INTO games (app_id, name, img_logo_url, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(app_id) DO UPDATE SET
        name = EXCLUDED.name,
        img_logo_url = EXCLUDED.img_logo_url,
        updated_at = EXCLUDED.updated_at;
    `;
    await this.pool.query(query, [
      game.appId,
      game.name,
      game.imgLogoUrl,
      Date.now(),
    ]);
  }

  public async getGamesWithFamilySharing(): Promise<
    (Game & { copy_count: number })[]
  > {
    const query = `
      SELECT
        g.app_id,
        g.name,
        g.img_logo_url,
        COUNT(ug.user_id)::INT AS copy_count
      FROM
        games g
      JOIN
        game_details gd ON g.app_id = gd.app_id
      JOIN
        user_games ug ON g.app_id = ug.game_id
      WHERE
        gd.details->'categories' @> '[{"id": 62}]'::jsonb
      GROUP BY
        g.app_id, g.name, g.img_logo_url
      ORDER BY
        copy_count DESC, g.name ASC;
    `;

    const res = await this.pool.query(query);

    return res.rows.map((row: any) => ({
      appId: row.app_id,
      name: row.name,
      playtimeHours: 0,
      imgLogoUrl: row.img_logo_url,
      copy_count: row.copy_count,
    }));
  }
  public async findGameIdByName(name: string): Promise<number | null> {
    const exactQuery =
      "SELECT app_id FROM games WHERE LOWER(name) = LOWER($1) LIMIT 1";
    let res = await this.pool.query(exactQuery, [name]);
    if (res.rows.length > 0) {
      return res.rows[0].app_id;
    }

    // 2. Se não encontrar, usa o LIKE para uma busca mais ampla
    const likeQuery = "SELECT app_id FROM games WHERE name ILIKE $1 LIMIT 1";
    res = await this.pool.query(likeQuery, [`%${name}%`]);
    if (res.rows.length > 0) {
      return res.rows[0].app_id;
    }

    return null;
  }
  /**
   * NOVO: Insere uma grande quantidade de jogos em massa.
   * Usa ON CONFLICT DO NOTHING para não sobrescrever jogos existentes.
   * Isso preserva detalhes como img_logo_url que podem ter sido adicionados por outras sincronizações.
   */
  public async batchUpsertGames(
    games: { appid: number; name: string }[]
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO games (app_id, name, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (app_id) DO NOTHING;
      `;

      for (const game of games) {
        // Ignora jogos sem nome, que são comuns na lista da API
        if (game.name) {
          await client.query(query, [game.appid, game.name, Date.now()]);
        }
      }

      await client.query("COMMIT");
      console.log(`✅ Lote de ${games.length} jogos processado.`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  public async getGameCopiesReport(): Promise<
    { name: string; copy_count: number }[]
  > {
    const query = `
      SELECT
        g.name,
        COUNT(ug.user_id)::INT AS copy_count
      FROM
        user_games ug
      JOIN
        games g ON ug.game_id = g.app_id
      GROUP BY
        g.name
      ORDER BY
        copy_count DESC, g.name ASC;
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  private mapRowToSteamProfile(row: any): SteamProfile {
    return {
      steamId: row.steam_id,
      whatsappId: row.whatsapp_id,
      personaName: row.persona_name,
      realName: row.real_name,
      avatarSmall: row.avatar_small,
      avatarMedium: row.avatar_medium,
      avatarFull: row.avatar_full,
      profileUrl: row.profile_url,
      lastLogOff: Number(row.last_log_off),
      personaState: row.persona_state,
    };
  }
  /**
   * Busca a vaquinha ativa no momento. Só pode haver uma.
   * @returns O objeto da vaquinha ativa ou null se não houver.
   */
  public async getActiveVaquinha(): Promise<Vaquinha | null> {
    const query = `
        SELECT 
            v.id, v.game_id, v.target_amount, v.amount_collected, v.status,
            g.name as game_name,
            u_starter.persona_name as started_by,
            -- Agrega as contribuições em um array de JSON
            COALESCE(
              (
                SELECT json_agg(json_build_object('personaName', u_contrib.persona_name, 'amount', c.amount))
                FROM contributions c
                JOIN users u_contrib ON c.user_id = u_contrib.steam_id
                WHERE c.vaquinha_id = v.id
              ), '[]'::json
            ) as contributions
        FROM vaquinhas v
        JOIN games g ON v.game_id = g.app_id
        JOIN users u_starter ON v.started_by_user_id = u_starter.steam_id
        WHERE v.status = 'active'
        LIMIT 1;
    `;
    const res = await this.pool.query(query);
    if (res.rows.length === 0) {
      return null;
    }
    return res.rows[0];
  }

  /**
   * Cria uma nova vaquinha para um jogo.
   * @returns O ID da nova vaquinha.
   */
  public async createVaquinha(
    gameId: number,
    targetAmount: number,
    startedByUserId: string
  ): Promise<number> {
    const query = `
        INSERT INTO vaquinhas (game_id, target_amount, started_by_user_id)
        VALUES ($1, $2, $3)
        RETURNING id;
      `;
    const res = await this.pool.query(query, [
      gameId,
      targetAmount,
      startedByUserId,
    ]);
    return res.rows[0].id;
  }

  /**
   * Adiciona uma contribuição a uma vaquinha e atualiza o total arrecadado.
   * @returns O novo total arrecadado.
   */
  public async addContribution(
    vaquinhaId: number,
    userId: string,
    amount: number
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Insere a nova contribuição
      const contribQuery = `INSERT INTO contributions (vaquinha_id, user_id, amount) VALUES ($1, $2, $3);`;
      await client.query(contribQuery, [vaquinhaId, userId, amount]);

      // Atualiza o valor total na tabela de vaquinhas e retorna o novo total
      const updateQuery = `
            UPDATE vaquinhas
            SET amount_collected = amount_collected + $1
            WHERE id = $2
            RETURNING amount_collected;
          `;
      const res = await client.query(updateQuery, [amount, vaquinhaId]);

      await client.query("COMMIT");
      return res.rows[0].amount_collected;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Atualiza o status de uma vaquinha (ex: para 'completed').
   */
  public async updateVaquinhaStatus(
    vaquinhaId: number,
    status: "completed" | "cancelled"
  ): Promise<void> {
    const query = `UPDATE vaquinhas SET status = $1 WHERE id = $2;`;
    await this.pool.query(query, [status, vaquinhaId]);
  }
}
