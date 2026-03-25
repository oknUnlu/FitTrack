import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { AIResponse, ConversationMessage } from './types';
import { buildSystemPrompt, buildContextString } from './promptBuilder';

let genAI: GoogleGenerativeAI | null = null;

export function initializeGemini(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

export function isGeminiInitialized(): boolean {
  return genAI !== null;
}

/**
 * Send a message to Gemini with full conversation history for multi-turn chat.
 */
export async function sendToGemini(
  prompt: string,
  context: string,
  history: ConversationMessage[] = []
): Promise<AIResponse> {
  if (!genAI) {
    return { success: false, message: 'API anahtarı ayarlanmamış', source: 'gemini_cloud' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build system instruction from context
    let systemInstruction = buildSystemPrompt();
    if (context.trim()) {
      systemInstruction += '\n\n=== KULLANICI PROFİLİ VE VERİLERİ ===\n' + context;
    }

    // Convert conversation history to Gemini Content format
    const chatHistory: Content[] = history
      .slice(-20) // Keep last 20 messages to stay within token limits
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction,
    });

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    return { success: true, message: text, source: 'gemini_cloud' };
  } catch (error: any) {
    return { success: false, message: `Gemini hatası: ${error.message}`, source: 'gemini_cloud' };
  }
}

/**
 * Generate a personalized fitness or nutrition plan via Gemini.
 */
export async function generatePlan(
  planType: 'workout' | 'nutrition' | 'weekly',
  context: string
): Promise<AIResponse> {
  if (!genAI) {
    return { success: false, message: 'API anahtarı ayarlanmamış', source: 'gemini_cloud' };
  }

  const planPrompts: Record<string, string> = {
    workout: [
      'Kullanıcı profiline göre kişiselleştirilmiş bir haftalık antrenman planı oluştur.',
      'Her gün için egzersiz adı, set sayısı, tekrar sayısı ve dinlenme süresini belirt.',
      'Kullanıcının hedefine ve aktivite seviyesine uygun olsun.',
      'Isınma ve soğuma önerileri de ekle.',
    ].join('\n'),
    nutrition: [
      'Kullanıcı profiline göre günlük beslenme planı oluştur.',
      'Kahvaltı, öğle, akşam ve ara öğün olarak düzenle.',
      'Her öğün için besin adı, porsiyon ve yaklaşık kalori/makro değerlerini belirt.',
      'TDEE ve hedefle uyumlu olsun.',
    ].join('\n'),
    weekly: [
      'Kullanıcı profiline göre haftalık kombine fitness planı oluştur.',
      'Her gün için hem antrenman hem beslenme önerisi ver.',
      'Dinlenme günlerini de dahil et.',
      'Kullanıcının hedefine özel olsun.',
    ].join('\n'),
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let systemInstruction = buildSystemPrompt();
    if (context.trim()) {
      systemInstruction += '\n\n=== KULLANICI PROFİLİ VE VERİLERİ ===\n' + context;
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: planPrompts[planType] }] }],
      systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
    });
    const text = result.response.text();

    return { success: true, message: text, source: 'gemini_cloud' };
  } catch (error: any) {
    return { success: false, message: `Plan oluşturma hatası: ${error.message}`, source: 'gemini_cloud' };
  }
}
