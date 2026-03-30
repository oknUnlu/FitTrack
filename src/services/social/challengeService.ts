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

/**
 * Generate a shareable invite link for a challenge.
 */
export function getChallengeInviteLink(challengeId: string): string {
  return `https://fittrack.app/challenges?id=${challengeId}`;
}

export const CHALLENGE_TEMPLATES: Omit<Challenge, 'id' | 'startDate' | 'endDate' | 'currentValue' | 'isCompleted'>[] = [
  // ── Klasik Challenge'lar ──
  { title: '10.000 Adim Maratonu', description: '7 gun boyunca gunde 10.000 adim', type: 'steps', targetValue: 70000, unit: 'adim', icon: 'walk', color: '#4CAF50' },
  { title: 'Haftalik Antrenman', description: '7 gunde 5 antrenman tamamla', type: 'workout', targetValue: 5, unit: 'antrenman', icon: 'dumbbell', color: '#2196F3' },
  { title: 'Su Icme Ustasi', description: '7 gun boyunca gunluk 2.5L su ic', type: 'water', targetValue: 17500, unit: 'ml', icon: 'water', color: '#00BCD4' },
  { title: 'Kalori Kontrolu', description: '7 gun boyunca hedef kaloride kal', type: 'calories', targetValue: 7, unit: 'gun', icon: 'fire', color: '#FF9800' },
  { title: 'Meditasyon Challenge', description: '7 gun boyunca gunde 10dk meditasyon', type: 'meditation', targetValue: 70, unit: 'dk', icon: 'meditation', color: '#9C27B0' },
  // ── Viral Potansiyelli Yeni Challenge'lar ──
  { title: '30 Gun Plank Challenge', description: '30 gun boyunca her gun plank yap', type: 'workout', targetValue: 30, unit: 'gun', icon: 'human', color: '#E91E63' },
  { title: '5K Kosu Hedefi', description: '30 gunde 5K kosabilecek seviyeye gel', type: 'workout', targetValue: 30, unit: 'gun', icon: 'run-fast', color: '#FF5722' },
  { title: 'Protein Hedefi', description: '14 gun boyunca protein hedefini tuttur', type: 'calories', targetValue: 14, unit: 'gun', icon: 'food-steak', color: '#795548' },
  { title: '100 Squat Challenge', description: '7 gunde toplam 700 squat yap', type: 'workout', targetValue: 700, unit: 'squat', icon: 'human-handsup', color: '#3F51B5' },
  { title: 'Erken Kalkis Challenge', description: '7 gun ust uste 07:00 oncesi uyan', type: 'custom', targetValue: 7, unit: 'gun', icon: 'weather-sunny', color: '#FFC107' },
];
