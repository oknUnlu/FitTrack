import { getRedis } from './redis';

type Feature = 'chat' | 'food_recognition' | 'plan';

/**
 * Log a Gemini API call to Redis for usage tracking.
 * Uses Redis hashes with daily and monthly keys for aggregation.
 */
export async function logUsage(feature: Feature, durationMs: number): Promise<void> {
  try {
    const redis = getRedis();
    const now = new Date();
    const dailyKey = `usage:daily:${now.toISOString().split('T')[0]}`;
    const monthlyKey = `usage:monthly:${now.toISOString().slice(0, 7)}`;

    const pipeline = redis.pipeline();

    // Increment feature count
    pipeline.hincrby(dailyKey, `${feature}_count`, 1);
    pipeline.hincrby(monthlyKey, `${feature}_count`, 1);

    // Track total calls
    pipeline.hincrby(dailyKey, 'total_count', 1);
    pipeline.hincrby(monthlyKey, 'total_count', 1);

    // Track cumulative duration (ms)
    pipeline.hincrby(dailyKey, 'total_duration_ms', Math.round(durationMs));
    pipeline.hincrby(monthlyKey, 'total_duration_ms', Math.round(durationMs));

    // Set TTL: daily keys expire after 90 days, monthly after 365 days
    pipeline.expire(dailyKey, 90 * 24 * 60 * 60);
    pipeline.expire(monthlyKey, 365 * 24 * 60 * 60);

    await pipeline.exec();
  } catch (error) {
    // Non-blocking: don't fail the request if logging fails
    console.error('Usage logging failed:', error);
  }
}

/**
 * Get monthly usage count for budget checking.
 */
export async function getMonthlyUsage(): Promise<number> {
  try {
    const redis = getRedis();
    const monthlyKey = `usage:monthly:${new Date().toISOString().slice(0, 7)}`;
    const total = await redis.hget<number>(monthlyKey, 'total_count');
    return total ?? 0;
  } catch {
    return 0;
  }
}
