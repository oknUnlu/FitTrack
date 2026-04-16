import { getMonthlyUsage } from './usageLogger';

const DEFAULT_MONTHLY_LIMIT = 10000;

export async function checkBudget(): Promise<boolean> {
  try {
    const limit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || DEFAULT_MONTHLY_LIMIT;
    const current = await getMonthlyUsage();
    return current < limit;
  } catch {
    return true; // fail-open for budget check
  }
}
