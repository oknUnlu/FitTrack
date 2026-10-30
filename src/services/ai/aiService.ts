import { generateId } from '../../utils/helpers';
import { AIResponse, ConversationMessage } from './types';
import { sendToGemini, generatePlan } from './geminiCloud';
import { getFallbackResponse } from './fallbackAI';
import { insertConversation, getConversations } from '../database/aiDao';
import { getTodayUsage, getDailyLimit } from './rateLimiter';
import { useConsentStore } from '../../store/consentStore';

export { getTodayUsage, getDailyLimit };

export async function sendMessage(
  userId: string,
  prompt: string,
  context: string
): Promise<AIResponse> {
  // Checked again here (callers are expected to gate via ensureAiConsent
  // first) so a missing/future caller can never persist a conversation
  // turn for a request that was never actually sent.
  if (!useConsentStore.getState().hasGranted('aiDataSharing')) {
    return { success: false, message: '', source: 'fallback', errorKind: 'consent_required' };
  }

  // Load recent conversation history BEFORE saving the current message.
  // Saving first would put the prompt at the end of the history too, so Gemini
  // would see the user's message twice (once as the last turn, once as the live
  // prompt) — which makes it repeat itself.
  const history = await getChatHistory(userId);

  // Save user message
  await insertConversation({
    id: generateId(),
    userId,
    role: 'user',
    content: prompt,
    source: 'gemini_cloud',
    createdAt: Date.now(),
  });

  let response: AIResponse = await sendToGemini(prompt, context, history);

  if (!response.success) {
    // The call failed. Log the real cause so it's clear whether the problem is
    // our backend/API rather than masking everything behind the same canned
    // reply (which looks like the AI "repeating itself").
    if (__DEV__) console.warn('[aiService] sendToGemini failed:', response.errorKind, response.message);

    // Only the offline canned tips for genuine network/unknown failures. Rate
    // limit, budget/unavailable and safety already carry a clear, distinct
    // message, so we keep those untouched.
    if (response.errorKind === 'network' || response.errorKind === undefined) {
      response = getFallbackResponse(prompt);
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
