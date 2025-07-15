// src/app.ts

import "dotenv/config";
import { ISteamService, SteamProfile } from "./interfaces/ISteamService";
import { IWhatsAppClient } from "./interfaces/IWhatsAppClient";
import { GeminiAIService } from "./services/GeminiAIService";
import { SteamService } from "./services/SteamService";
import { Content, Part } from "@google/generative-ai";
import { DatabaseService } from "./services/DatabaseService";
import { WhatsAppBaileysClient } from "./services/WhatsappBaileysClient";
import { IGamerPowerService, Giveaway } from "./interfaces/IGamerPowerService";
import { GamerPowerService } from "./services/GamePowerService";
class Bot {
  private steamService: ISteamService;
  private aiService: GeminiAIService;
  private whatsAppClient: IWhatsAppClient;
  private dbService: DatabaseService;
  private gamerPowerService: IGamerPowerService;
  private readonly steamWPPGroup: string;

  constructor() {
    if (!process.env.STEAM_APIKEY || !process.env.GEMINI_APIKEY) {
      throw new Error(
        "Chaves de API da Steam ou Gemini não definidas no .env!"
      );
    }
    if (!process.env.BOT_PHONE_NUMBER) {
      throw new Error("Número do bot não definido no .env!");
    }
    if (!process.env.WHATSAPP_GROUP_ID) {
      throw new Error("ID do grupo do WhatsApp não definido no .env!");
    }
    this.steamWPPGroup = process.env.WHATSAPP_GROUP_ID;
    this.dbService = new DatabaseService();
    this.steamService = new SteamService(
      process.env.STEAM_APIKEY,
      this.dbService
    );
    this.aiService = new GeminiAIService(process.env.GEMINI_APIKEY);
    this.whatsAppClient = new WhatsAppBaileysClient();

    this.gamerPowerService = new GamerPowerService();
    this.start();
  }

  private async start() {
    try {
      await this.whatsAppClient.initialize();
      this.whatsAppClient.onMessage(this.handleMessage.bind(this));
      console.log(
        "🤖 Bot online, com banco de dados PostgreSQL e ciente do contexto!"
      );
      this.scheduleFreeGamesCheck();
    } catch (error) {
      console.error("Falha fatal ao inicializar o bot:", error);
      process.exit(1);
    }
  }
  private scheduleFreeGamesCheck() {
    console.log("📰 Agendando verificação de jogos grátis a cada 6 horas.");

    setTimeout(() => this.checkForNewGiveaways(), 10 * 1000);

    setInterval(() => this.checkForNewGiveaways(), 6 * 60 * 60 * 1000);
  }

  private async checkForNewGiveaways() {
    console.log("\n🔎 Verificando novos jogos grátis...");
    try {
      // Filtramos por jogos nas plataformas de PC mais populares
      const giveaways = await this.gamerPowerService.getGiveaways({
        platform: "pc.steam.epic-games-store.gog",
        type: "game",
        "sort-by": "date",
      });

      if (giveaways.length === 0) {
        console.log("Nenhum giveaway de jogo encontrado no momento.");
        return;
      }

      // Itera sobre a lista de trás para frente para anunciar os mais antigos primeiro
      for (const giveaway of giveaways.reverse()) {
        const alreadyAnnounced = await this.dbService.isGiveawayAnnounced(
          giveaway.id
        );

        if (!alreadyAnnounced) {
          console.log(`✨ Novo jogo grátis encontrado: ${giveaway.title}`);

          const message =
            `🎉 *JOGO GRÁTIS NA ÁREA!* 🎉\n\n` +
            `*Título:* ${giveaway.title}\n` +
            `*Plataformas:* ${giveaway.platforms}\n` +
            `*Valor de mercado:* ${giveaway.worth}\n\n` +
            `*Instruções:*\n${giveaway.instructions}\n\n` +
            `*Pegue o seu aqui:*\n${giveaway.open_giveaway_url}\n\n` +
            `_Corre que é por tempo limitado!_ 🎮`;

          await this.whatsAppClient.sendMessage(
            this.steamWPPGroup,
            message,
            giveaway.image // Envia a imagem do jogo junto com a mensagem
          );

          // Marca o jogo como anunciado no banco de dados
          await this.dbService.markGiveawayAsAnnounced(giveaway);
          console.log(`✅ Anunciado: "${giveaway.title}" no grupo.`);

          // Uma pausa de 3 segundos para não floodar o grupo com múltiplos anúncios de uma vez
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      console.log("🏁 Verificação de jogos grátis concluída.\n");
    } catch (error) {
      console.error("❌ Erro ao verificar ou anunciar giveaways:", error);
    }
  }

  private async handleMessage(msg: {
    from: string;
    text: string;
    chatId?: string;
  }) {
    if (!msg.text) return;

    console.log(
      `> Mensagem de ${msg.chatId ?? "privado"} recebida em ${msg.from}: "${
        msg.text
      }"`
    );

    try {
      const isGroupMessage = msg.chatId === this.steamWPPGroup;
      // Para mensagens de grupo, o remetente real está em `from`. Para mensagens privadas, `from` e `chatId` são iguais.
      const senderWppId = isGroupMessage ? msg.from : msg.chatId!;
      const senderProfile =
        await this.dbService.getUserByWhatsappId(senderWppId);

      if (!senderProfile) {
        console.warn(
          `Remetente não cadastrado (${senderWppId}). Ignorando mensagem.`
        );
        return;
      }

      const destinationId = isGroupMessage ? this.steamWPPGroup : senderWppId;
      console.log(`> Remetente identificado: ${senderProfile.personaName}`);

      const initialResponse = await this.aiService.processMessage(msg.text);
      if (initialResponse.functionCall) {
        const functionCall = initialResponse.functionCall;
        const functionName = functionCall.name;
        const functionArgs = functionCall.args;
        let functionResultData: any;

        console.log(
          `🔧 IA solicitou: ${functionName}(${JSON.stringify(functionArgs)})`
        );

        switch (functionName) {
          case "start_vaquinha": {
            const activeVaquinha = await this.dbService.getActiveVaquinha();
            if (activeVaquinha) {
              functionResultData = {
                error: `Já existe uma vaquinha ativa para o jogo "${activeVaquinha.game_name}".`,
              };
              break;
            }
            const gameName = functionArgs.game_name;
            const appId = await this.dbService.findGameIdByName(gameName);
            if (!appId) {
              functionResultData = {
                error: `Não encontrei o jogo "${gameName}" em nosso catálogo.`,
              };
              break;
            }
            const gameDetails = await this.steamService.getGameInfo(appId);
            if (!gameDetails?.price_overview) {
              functionResultData = {
                error: `Não consegui encontrar o preço para "${gameName}".`,
              };
              break;
            }
            const price = gameDetails.price_overview.final / 100; // Preço em BRL
            await this.dbService.createVaquinha(
              appId,
              price,
              senderProfile.steamId
            );
            functionResultData = {
              success: true,
              gameName: gameDetails.name,
              price: price,
              starter_nickname: senderProfile.personaName,
            };
            break;
          }

          case "contribute_to_vaquinha": {
            const activeVaquinha = await this.dbService.getActiveVaquinha();
            if (!activeVaquinha) {
              functionResultData = {
                error: "Não há nenhuma vaquinha ativa no momento.",
              };
              break;
            }
            const amount = functionArgs.amount;
            const newTotal = await this.dbService.addContribution(
              activeVaquinha.id,
              senderProfile.steamId,
              amount
            );
            if (newTotal >= activeVaquinha.target_amount) {
              console.log(newTotal, activeVaquinha.target_amount);

              await this.dbService.updateVaquinhaStatus(
                activeVaquinha.id,
                "completed"
              );
              functionResultData = {
                success: true,
                goal_reached: true,
                gameName: activeVaquinha.game_name,
              };
            } else {
              functionResultData = {
                success: true,
                goal_reached: false,
                gameName: activeVaquinha.game_name,
                price: activeVaquinha.target_amount,
                total_collected: newTotal,
                contributor: senderProfile.personaName,
              };
            }
            break;
          }

          case "get_vaquinha_status": {
            functionResultData =
              await this.dbService.getActiveVaquinhaWithDetails();
            if (!functionResultData) {
              functionResultData = {
                error: "Não há nenhuma vaquinha ativa no momento.",
              };
            }
            break;
          }
          case "cancel_vaquinha": {
            const activeVaquinha = await this.dbService.getActiveVaquinha();
            if (!activeVaquinha) {
              functionResultData = {
                error: "Não há nenhuma vaquinha ativa para cancelar.",
              };
              break;
            }

            if (activeVaquinha.started_by !== senderProfile.personaName) {
              console.log(
                `Tentativa de cancelamento por ${
                  senderProfile.personaName
                }, mas apenas o criador pode cancelar.`
              );
              functionResultData = {
                error: `Apenas quem iniciou a vaquinha pode cancelá-la. Peça ao @[${activeVaquinha.started_by}] para fazer isso.`,
              };
              break;
            }
            await this.dbService.updateVaquinhaStatus(
              activeVaquinha.id,
              "cancelled"
            );
            functionResultData = {
              success: true,
              gameName: activeVaquinha.game_name,
            };
            break;
          }
          case "get_steam_profile":
          case "get_owned_games":
          case "get_recent_games": {
            const targetSteamId = await this.getTargetSteamId(
              functionArgs.identifier,
              senderProfile!
            );
            if (!targetSteamId) {
              functionResultData = {
                error: `Não consegui identificar o jogador "${functionArgs.identifier} ${senderProfile!.personaName}".`,
              };
              break;
            }
            if (functionName === "get_steam_profile") {
              functionResultData =
                await this.steamService.getProfile(targetSteamId);
            } else if (functionName === "get_owned_games") {
              functionResultData =
                await this.dbService.getOwnedGames(targetSteamId);
            } else {
              functionResultData =
                await this.steamService.getRecentGames(targetSteamId);
            }
            break;
          }

          case "get_game_details": {
            const gameName = functionArgs.game_name;
            const appId = await this.dbService.findGameIdByName(gameName);
            if (!appId) {
              functionResultData = {
                error: `Não encontrei o jogo "${gameName}" em nosso catálogo.`,
              };
            } else {
              functionResultData = await this.steamService.getGameInfo(appId);
            }
            break;
          }

          case "get_family_sharing_games": {
            functionResultData =
              await this.dbService.getGamesWithFamilySharing();
            break;
          }

          case "get_game_copies_report": {
            functionResultData = await this.dbService.getGameCopiesReport();
            break;
          }

          default:
            await this.whatsAppClient.sendMessage(
              destinationId,
              `A ferramenta solicitada, "${functionName}", não me é familiar.`
            );
            return;
        }

        if (
          functionResultData &&
          (!Array.isArray(functionResultData) || functionResultData.length > 0)
        ) {
          const history: Content[] = [
            { role: "user", parts: [{ text: msg.text }] },
            { role: "model", parts: [{ functionCall: functionCall }] },
          ];
          const functionResponsePart: Part = {
            functionResponse: {
              name: functionName,
              response: { result: functionResultData }, // Alterado para 'result'
            },
          };
          const finalResponse = await this.aiService.processMessage(
            [functionResponsePart],
            history
          );

          if (finalResponse.text) {
            console.log(
              `🔧 IA respondeu com a função "${functionName}": ${finalResponse.text}`
            );

            // ✨ NOVA LÓGICA DE MENÇÕES
            const { final_text, jids } = await this.processMentions(
              finalResponse.text
            );

            await this.whatsAppClient.sendMessage(
              destinationId,
              final_text, // Envia o texto original da IA
              functionResultData.header_image,
              jids // Envia a lista de JIDs para notificar
            );
          }
        } else {
          await this.whatsAppClient.sendMessage(
            destinationId,
            `Não encontrei dados para sua solicitação.`
          );
        }
      } else if (initialResponse.text) {
        await this.whatsAppClient.sendMessage(
          destinationId,
          initialResponse.text
        );
      }
    } catch (error) {
      console.error("❌ Erro no handleMessage:", error);
      await this.whatsAppClient.sendMessage(
        msg.from,
        "Perdão, tive uma dificuldade interna e não pude processar seu pedido."
      );
    }
  }

  /**
   * Processa o texto recebido da IA, extrai menções e retorna o texto original
   * junto com os JIDs correspondentes.
   *
   * @param text Texto recebido da IA
   * @returns Objeto contendo o texto original e uma lista de JIDs mencionados.
   */
  // Em src/app.ts
  private async processMentions(
    text: string
  ): Promise<{ final_text: string; jids: string[] }> {
    const mentionRegex = /@\[?([a-zA-Z0-9_À-ú]+)\]?/g;

    const uniqueNicknames = [
      ...new Set(Array.from(text.matchAll(mentionRegex), (m) => m[1])),
    ];

    if (uniqueNicknames.length === 0) {
      console.log("Nenhuma menção com @ encontrada.");
      console.log("---------------------------------");
      return { final_text: text, jids: [] };
    }

    console.log(
      `Encontrados ${uniqueNicknames.length} nicknames únicos para processar:`,
      uniqueNicknames
    );

    const jids: string[] = [];
    let processedText = text;

    for (const nickname of uniqueNicknames) {
      console.log(`Buscando no DB por nickname: "${nickname}"`);
      const user = await this.dbService.getUserByNickname(nickname);

      const placeholderRegex = new RegExp(`@\\[?${nickname}\\]?`, "g");

      if (user && user.whatsappId) {
        console.log(`✅ Encontrado: ${user.personaName} -> ${user.whatsappId}`);
        if (!jids.includes(user.whatsappId)) {
          jids.push(user.whatsappId);
        }
        const numberPart = user.whatsappId.split("@")[0];

        console.log(
          `Substituindo ocorrências de "@${nickname}" por "@${numberPart}".`
        );
        processedText = processedText.replace(
          placeholderRegex,
          `@${numberPart}`
        );
      } else {
        console.log(
          `❌ Nickname "${nickname}" não encontrado. Mantendo como texto.`
        );
        processedText = processedText.replace(placeholderRegex, `@${nickname}`);
      }
    }

    console.log("JIDs coletados para notificação:", jids);
    console.log("---------------------------------\n");

    return { final_text: processedText, jids: jids };
  }

  private async getTargetSteamId(
    identifier: string,
    sender: SteamProfile
  ): Promise<string | null> {
    const cleanIdentifier = identifier?.toLowerCase();
    if (!cleanIdentifier || cleanIdentifier === "me") {
      return sender.steamId;
    }
    if (/^\d{17}$/.test(cleanIdentifier)) {
      return cleanIdentifier;
    }
    const userFromDb = await this.dbService.getUserByNickname(cleanIdentifier);
    if (userFromDb) {
      return userFromDb.steamId;
    }
    console.log(
      `Apelido "${cleanIdentifier}" não encontrado no DB, tentando como Vanity URL...`
    );
    return this.steamService.resolveVanityURL(cleanIdentifier);
  }
}

new Bot();
