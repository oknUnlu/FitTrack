import { create } from 'zustand';
import {
  WorkoutSession,
  ExerciseSet,
  Exercise,
  WorkoutTemplate,
  getRecentSessions,
  getSessionsByDate,
  getActiveSession,
  insertSession,
  updateSession,
  getSetsBySession,
  insertSet,
  getAllExercises,
  getAllTemplates,
  getTotalCaloriesBurnedByDate,
} from '../services/database/workoutDao';

interface WorkoutState {
  // Data
  sessions: WorkoutSession[];
  activeSession: WorkoutSession | null;
  currentSets: ExerciseSet[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  todayCaloriesBurned: number;
  isLoading: boolean;

  // Actions
  loadRecentSessions: (userId: string, limit?: number) => Promise<void>;
  loadSessionsByDate: (userId: string, date: string) => Promise<void>;
  loadActiveSession: (userId: string) => Promise<void>;
  startSession: (session: WorkoutSession) => Promise<void>;
  completeSession: (session: WorkoutSession) => Promise<void>;
  loadSetsForSession: (sessionId: string) => Promise<void>;
  addSet: (set: ExerciseSet) => Promise<void>;
  loadExercises: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadTodayCaloriesBurned: (userId: string, date: string) => Promise<void>;
  clearActiveSession: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  sessions: [],
  activeSession: null,
  currentSets: [],
  exercises: [],
  templates: [],
  todayCaloriesBurned: 0,
  isLoading: false,

  loadRecentSessions: async (userId, limit = 10) => {
    set({ isLoading: true });
    try {
      const sessions = await getRecentSessions(userId, limit);
      set({ sessions, isLoading: false });
    } catch (e) {
      console.warn('Failed to load recent sessions:', e);
      set({ isLoading: false });
    }
  },

  loadSessionsByDate: async (userId, date) => {
    try {
      const sessions = await getSessionsByDate(userId, date);
      set({ sessions });
    } catch (e) {
      console.warn('Failed to load sessions by date:', e);
    }
  },

  loadActiveSession: async (userId) => {
    try {
      const activeSession = await getActiveSession(userId);
      set({ activeSession });
    } catch (e) {
      console.warn('Failed to load active session:', e);
    }
  },

  startSession: async (session) => {
    await insertSession(session);
    set({ activeSession: session });
  },

  completeSession: async (session) => {
    const completed = { ...session, completedAt: Date.now() };
    await updateSession(completed);
    set((state) => ({
      activeSession: null,
      sessions: [completed, ...state.sessions],
    }));
  },

  loadSetsForSession: async (sessionId) => {
    try {
      const currentSets = await getSetsBySession(sessionId);
      set({ currentSets });
    } catch (e) {
      console.warn('Failed to load sets:', e);
    }
  },

  addSet: async (exerciseSet) => {
    await insertSet(exerciseSet);
    set((state) => ({
      currentSets: [...state.currentSets, exerciseSet],
    }));
  },

  loadExercises: async () => {
    try {
      const exercises = await getAllExercises();
      set({ exercises });
    } catch (e) {
      console.warn('Failed to load exercises:', e);
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await getAllTemplates();
      set({ templates });
    } catch (e) {
      console.warn('Failed to load templates:', e);
    }
  },

  loadTodayCaloriesBurned: async (userId, date) => {
    try {
      const todayCaloriesBurned = await getTotalCaloriesBurnedByDate(userId, date);
      set({ todayCaloriesBurned });
    } catch (e) {
      console.warn('Failed to load calories burned:', e);
    }
  },

  clearActiveSession: () => set({ activeSession: null, currentSets: [] }),
}));
