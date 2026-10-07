// Crea (o promuove) un organizzatore: account Firebase Authentication + profilo
// in Firestore con ruolo "organizzatore". Lo usa il workflow "Crea organizzatore".
// L'account nasce con una password casuale che nessuno conosce: la persona la
// imposta da sola con "Password dimenticata?" nella pagina Area riservata.
import { randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const email = (process.env.EMAIL ?? '').trim().toLowerCase();
const nome = (process.env.NOME ?? '').trim() || email;
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`::error::Email non valida: "${email}"`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'cappu-events' });
const auth = getAuth();
const db = getFirestore();

let utente;
try {
  utente = await auth.getUserByEmail(email);
  console.log(`Account già esistente per ${email}: lo promuovo a organizzatore.`);
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e;
  utente = await auth.createUser({ email, password: randomBytes(24).toString('base64url'), displayName: nome });
  console.log(`Creato l'account per ${email}.`);
}

const rif = db.collection('users').doc(utente.uid);
const esistente = await rif.get();
await rif.set(
  esistente.exists
    ? { ruolo: 'organizzatore' }
    : { email, nome, ruolo: 'organizzatore', createdAt: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log(`Fatto: ${email} è organizzatore. Per la password: Area riservata → "Password dimenticata?".`);
