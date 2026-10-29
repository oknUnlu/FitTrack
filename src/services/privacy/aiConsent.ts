import { create } from 'zustand';
import { useConsentStore } from '../../store/consentStore';

interface AiConsentState {
  visible: boolean;
  pending: ((value: boolean) => void) | null;
  show: (resolve: (value: boolean) => void) => void;
  settle: (value: boolean) => void;
}

export const useAiConsentStore = create<AiConsentState>((set, get) => ({
  visible: false,
  pending: null,

  show: (resolve) => {
    const previous = get().pending;
    set({ visible: true, pending: resolve });
    if (previous) previous(false);
  },

  settle: (value) => {
    const pending = get().pending;
    set({ visible: false, pending: null });
    pending?.(value);
  },
}));

/**
 * Resolves true only when the user has already granted AI data sharing or
 * explicitly accepts the standalone AI consent dialog. Declining resolves
 * false without persisting anything; callers must abort the AI request.
 */
export async function ensureAiConsent(): Promise<boolean> {
  if (useConsentStore.getState().hasGranted('aiDataSharing')) return true;

  return new Promise<boolean>((resolve) => {
    useAiConsentStore.getState().show(resolve);
  });
}
