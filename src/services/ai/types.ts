export type AISource = 'gemini_cloud' | 'gemini_nano' | 'fallback';

export type AIErrorKind = 'rate_limit' | 'unavailable' | 'safety' | 'network' | 'consent_required';

export interface AIResponse {
  success: boolean;
  message: string;
  source: AISource;
  // Present only when success is false. Lets the caller decide whether to use
  // the offline canned fallback (network/unknown) or surface a specific
  // message (rate limit, budget/unavailable, safety) instead of silently
  // returning the same generic reply every time.
  errorKind?: AIErrorKind;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: AISource;
  timestamp: number;
}
