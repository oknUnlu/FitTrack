import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDe7pFrbvG37BM1glWhGrTypDUt2Pa8Tbw',
  authDomain: 'fittrack-a958c.firebaseapp.com',
  projectId: 'fittrack-a958c',
  storageBucket: 'fittrack-a958c.firebasestorage.app',
  messagingSenderId: '842377493007',
  appId: '1:842377493007:web:a4d770f8fdddaab5a8017a',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== '';
}
