import AsyncStorage from '@react-native-async-storage/async-storage';

const WELLNESS_KEY = 'fittrack_wellness';

export interface WellnessEntry {
  id: string;
  date: string;
  sleepHours: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  energyLevel: 1 | 2 | 3 | 4 | 5;
  meditationMinutes: number;
  notes: string;
}

export async function getWellnessEntries(): Promise<WellnessEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(WELLNESS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export async function saveWellnessEntries(entries: WellnessEntry[]): Promise<void> {
  await AsyncStorage.setItem(WELLNESS_KEY, JSON.stringify(entries));
}

export async function addWellnessEntry(entry: WellnessEntry): Promise<void> {
  const entries = await getWellnessEntries();
  // Replace if same date exists
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  await saveWellnessEntries(entries);
}

export async function getWellnessEntryByDate(date: string): Promise<WellnessEntry | null> {
  const entries = await getWellnessEntries();
  return entries.find((e) => e.date === date) || null;
}

export async function getWellnessStats(days: number): Promise<{
  avgSleep: number;
  avgStress: number;
  avgEnergy: number;
  avgMeditation: number;
  totalEntries: number;
  moodDistribution: Record<string, number>;
}> {
  const entries = await getWellnessEntries();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filtered = entries.filter((e) => e.date >= cutoffStr);

  if (filtered.length === 0) {
    return { avgSleep: 0, avgStress: 0, avgEnergy: 0, avgMeditation: 0, totalEntries: 0, moodDistribution: {} };
  }

  const moodDistribution: Record<string, number> = {};
  let totalSleep = 0, totalStress = 0, totalEnergy = 0, totalMeditation = 0;

  for (const e of filtered) {
    totalSleep += e.sleepHours;
    totalStress += e.stressLevel;
    totalEnergy += e.energyLevel;
    totalMeditation += e.meditationMinutes;
    moodDistribution[e.mood] = (moodDistribution[e.mood] || 0) + 1;
  }

  const n = filtered.length;
  return {
    avgSleep: Math.round((totalSleep / n) * 10) / 10,
    avgStress: Math.round((totalStress / n) * 10) / 10,
    avgEnergy: Math.round((totalEnergy / n) * 10) / 10,
    avgMeditation: Math.round(totalMeditation / n),
    totalEntries: n,
    moodDistribution,
  };
}
