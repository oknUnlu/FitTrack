import { getMonthlyUsage } from './usageLogger';

const DEFAULT_MONTHLY_LIMIT = 10000;

/**
 * Check if the monthly Gemini API budget has been exceeded.
 * Uses MONTHLY_BUDGET_LIMIT env var (default: 10000 calls).
 * Returns true if budget is available, false if exhausted.
 */
export async function checkBudget(): Promise<boolean> {
  try {
    const limit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || DEFAULT_MONTHLY_LIMIT;
    const currentUsage = await getMonthlyUsage();
    return currentUsage < limit;
  } catch (error) {
    console.error('Budget check failed:', error);
    // Fail-open: allow requests if budget check fails
    return true;
  }
}
