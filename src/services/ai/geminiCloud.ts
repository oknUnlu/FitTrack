import { AIResponse, ConversationMessage } from './types';
import { buildSystemPrompt } from './promptBuilder';
import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * Send a message to Gemini via backend proxy with full conversation history.
 */
export async function sendToGemini(
  prompt: string,
  context: string,
  history: ConversationMessage[] = []
): Promise<AIResponse> {
  try {
    let systemInstruction = buildSystemPrompt();
    if (context.trim()) {
      systemInstruction += '\n\n=== KULLANICI PROFİLİ VE VERİLERİ ===\n' + context;
    }

    // Convert conversation history to server format
    const serverHistory = history.slice(-20).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('model' as const),
      content: msg.content,
    }));

    const data = await apiPost<AIResponse>(API_ENDPOINTS.chat, {
      prompt,
      systemInstruction,
      history: serverHistory,
    });

    return data;
  } catch (error: any) {
    return mapGeminiError(error);
  }
}

/**
 * Translate a thrown API error into a typed AIResponse. Known failure causes
 * get a clear, distinct message; everything else is flagged as a network error
 * so the caller can fall back to offline tips.
 */
function mapGeminiError(error: any): AIResponse {
  if (__DEV__) console.warn('[geminiCloud] request failed:', error?.message);
  switch (error?.message) {
    case 'RATE_LIMIT_EXCEEDED':
      return {
        success: false,
        message: 'Günlük istek limitine ulaşıldı. Yarın tekrar deneyin.',
        source: 'fallback',
        errorKind: 'rate_limit',
      };
    case 'SERVICE_UNAVAILABLE':
      return {
        success: false,
        message: 'AI servisi şu an geçici olarak kullanılamıyor (yoğunluk veya aylık limit). Lütfen biraz sonra tekrar deneyin.',
        source: 'fallback',
        errorKind: 'unavailable',
      };
    case 'SAFETY_BLOCKED':
      return {
        success: false,
        message: 'Mesajın güvenlik filtrelerine takıldı. Lütfen farklı bir şekilde ifade etmeyi dene.',
        source: 'fallback',
        errorKind: 'safety',
      };
    default:
      return {
        success: false,
        message: `Gemini hatası: ${error?.message ?? 'bilinmeyen hata'}`,
        source: 'gemini_cloud',
        errorKind: 'network',
      };
  }
}

/**
 * Generate a personalized fitness or nutrition plan via backend proxy.
 */
export async function generatePlan(
  planType: 'workout' | 'nutrition' | 'weekly',
  context: string
): Promise<AIResponse> {
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
    let systemInstruction = buildSystemPrompt();
    if (context.trim()) {
      systemInstruction += '\n\n=== KULLANICI PROFİLİ VE VERİLERİ ===\n' + context;
    }

    const data = await apiPost<AIResponse>(API_ENDPOINTS.plan, {
      planPrompt: planPrompts[planType],
      systemInstruction,
    });

    return data;
  } catch (error: any) {
    return mapGeminiError(error);
  }
}
