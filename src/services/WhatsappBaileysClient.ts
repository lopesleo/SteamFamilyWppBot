// src/services/WhatsAppBaileysClient.ts
import makeWASocket, {
  AnyMessageContent,
  DisconnectReason,
  jidNormalizedUser,
  MessageUpsertType,
  useMultiFileAuthState,
  WAMessage,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
// import qrcode from "qrcode-terminal"; // No longer strictly needed if printQRInTerminal is true
import {
  IWhatsAppClient,
  WhatsAppMessage,
} from "../interfaces/IWhatsAppClient";
import qrcode from "qrcode-terminal"; // Importing qrcode for manual QR code generation

export class WhatsAppBaileysClient implements IWhatsAppClient {
  private socket: any;
  private isInitializing: boolean = false; // Add a flag to prevent multiple initializations

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log("Already initializing, skipping duplicate call.");
      return;
    }
    this.isInitializing = true;

    try {
      const { state, saveCreds } =
        await useMultiFileAuthState("auth_info_baileys"); // This creates/loads the session folder
      const logger = pino({ level: "silent" }); // Keep logging silent for cleaner output

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false, // This is the key setting to display the QR code
        logger,
      });

      // --- Removed manual QR code generation ---
      // This section is typically not needed if printQRInTerminal is true,
      // as Baileys handles the QR display automatically on first connection.

      // --- Pairing code section (currently commented out) ---
      // This part is for phone number pairing, which is an alternative
      // to QR code. Keep it commented unless you specifically need it.
      /*
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
        }, 30000); // Wait 30 seconds before requesting pairing code
      }
      */

      // Event listener for connection updates
      this.socket.ev.on("connection.update", (update: any) => {
        const { connection, lastDisconnect, qr, requestPairingCode } = update;

        // if (qr) {
        //   console.log("📱 QR Code recebido! Escaneie para conectar:");
        //   qrcode.generate(qr, { small: true });
        // }

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
          }, 3000); // Wait 3 seconds before requesting pairing code
        }

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

          // Clear the initializing flag if we need to reconnect
          this.isInitializing = false;
          if (shouldReconnect) {
            this.initialize(); // Attempt to re-initialize the connection
          } else {
            console.log(
              "Sessão encerrada pelo WhatsApp. Por favor, reinicie a aplicação e escaneie o QR Code novamente."
            );
            // Optionally, you might want to exit the process here if logged out permanently
            // process.exit(1);
          }
        } else if (connection === "open") {
          console.log("✅ Cliente Baileys conectado!");
          this.isInitializing = false; // Reset flag once connection is open
        } else if (connection === "connecting") {
          console.log("Conectando ao WhatsApp...");
        }
      });

      // Event listener for credential updates (important for saving session)
      this.socket.ev.on("creds.update", saveCreds);
    } catch (error) {
      console.error("Erro na inicialização do Baileys:", error);
      this.isInitializing = false; // Ensure flag is reset on error
      // Consider adding a retry mechanism here if it's a transient error
    }
  }

  onMessage(handler: (msg: WhatsAppMessage) => Promise<void>): void {
    if (!this.socket) {
      throw new Error("O cliente WhatsApp não foi inicializado.");
    }

    this.socket.ev.on(
      "messages.upsert",
      async (m: { messages: WAMessage[]; type: MessageUpsertType }) => {
        if (m.type !== "notify") return;

        for (const message of m.messages) {
          if (message.key.fromMe || !message.message) continue;

          const botId = this.socket?.user?.id;
          if (!botId) continue;

          const chatId = message.key.remoteJid!;
          const isGroup = chatId.endsWith("@g.us");

          const mentionedJids =
            message.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
            [];

          const normalizedBotId = jidNormalizedUser(botId);
          const botWasMentioned = mentionedJids.includes(normalizedBotId);

          console.log(
            `📩 Nova mensagem recebida de ${message.key.participant || chatId} (Grupo: ${isGroup})`
          );
          console.log(
            `🔍 Verificando menção. BotID Normalizado: ${normalizedBotId}. Mencionado: ${botWasMentioned}`
          );

          const shouldProcess = !isGroup || (isGroup && botWasMentioned);

          if (!shouldProcess) {
            continue;
          }

          console.log(`✅ Mensagem APROVADA para processamento.`);

          let text =
            message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            message.message.imageMessage?.caption ||
            "";

          if (isGroup) {
            const botMention = `@${normalizedBotId.split("@")[0]}`;
            text = text.replace(botMention, "").trim();
          }

          const from = message.key.participant || chatId;

          if (text) {
            await handler({ from, text, chatId });
          }
        }
      }
    );
  }

  async sendMessage(
    to: string,
    message: string,
    image?: string,
    mentions?: string[]
  ): Promise<void> {
    if (!this.socket) {
      throw new Error("O cliente WhatsApp não foi inicializado.");
    }

    const content: AnyMessageContent = image
      ? { image: { url: image }, caption: message, mentions: mentions }
      : { text: message, mentions: mentions };

    await this.socket.sendMessage(to, content);
  }
}
