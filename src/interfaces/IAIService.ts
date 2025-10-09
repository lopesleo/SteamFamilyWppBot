import { Content, Part } from "@google/generative-ai";

export interface IAIService {
  processMessage(
    prompt: string | Part[],
    history?: Content[]
  ): Promise<{ text?: string; functionCall?: any }>;
}
