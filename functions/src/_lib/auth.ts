import type { Request } from 'firebase-functions/v2/https';

export function getDeviceToken(req: Request): string | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!/^[a-f0-9-]{36}$/i.test(token)) return null;
  return token;
}
