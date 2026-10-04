import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Questi valori identificano il progetto e sono pubblici per natura:
// la protezione dei dati la fanno le regole in firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyC_BfTDhiRA-6nr9X6VvWikF0tjdUw8dYM',
  authDomain: 'cappu-events.firebaseapp.com',
  projectId: 'cappu-events',
  storageBucket: 'cappu-events.firebasestorage.app',
  messagingSenderId: '240603366206',
  appId: '1:240603366206:web:de3530f66497495525226f',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
