// src/services/WhatsAppVenomClient.ts
import * as venom from "venom-bot"; // <-- CORREÇÃO AQUI
import {
  IWhatsAppClient,
  WhatsAppMessage,
} from "../interfaces/IWhatsAppClient";

export class WhatsAppVenomClient implements IWhatsAppClient {
  // E a correção no tipo é feita aqui
  private client!: venom.Whatsapp;

  async initialize(): Promise<void> {
    // Agora 'venom' é o objeto que contém a função 'create'
    this.client = await venom.create({
      session: "steam-family-bot",
      browserArgs: ["--headless=new"], // Executa em modo headless
      catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
        console.log("Número de tentativas para ler o QR Code: ", attempts);
        console.log("Terminal QR Code:");
        console.log(asciiQR); // Exibe o QR code no terminal
      },
      logQR: false,
    });
    console.log("✅ Cliente Venom conectado!");
  }

  onMessage(handler: (msg: WhatsAppMessage) => Promise<void>): void {
    this.client.onMessage(async (message) => {
      if (message.fromMe) {
        return; // Ignora mensagens enviadas pelo próprio bot
      }

      // LÓGICA DE GRUPO: Verifica se a mensagem é de um grupo e se o bot foi mencionado.
      if (message.isGroupMsg) {
        if (message.mentionedJidList) {
          const isBotMentioned = message.mentionedJidList.includes(
            `${process.env.BOT_PHONE_NUMBER}@c.us`
          );

          // Se for uma mensagem de grupo e o bot não foi mencionado, ignora.
          if (!isBotMentioned) {
            return;
          }
        } else {
          // Se não for possível obter o ID do bot, ignora a mensagem de grupo por segurança.
          console.warn(
            "Não foi possível verificar a menção do bot. Ignorando mensagem de grupo."
          );
          return;
        }
      }

      // Se for uma mensagem direta (DM) ou se o bot foi mencionado em um grupo, processa a mensagem.
      if (message.body) {
        const msg: WhatsAppMessage = {
          from: message.chatId, // ID do chat (seja grupo ou usuário)
          text: message.body,
          chatId: message.isGroupMsg ? message.author : message.from, // ID de quem realmente enviou
        };
        await handler(msg);
      }
    });
  }

  async sendMessage(
    to: string,
    message: string,
    image?: string,
    mentions?: string[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Cliente WhatsApp não inicializado");
    }

    console.log(mentions);
    try {
      if (image) {
        await this.client.sendImage(to, image, "image", message, {
          mentions: mentions,
        });
      } else {
        await this.client.sendText(to, message, mentions);
      }
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      throw error;
    }
  }
}
