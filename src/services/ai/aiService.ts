import { generateId } from '../../utils/helpers';
import { AIResponse, ConversationMessage } from './types';
import { sendToGemini, generatePlan } from './geminiCloud';
import { getFallbackResponse } from './fallbackAI';
import { insertConversation, getConversations } from '../database/aiDao';
import { getTodayRequestCount, getMaxDailyRequests } from './rateLimiter';

export { getTodayRequestCount, getMaxDailyRequests };

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

  // Load recent conversation history for multi-turn context
  const history = await getChatHistory(userId);
  response = await sendToGemini(prompt, context, history);

  if (!response.success) {
    // Use fallback if server is unreachable or errors
    const fallback = getFallbackResponse(prompt);
    // Only use fallback if it's a network/server issue, not rate limit
    if (response.message.includes('RATE_LIMIT') || response.message.includes('limitine')) {
      // Keep the rate limit message from server
    } else {
      response = fallback;
    }
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
  const response = await generatePlan(planType, context);

  if (response.success) {
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
