import { apiPost } from '../api/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import type { RecognizedFood } from './foodRecognition';

/**
 * Text-based AI nutrition estimate. The user types a food name, optionally
 * with a portion (e.g. "1 kase mercimek çorbası"), and the model returns the
 * TOTAL nutritional values for that portion — the same `RecognizedFood` shape
 * the photo flow returns, so callers can reuse the identical totals→per-100g
 * conversion.
 *
 * Returns `null` when the text doesn't describe a recognizable food.
 */
export async function estimateFoodFromText(query: string): Promise<RecognizedFood | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const data = await apiPost<{ success: boolean; food: RecognizedFood | null }>(
    API_ENDPOINTS.foodEstimate,
    { query: trimmed }
  );

  if (!data.success || !data.food) return null;
  return data.food;
}
