import type { VercelRequest } from '@vercel/node';

/**
 * Extract and validate device token from Authorization header.
 * Format: "Bearer <device-uuid>"
 */
export function getDeviceToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  // Basic UUID format validation
  if (!/^[a-f0-9-]{36}$/i.test(token)) return null;
  return token;
}

export { verifyPremiumStatus } from './premiumVerifier';
