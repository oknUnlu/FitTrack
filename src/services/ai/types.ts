export type AISource = 'gemini_cloud' | 'gemini_nano' | 'fallback';

export interface AIResponse {
  success: boolean;
  message: string;
  source: AISource;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: AISource;
  timestamp: number;
}
