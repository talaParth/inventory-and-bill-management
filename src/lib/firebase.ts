import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration
// TODO: Replace with your actual Firebase config
// You can get this from Firebase Console > Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBSfHugjPJ52QBQSuHWt9iGBFhq6wBoh5g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hotel-7ac9f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hotel-7ac9f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hotel-7ac9f.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "102297833385",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:102297833385:web:f5605f4331c2b5f7173eb8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
// Note: Firebase Auth is not initialized since we're using static login (admin/123)
// This helps avoid CORS issues related to credential-based authentication
export const db: Firestore = getFirestore(app);

// Initialize Storage
export const storage: FirebaseStorage = getStorage(app);

export default app;

