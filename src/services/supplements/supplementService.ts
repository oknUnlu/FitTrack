import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPPLEMENTS_KEY = 'fittrack_supplements';
const SUPPLEMENT_LOGS_KEY = 'fittrack_supplement_logs';

export interface Supplement {
  id: string;
  name: string;
  dosage: string;
  frequency: 'daily' | 'workout_days' | 'custom';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'pre_workout' | 'post_workout';
  notes: string;
}

export interface SupplementLog {
  supplementId: string;
  date: string;
  taken: boolean;
}

export async function getSupplements(): Promise<Supplement[]> {
  try {
    const stored = await AsyncStorage.getItem(SUPPLEMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export async function saveSupplements(supplements: Supplement[]): Promise<void> {
  await AsyncStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(supplements));
}

export async function addSupplement(supplement: Supplement): Promise<void> {
  const supplements = await getSupplements();
  supplements.push(supplement);
  await saveSupplements(supplements);
}

export async function removeSupplement(id: string): Promise<void> {
  const supplements = await getSupplements();
  await saveSupplements(supplements.filter((s) => s.id !== id));
}

export async function getSupplementLogs(date: string): Promise<SupplementLog[]> {
  try {
    const stored = await AsyncStorage.getItem(`${SUPPLEMENT_LOGS_KEY}_${date}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export async function toggleSupplementLog(supplementId: string, date: string): Promise<void> {
  const logs = await getSupplementLogs(date);
  const existing = logs.find((l) => l.supplementId === supplementId);
  if (existing) {
    existing.taken = !existing.taken;
  } else {
    logs.push({ supplementId, date, taken: true });
  }
  await AsyncStorage.setItem(`${SUPPLEMENT_LOGS_KEY}_${date}`, JSON.stringify(logs));
}

export async function isSupplementTaken(supplementId: string, date: string): Promise<boolean> {
  const logs = await getSupplementLogs(date);
  return logs.find((l) => l.supplementId === supplementId)?.taken ?? false;
}
