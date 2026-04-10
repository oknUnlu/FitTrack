import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

interface PromoValidationResponse {
  success: boolean;
  plan: string;
  durationDays: number;
  expiresAt: number;
  message?: string;
}

/**
 * Validate a promo code via the server-side API.
 * Returns plan details on success, throws on failure.
 */
export async function validatePromoCode(code: string): Promise<PromoValidationResponse> {
  return apiPost<PromoValidationResponse>(API_ENDPOINTS.promo, { code });
}
