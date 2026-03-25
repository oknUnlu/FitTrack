import { generateId } from '../../utils/helpers';
import { AIResponse, ConversationMessage } from './types';
import { sendToGemini, initializeGemini, isGeminiInitialized, generatePlan } from './geminiCloud';
import { getFallbackResponse } from './fallbackAI';
import { canMakeRequest, recordRequest, getTodayRequestCount, getMaxDailyRequests } from './rateLimiter';
import { insertConversation, getConversations } from '../database/aiDao';

export { initializeGemini, isGeminiInitialized } from './geminiCloud';
export { getTodayRequestCount, getMaxDailyRequests } from './rateLimiter';

export async function sendMessage(
  userId: string,
  prompt: string,
  context: string
): Promise<AIResponse> {
  // Save user message
  await insertConversation({
    id: generateId(),
    userId,
    role: 'user',
    content: prompt,
    source: 'gemini_cloud',
    createdAt: Date.now(),
  });

  let response: AIResponse;

  // Try Gemini Cloud first
  const canRequest = await canMakeRequest();
  if (canRequest) {
    // Load recent conversation history for multi-turn context
    const history = await getChatHistory(userId);
    response = await sendToGemini(prompt, context, history);
    if (response.success) {
      await recordRequest();
    } else {
      // Fallback
      response = getFallbackResponse(prompt);
    }
  } else {
    response = getFallbackResponse(prompt);
  }

  // Save AI response
  await insertConversation({
    id: generateId(),
    userId,
    role: 'assistant',
    content: response.message,
    source: response.source,
    createdAt: Date.now(),
  });

  return response;
}

export async function getChatHistory(userId: string): Promise<ConversationMessage[]> {
  const convs = await getConversations(userId);
  return convs.map((c) => ({
    id: c.id,
    role: c.role,
    content: c.content,
    source: c.source,
    timestamp: c.createdAt,
  }));
}

export async function requestPlan(
  userId: string,
  planType: 'workout' | 'nutrition' | 'weekly',
  context: string
): Promise<AIResponse> {
  const canRequest = await canMakeRequest();
  if (!canRequest) {
    return {
      success: false,
      message: 'Günlük istek limitine ulaşıldı. Yarın tekrar deneyin.',
      source: 'fallback',
    };
  }

  const response = await generatePlan(planType, context);
  if (response.success) {
    await recordRequest();
    // Save the plan as a conversation entry
    await insertConversation({
      id: generateId(),
      userId,
      role: 'assistant',
      content: response.message,
      source: response.source,
      createdAt: Date.now(),
    });
  }

  return response;
}
