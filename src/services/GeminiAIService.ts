// src/services/GeminiAIService.ts
import { GoogleGenerativeAI, Part, Content } from "@google/generative-ai";
import { IAIService } from "../interfaces/IAIService";
import { SYSTEM_PROMPT } from "../prompts";
import { tools } from "../tools";

export class GeminiAIService implements IAIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
      systemInstruction: SYSTEM_PROMPT,
      tools: tools,
    });
  }

  async processMessage(
    prompt: string | Part[],
    history?: Content[]
  ): Promise<{ text?: string; functionCall?: any }> {
    const chat = this.model.startChat({
      history: history || [],
    });

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      return { functionCall: functionCalls[0] };
    } else {
      return { text: response.text() };
    }
  }
}
