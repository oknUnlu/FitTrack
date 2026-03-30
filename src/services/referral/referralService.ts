import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import { getDeviceToken } from '../api/apiClient';

const REFERRAL_CODE_KEY = 'fittrack_referral_code';
const REFERRED_BY_KEY = 'fittrack_referred_by';
const REFERRAL_COUNT_KEY = 'fittrack_referral_count';
const REFERRAL_REWARD_KEY = 'fittrack_referral_reward_until';

const REWARD_DAYS = 7; // 7 days premium per referral

/**
 * Generate or retrieve the user's unique referral code.
 * Based on device token for consistency.
 */
export async function getReferralCode(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (stored) return stored;

    // Generate from device token (first 8 chars) + random suffix
    const token = await getDeviceToken();
    const base = token.replace(/-/g, '').substring(0, 6).toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const code = `FT${base}${suffix}`;

    await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
    return code;
  } catch {
    return 'FTDEFAULT';
  }
}

/**
 * Get the referral invite link.
 */
export async function getReferralLink(): Promise<string> {
  const code = await getReferralCode();
  return `https://fittrack.app/invite?ref=${code}`;
}

/**
 * Share the referral invite via native share sheet.
 */
export async function shareReferralInvite(message: string): Promise<boolean> {
  try {
    const link = await getReferralLink();
    const fullMessage = `${message}\n\n${link}`;

    const result = await Share.share({
      message: fullMessage,
      url: Platform.OS === 'ios' ? link : undefined,
    });

    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * Record that this user was referred by someone.
 */
export async function setReferredBy(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REFERRED_BY_KEY, code);
  } catch {
    // silently fail
  }
}

/**
 * Get the code of who referred this user.
 */
export async function getReferredBy(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REFERRED_BY_KEY);
  } catch {
    return null;
  }
}

/**
 * Increment the successful referral count.
 */
export async function incrementReferralCount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_COUNT_KEY);
    const count = (stored ? parseInt(stored, 10) : 0) + 1;
    await AsyncStorage.setItem(REFERRAL_COUNT_KEY, String(count));
    return count;
  } catch {
    return 0;
  }
}

/**
 * Get the total number of successful referrals.
 */
export async function getReferralCount(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_COUNT_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Grant referral reward: extend temporary premium by REWARD_DAYS.
 */
export async function grantReferralReward(): Promise<Date> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
    const now = new Date();

    // Extend from existing expiry or from now
    const baseDate = stored ? new Date(Math.max(new Date(stored).getTime(), now.getTime())) : now;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + REWARD_DAYS);

    await AsyncStorage.setItem(REFERRAL_REWARD_KEY, newExpiry.toISOString());
    return newExpiry;
  } catch {
    return new Date();
  }
}

/**
 * Check if user currently has an active referral reward.
 */
export async function hasActiveReferralReward(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
    if (!stored) return false;
    return new Date(stored).getTime() > Date.now();
  } catch {
    return false;
  }
}

/**
 * Get referral reward expiry date.
 */
export async function getReferralRewardExpiry(): Promise<Date | null> {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_REWARD_KEY);
    if (!stored) return null;
    const date = new Date(stored);
    return date.getTime() > Date.now() ? date : null;
  } catch {
    return null;
  }
}
