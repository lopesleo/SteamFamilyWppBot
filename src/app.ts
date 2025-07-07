import "dotenv/config";
import { ISteamService, SteamProfile } from "./interfaces/ISteamService";
import { IWhatsAppClient } from "./interfaces/IWhatsAppClient";
import { GeminiAIService } from "./services/GeminiAIService";
import { SteamService } from "./services/SteamService";
import { WhatsAppVenomClient } from "./services/WhatsappVenomClient";
import { Content, Part } from "@google/generative-ai";
import { DatabaseService } from "./services/DatabaseService";

class Bot {
  private steamService: ISteamService;
  private aiService: GeminiAIService;
  private whatsAppClient: IWhatsAppClient;
  private dbService: DatabaseService;
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
    this.whatsAppClient = new WhatsAppVenomClient();
    this.start();
  }

  private async start() {
    try {
      await this.whatsAppClient.initialize();
      this.whatsAppClient.onMessage(this.handleMessage.bind(this));
      console.log(
        "🤖 Bot online, com banco de dados PostgreSQL e ciente do contexto!"
      );
    } catch (error) {
      console.error("Falha fatal ao inicializar o bot:", error);
      process.exit(1);
    }
  }

  private async handleMessage(msg: {
    from: string;
    text: string;
    chatId?: string;
  }) {
    if (!msg.text) return;

    console.log(
      `> Mensagem de ${msg.chatId ?? "privado"} recebida em ${msg.from}: "${msg.text}"`
    );

    try {
      const isGroupMessage = msg.from === this.steamWPPGroup;
      const senderProfile = await this.dbService.getUserByWhatsappId(
        msg.chatId ?? msg.from
      );

      if (!isGroupMessage) {
        if (!senderProfile) {
          console.warn(
            `Remetente não encontrado no banco de dados: ${msg.from}. Verifique se o usuário está cadastrado.`
          );
          return;
        }
      }

      if (!isGroupMessage && !senderProfile) {
        console.warn(
          `Mensagem de número não cadastrado e não vinda do grupo: ${msg.from}. Ignorando.`
        );
        return;
      }

      if (isGroupMessage) {
        msg.from = this.steamWPPGroup;
        console.log(
          `> Mensagem redirecionada para o grupo: ${this.steamWPPGroup}`
        );
      } else {
        console.log(`> Remetente identificado: ${senderProfile!.personaName}`);
      }
      const initialResponse = await this.aiService.processMessage(msg.text);
      if (initialResponse.functionCall) {
        const functionCall = initialResponse.functionCall;
        const functionName = functionCall.name;
        const functionArgs = functionCall.args;
        let functionResultData: any;

        console.log(
          `🔧 IA solicitou: ${functionName}(${JSON.stringify(functionArgs)})`
        );

        // Executa a função solicitada pela IA
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
              senderProfile!.steamId
            );
            functionResultData = {
              success: true,
              gameName: gameDetails.name,
              price: price,
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
              senderProfile!.steamId,
              amount
            );
            console.log(
              `Contribuição de ${amount} BRL adicionada por ${senderProfile!.personaName}`
            );
            console.log(
              `Novo total arrecadado: ${newTotal} BRL (meta: ${activeVaquinha.target_amount} BRL)`
            );
            if (newTotal >= activeVaquinha.target_amount) {
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
              functionResultData = { success: true, goal_reached: false };
            }
            break;
          }

          case "get_vaquinha_status": {
            functionResultData = await this.dbService.getActiveVaquinha();
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
            // Regra de negócio: Apenas quem iniciou pode cancelar.
            if (activeVaquinha.started_by != senderProfile!.personaName) {
              console.log(
                `Tentativa de cancelamento por ${senderProfile!.personaName}, mas apenas ${activeVaquinha.started_by} pode cancelar.`
              );
              functionResultData = {
                error: `Apenas o ${activeVaquinha.started_by}, que iniciou a vaquinha, pode cancelá-la.`,
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
                error: `Não consegui identificar o jogador "${functionArgs.identifier}".`,
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
              // get_recent_games
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
              msg.from,
              `A ferramenta solicitada, "${functionName}", não me é familiar.`
            );
            return;
        }

        // Envia o resultado da função de volta para a IA
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
              response: { data: functionResultData },
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
            const mentions = this.extractMentions(finalResponse.text);

            await this.whatsAppClient.sendMessage(
              msg.from,
              finalResponse.text,
              functionResultData.header_image,
              mentions
            );
          }
        } else {
          await this.whatsAppClient.sendMessage(
            msg.from,
            `Não encontrei dados para sua solicitação.`
          );
        }
      } else if (initialResponse.text) {
        await this.whatsAppClient.sendMessage(msg.from, initialResponse.text);
      }
    } catch (error) {
      console.error("❌ Erro no handleMessage:", error);
      await this.whatsAppClient.sendMessage(
        msg.from,
        "Perdão, tive uma dificuldade interna e não pude processar seu pedido."
      );
    }
  }
  private extractMentions(message: string): string[] {
    const mentions: string[] = [];
    const mentionRegex = /@(\d+)/g;
    let match;

    while ((match = mentionRegex.exec(message)) !== null) {
      const phoneNumber = match[1];
      mentions.push(`${phoneNumber}@c.us`);
    }

    return mentions;
  }

  private formatMentionsForAI(familyMembers: any[]): string {
    return familyMembers
      .map((member) => {
        const phoneNumber = member.whatsappId.replace("@c.us", "");
        return `- ${member.personaName}: use @${phoneNumber} para mencionar`;
      })
      .join("\n");
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
