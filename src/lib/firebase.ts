// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('Firebase config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' : undefined
});

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  throw new Error('Missing required Firebase configuration. Please check your environment variables.');
}

// Initialize Firebase only if it hasn't been initialized already
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (error) {
  console.error('Error initializing Firebase:', error);
  throw new Error('Failed to initialize Firebase. Please check your configuration.');
}

const auth = getAuth(app);
const db = getFirestore(app);

// Set persistence before any auth operations
const setAuthPersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('Firebase auth persistence set to local');
  } catch (error) {
    console.error('Error setting persistence:', error);
    // Fallback to in-memory persistence if local persistence fails
    try {
      await setPersistence(auth, inMemoryPersistence);
      console.log('Firebase auth persistence set to in-memory');
    } catch (error) {
      console.error('Error setting in-memory persistence:', error);
    }
  }
};

setAuthPersistence();

export { app, auth, db };