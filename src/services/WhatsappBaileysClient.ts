// src/services/WhatsAppBaileysClient.ts
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import {
  IWhatsAppClient,
  WhatsAppMessage,
} from "../interfaces/IWhatsAppClient";

export class WhatsAppBaileysClient implements IWhatsAppClient {
  private socket: any;

  async initialize(): Promise<void> {
    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info_baileys");
    const logger = pino({ level: "silent" });

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ["SteamFamilyBot", "Chrome", "1.0.0"],
    });

    if (!this.socket.authState.creds.registered) {
      const phoneNumber = process.env.BOT_PHONE_NUMBER;
      if (!phoneNumber) {
        throw new Error(
          "Número de telefone do bot não encontrado no .env (BOT_PHONE_NUMBER)"
        );
      }

      setTimeout(async () => {
        const code = await this.socket.requestPairingCode(phoneNumber);
        console.log(`\n\n================================================`);
        console.log(`✅ SEU CÓDIGO DE PAREAMENTO É: ${code}`);
        console.log(`================================================\n\n`);
        console.log(
          "Abra o WhatsApp no seu celular, vá em 'Aparelhos Conectados' > 'Conectar um aparelho' > 'Conectar com número de telefone' e insira o código acima."
        );
      }, 3000);
    }

    this.socket.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log(
          "Conexão fechada. Motivo:",
          lastDisconnect?.error,
          ". Reconectando:",
          shouldReconnect
        );
        if (shouldReconnect) {
          this.initialize();
        }
      } else if (connection === "open") {
        console.log("✅ Cliente Baileys conectado via Código de Pareamento!");
      }
    });

    this.socket.ev.on("creds.update", saveCreds);
  }

  onMessage(handler: (msg: WhatsAppMessage) => Promise<void>): void {
    this.socket.ev.on(
      "messages.upsert",
      async (m: { messages: WAMessage[] }) => {
        const receivedMsg = m.messages[0];
        if (!receivedMsg.message || receivedMsg.key.fromMe) return;

        const messageText =
          receivedMsg.message.conversation ||
          receivedMsg.message.extendedTextMessage?.text;
        if (messageText) {
          const msg: WhatsAppMessage = {
            from: receivedMsg.key.remoteJid!,
            text: messageText,
          };
          await handler(msg);
        }
      }
    );
  }

  async sendMessage(to: string, text: string): Promise<void> {
    try {
      await this.socket.sendMessage(to, { text });
    } catch (error) {
      console.error("Erro ao enviar mensagem via Baileys:", error);
    }
  }
}
