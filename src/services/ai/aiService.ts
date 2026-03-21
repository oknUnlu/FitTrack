import { generateId } from '../../utils/helpers';
import { AIResponse, ConversationMessage } from './types';
import { sendToGemini, initializeGemini } from './geminiCloud';
import { getFallbackResponse } from './fallbackAI';
import { canMakeRequest, recordRequest, getTodayRequestCount, getMaxDailyRequests } from './rateLimiter';
import { insertConversation, getConversations } from '../database/aiDao';

export { initializeGemini } from './geminiCloud';
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
    response = await sendToGemini(prompt, context);
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
