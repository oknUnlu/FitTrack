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

/**
 * AI Calorie Recognition response payload — semantics changed in the
 * "AI Kalori Tanıma" refactor: every numeric value now describes the TOTAL
 * for what is actually visible in the photo (not per-100g). The client
 * converts back to per-100g representation when storing into the local
 * food cache, so the portion picker math stays consistent.
 *
 *   - calories / protein / carbs / fat: total estimated values for the
 *     food shown.
 *   - servingSize: estimated weight (or volume) of the visible portion.
 *   - servingUnit: 'g' or 'ml'.
 *   - servingDescription: short Turkish phrase describing the portion the
 *     model saw, e.g. "1 dilim", "1 kase", "1 porsiyon". Surfaces in the UI
 *     as "AI tahmini: ${servingDescription}".
 *   - confidence: "high" | "medium" | "low".
 */
export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  servingDescription?: string;
  confidence: string;
}

export interface RateLimitConfig {
  feature: string;
  isPremium: boolean;
  deviceId: string;
}
