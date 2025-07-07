export interface WhatsAppMessage {
  from: string;
  text: string;
  chatId?: string;
}

export interface IWhatsAppClient {
  initialize(): Promise<void>;
  onMessage(handler: (msg: WhatsAppMessage) => Promise<void>): void;
  sendMessage(
    to: string,
    message: string,
    image?: string,
    mentions?: string[]
  ): Promise<void>;
}
