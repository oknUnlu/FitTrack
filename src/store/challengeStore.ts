import { create } from 'zustand';
import {
  Challenge,
  getChallenges,
  addChallenge,
  removeChallenge,
  updateChallengeProgress,
  getActiveChallenges,
  getCompletedChallenges,
} from '../services/social/challengeService';

interface ChallengeState {
  challenges: Challenge[];
  activeChallenges: Challenge[];
  completedChallenges: Challenge[];
  isLoading: boolean;

  loadChallenges: () => Promise<void>;
  addNewChallenge: (challenge: Challenge) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  updateProgress: (id: string, newValue: number) => Promise<void>;
}

export const useChallengeStore = create<ChallengeState>((set) => ({
  challenges: [],
  activeChallenges: [],
  completedChallenges: [],
  isLoading: false,

  loadChallenges: async () => {
    set({ isLoading: true });
    try {
      const challenges = await getChallenges();
      set({
        challenges,
        activeChallenges: getActiveChallenges(challenges),
        completedChallenges: getCompletedChallenges(challenges),
        isLoading: false,
      });
    } catch (e) {
      if (__DEV__) console.warn('Failed to load challenges:', e);
      set({ isLoading: false });
    }
  },

  addNewChallenge: async (challenge) => {
    await addChallenge(challenge);
    set((state) => {
      const challenges = [...state.challenges, challenge];
      return {
        challenges,
        activeChallenges: getActiveChallenges(challenges),
        completedChallenges: getCompletedChallenges(challenges),
      };
    });
  },

  deleteChallenge: async (id) => {
    await removeChallenge(id);
    set((state) => {
      const challenges = state.challenges.filter((c) => c.id !== id);
      return {
        challenges,
        activeChallenges: getActiveChallenges(challenges),
        completedChallenges: getCompletedChallenges(challenges),
      };
    });
  },

  updateProgress: async (id, newValue) => {
    await updateChallengeProgress(id, newValue);
    set((state) => {
      const challenges = state.challenges.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, currentValue: newValue };
        if (newValue >= c.targetValue) updated.isCompleted = true;
        return updated;
      });
      return {
        challenges,
        activeChallenges: getActiveChallenges(challenges),
        completedChallenges: getCompletedChallenges(challenges),
      };
    });
  },
}));
