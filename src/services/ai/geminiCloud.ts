import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIResponse } from './types';
import { buildFullPrompt } from './promptBuilder';

let genAI: GoogleGenerativeAI | null = null;

export function initializeGemini(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

export async function sendToGemini(prompt: string, context: string): Promise<AIResponse> {
  if (!genAI) {
    return { success: false, message: 'API anahtarı ayarlanmamış', source: 'gemini_cloud' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fullPrompt = buildFullPrompt(prompt, context);
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return { success: true, message: text, source: 'gemini_cloud' };
  } catch (error: any) {
    return { success: false, message: `Gemini hatası: ${error.message}`, source: 'gemini_cloud' };
  }
}
