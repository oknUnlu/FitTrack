import AsyncStorage from '@react-native-async-storage/async-storage';

const CHALLENGES_KEY = 'fittrack_challenges';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'steps' | 'workout' | 'calories' | 'water' | 'meditation' | 'custom';
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  icon: string;
  color: string;
}

export async function getChallenges(): Promise<Challenge[]> {
  try {
    const stored = await AsyncStorage.getItem(CHALLENGES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export async function saveChallenges(challenges: Challenge[]): Promise<void> {
  await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
}

export async function addChallenge(challenge: Challenge): Promise<void> {
  const challenges = await getChallenges();
  challenges.push(challenge);
  await saveChallenges(challenges);
}

export async function updateChallengeProgress(id: string, newValue: number): Promise<void> {
  const challenges = await getChallenges();
  const ch = challenges.find((c) => c.id === id);
  if (ch) {
    ch.currentValue = newValue;
    if (newValue >= ch.targetValue) ch.isCompleted = true;
    await saveChallenges(challenges);
  }
}

export async function removeChallenge(id: string): Promise<void> {
  const challenges = await getChallenges();
  await saveChallenges(challenges.filter((c) => c.id !== id));
}

export function getActiveChallenges(challenges: Challenge[]): Challenge[] {
  const today = new Date().toISOString().slice(0, 10);
  return challenges.filter((c) => !c.isCompleted && c.endDate >= today);
}

export function getCompletedChallenges(challenges: Challenge[]): Challenge[] {
  return challenges.filter((c) => c.isCompleted);
}

export const CHALLENGE_TEMPLATES: Omit<Challenge, 'id' | 'startDate' | 'endDate' | 'currentValue' | 'isCompleted'>[] = [
  { title: '10.000 Adım Maratonu', description: '7 gün boyunca günde 10.000 adım', type: 'steps', targetValue: 70000, unit: 'adım', icon: 'walk', color: '#4CAF50' },
  { title: 'Haftalık Antrenman', description: '7 günde 5 antrenman tamamla', type: 'workout', targetValue: 5, unit: 'antrenman', icon: 'dumbbell', color: '#2196F3' },
  { title: 'Su İçme Ustası', description: '7 gün boyunca günlük 2.5L su iç', type: 'water', targetValue: 17500, unit: 'ml', icon: 'water', color: '#00BCD4' },
  { title: 'Kalori Kontrolü', description: '7 gün boyunca hedef kaloride kal', type: 'calories', targetValue: 7, unit: 'gün', icon: 'fire', color: '#FF9800' },
  { title: 'Meditasyon Challenge', description: '7 gün boyunca günde 10dk meditasyon', type: 'meditation', targetValue: 70, unit: 'dk', icon: 'meditation', color: '#9C27B0' },
];
