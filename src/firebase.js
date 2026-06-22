// Firebase Realtime Database connection.
//
// Configuration is read from Vite environment variables (see .env.example).
// Create a `.env.local` file at the project root with your own Firebase
// project's web config, then restart `npm run dev`.
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// True only when the minimum required keys are present.
export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.databaseURL
);

let db = null;
if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[صِفر] لم يتم ضبط إعدادات Firebase. أنشئ ملف .env.local — راجع README.'
  );
}

export { db };
