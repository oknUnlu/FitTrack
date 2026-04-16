export type AISource = 'gemini_cloud' | 'fallback';

export interface AIResponse {
  success: boolean;
  message: string;
  source: AISource;
}

export interface ChatRequest {
  prompt: string;
  systemInstruction: string;
  history: { role: 'user' | 'model'; content: string }[];
}

export interface PlanRequest {
  planPrompt: string;
  systemInstruction: string;
}

export interface FoodRecognitionRequest {
  image: string; // base64
  mimeType: string;
}

export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  confidence: string;
}

export interface RateLimitConfig {
  feature: string;
  isPremium: boolean;
  deviceId: string;
}
