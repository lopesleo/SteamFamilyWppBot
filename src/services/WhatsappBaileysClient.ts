import makeWASocket, {
  DisconnectReason,
  AnyMessageContent,
  useMultiFileAuthState,
  WASocket,
  MessageUpsertType,
  WAMessage,
  jidNormalizedUser,
} from "baileys";
import { Boom } from "@hapi/boom";
import {
  IWhatsAppClient,
  WhatsAppMessage,
} from "../interfaces/IWhatsAppClient";
import * as path from "path";
import * as qrcode from "qrcode-terminal";

export class WhatsAppBaileysClient implements IWhatsAppClient {
  private socket?: WASocket;
  private authFolder = path.join(__dirname, "baileys_auth");

  constructor() {}

  async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

    this.socket = makeWASocket({
      auth: state,
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 QR Code recebido! Escaneie para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        console.log("✅ Baileys conectado com sucesso!");
      } else if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log(`❌ Conexão fechada! Reconectando: ${shouldReconnect}`);

        if (!shouldReconnect) {
          console.error(
            "🛑 Desconectado permanentemente. Apague a pasta 'baileys_auth' para gerar um novo QR Code."
          );
        }
      }
    });
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
          if (!botId) continue; // Se o bot não estiver totalmente conectado, ignora

          const chatId = message.key.remoteJid!;
          const isGroup = chatId.endsWith("@g.us");

          const mentionedJids =
            message.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
            [];

          // 2. Normalizamos o ID do bot para garantir uma comparação correta
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

    // ## A CORREÇÃO ESTÁ AQUI ##
    // A propriedade 'mentions' foi movida para dentro do objeto 'content',
    // que é o segundo argumento do 'sendMessage'.
    const content: AnyMessageContent = image
      ? { image: { url: image }, caption: message, mentions: mentions }
      : { text: message, mentions: mentions };

    // Agora enviamos apenas o 'content'. O Baileys lerá a propriedade 'mentions' de dentro dele.
    await this.socket.sendMessage(to, content);
  }
}
