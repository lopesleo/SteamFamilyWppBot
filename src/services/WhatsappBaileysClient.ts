// src/services/WhatsappBaileysClient.ts
import fs from "node:fs/promises";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";
import pino from "pino";
import {
  IWhatsAppClient,
  WhatsAppMessage,
} from "../interfaces/IWhatsAppClient";

// Import dinâmico “puro” (não vira require() em CJS)
const dynamicImport = new Function(
  "specifier",
  "return import(specifier);"
) as <TModule>(specifier: string) => Promise<TModule>;

// Tipos mínimos locais para evitar import estático do Baileys
type WAMessage = any;
type MessageUpsertType = "notify" | string;
type AnyMessageContent = any;

export class WhatsAppBaileysClient implements IWhatsAppClient {
  private socket: any = null;
  private isInitializing = false;
  private backoffMs = 2000;
  private readonly maxBackoffMs = 60_000;
  private readonly authDir = "auth_info_baileys";
  private pairingCodeAttempts = 0;
  private pairingRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private pairingCodeInFlight = false;

  // refs preenchidas após o import do Baileys
  private jidNormalizedUser!: (jid: string) => string;
  private DisconnectReason!: any;

  private async clearAuthState() {
    if (this.pairingRetryTimer) {
      clearTimeout(this.pairingRetryTimer);
      this.pairingRetryTimer = null;
    }
    this.pairingCodeAttempts = 0;
    this.pairingCodeInFlight = false;
    try {
      await fs.rm(this.authDir, { recursive: true, force: true });
      console.log(
        "🧹 Credenciais antigas removidas. Um novo pareamento será necessário."
      );
    } catch (error) {
      console.warn("⚠️ Falha ao limpar credenciais antigas:", error);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log("🔁 Já inicializando; ignorando chamada duplicada.");
      return;
    }
    this.isInitializing = true;

    try {
      // ===== Baileys ESM (nenhum import no topo!) =====
      const baileys = await dynamicImport<any>("@whiskeysockets/baileys");
      const makeWASocket = baileys.default; // export default
      const { useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
      this.jidNormalizedUser = baileys.jidNormalizedUser;
      this.DisconnectReason = baileys.DisconnectReason;

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      const logger = pino({ level: "silent" });

      this.socket = makeWASocket({
        auth: state,
        version,
        logger,
        browser: ["SteamFamilyZap", "Chrome", "1.0"],
        // boas práticas
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
      });

      // Persistência de credenciais
      this.socket.ev.on("creds.update", saveCreds);

      // Conexão / QR / Reconexão
      this.socket.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log("📱 QR Code recebido! Escaneie para conectar:");
          qrcode.generate(qr, { small: true });
        }

        // Tenta pairing code (se aplicável) quando não veio QR
        if (
          connection !== "close" &&
          !this.socket!.authState.creds.registered &&
          !qr
        ) {
          void this.tryPairingCode("update");
        }

        if (connection === "connecting") {
          console.log(
            `🔌 Conectando… (WA Web ${version.join(".")}, latest? ${isLatest})`
          );
        }

        if (connection === "open") {
          console.log("✅ Cliente WhatsApp conectado!");
          this.isInitializing = false;
          this.backoffMs = 2000;
          if (this.pairingRetryTimer) {
            clearTimeout(this.pairingRetryTimer);
            this.pairingRetryTimer = null;
          }
          this.pairingCodeAttempts = 0;
          this.pairingCodeInFlight = false;
        }

        if (connection === "close") {
          const err = (lastDisconnect?.error ??
            new Boom("unknown")) as Boom<any>;
          const status = err?.output?.statusCode;
          const loggedOut =
            status === 401 ||
            (err as any)?.reason === this.DisconnectReason.loggedOut;

          console.log(
            `🔌 Conexão fechada. status=${status} loggedOut=${loggedOut}`
          );
          this.socket = null;
          this.isInitializing = false;

          if (loggedOut) {
            await this.clearAuthState();
            setTimeout(() => this.initialize().catch(console.error), 2000);
            return;
          }

          // backoff exponencial simples
          const wait = this.backoffMs;
          this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
          console.log(`⏳ Tentando reconectar em ${wait / 1000}s…`);
          setTimeout(() => this.initialize().catch(console.error), wait);
        }
      });

      // Primeira tentativa de pairing (se ainda não registrado)
      if (!this.socket.authState.creds.registered) {
        await this.tryPairingCode("initial");
      }
    } catch (error) {
      console.error("❌ Erro na inicialização do WhatsApp:", error);
      this.isInitializing = false;

      const wait = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      console.log(`⏳ Retry em ${wait / 1000}s…`);
      setTimeout(() => this.initialize().catch(console.error), wait);
    }
  }

  private async tryPairingCode(
    origin: "initial" | "update" | "retry" = "initial"
  ): Promise<void> {
    const phone = process.env.BOT_PHONE_NUMBER?.replace(/\D/g, "");
    if (!phone || !this.socket?.requestPairingCode) return;
    if (this.socket.authState.creds.registered) return;
    if (this.pairingCodeInFlight) return;

    this.pairingCodeInFlight = true;

    try {
      if (origin !== "retry") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      const code = await this.socket.requestPairingCode(phone);
      console.log(`🔗 Pairing code: ${code}`);

      this.pairingCodeAttempts = 0;
      if (this.pairingRetryTimer) {
        clearTimeout(this.pairingRetryTimer);
        this.pairingRetryTimer = null;
      }
    } catch (e: any) {
      const message = e?.message || String(e);
      console.warn("⚠️ Não foi possível gerar pairing code agora:", message);

      if (message.includes("Connection Closed")) {
        const attempts = ++this.pairingCodeAttempts;
        const delay = Math.min(10_000, 2000 * attempts);
        console.log(
          `⏳ Tentando gerar pairing code novamente em ${delay / 1000}s...`
        );

        if (this.pairingRetryTimer) {
          clearTimeout(this.pairingRetryTimer);
        }

        this.pairingRetryTimer = setTimeout(() => {
          this.pairingRetryTimer = null;
          void this.tryPairingCode("retry");
        }, delay);
      }
    } finally {
      this.pairingCodeInFlight = false;
    }
  }

  onMessage(handler: (msg: WhatsAppMessage) => Promise<void>): void {
    if (!this.socket)
      throw new Error("O cliente WhatsApp não foi inicializado.");

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

          const normalizedBotId = this.jidNormalizedUser(botId);
          const botWasMentioned = mentionedJids.includes(normalizedBotId);

          // Em grupos, só processa se o bot foi mencionado
          const shouldProcess = !isGroup || (isGroup && botWasMentioned);
          if (!shouldProcess) continue;

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
          if (text) await handler({ from, text, chatId });
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
    if (!this.socket)
      throw new Error("O cliente WhatsApp não foi inicializado.");

    const content: AnyMessageContent = image
      ? { image: { url: image }, caption: message, mentions }
      : { text: message, mentions };

    await this.socket.sendMessage(to, content);
  }
}
