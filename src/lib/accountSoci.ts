// Account dell'app per i soci inseriti dagli organizzatori.
// L'account si crea con una seconda istanza di Firebase Auth, così l'organizzatore
// resta collegato; la password la sceglie il socio dall'email "reimposta password".
import { getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, inMemoryPersistence, initializeAuth, sendPasswordResetEmail, signOut, type Auth } from 'firebase/auth';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { app, auth, db } from '../firebase';
import type { Socio } from '../types';

let authSecondaria: Auth | null = null;
function secondaria(): Auth {
  if (!authSecondaria) {
    const a = getApps().find((x) => x.name === 'creazione-account') ?? initializeApp(app.options, 'creazione-account');
    authSecondaria = initializeAuth(a, { persistence: inMemoryPersistence });
  }
  return authSecondaria;
}

const passwordCasuale = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(36).padStart(2, '0')).join('');

export function messaggioErroreAccount(e: unknown): string {
  const c = e instanceof FirebaseError ? e.code : '';
  if (c === 'auth/email-already-in-use')
    return 'Esiste già un account con questa email (la persona si è già registrata nell\'app). Per non creare un doppione: chiedile di iscriversi dall\'app con quell\'account, poi elimina questa scheda; oppure usa un\'altra email.';
  if (c === 'auth/invalid-email') return 'L\'email del socio non è valida: correggila con "Modifica dati".';
  if (c === 'auth/too-many-requests' || c === 'auth/quota-exceeded') return 'Troppi account creati in poco tempo: riprova tra un\'ora.';
  if (c === 'auth/operation-not-allowed') return 'L\'accesso con email e password non è attivo nel progetto Firebase.';
  return `Operazione non riuscita${c ? ` (${c})` : ''}. Riprova.`;
}

/**
 * Crea l'account con l'email del socio, collega la scheda (che prende come ID l'uid dell'account,
 * come per chi si iscrive dall'app) e invia l'email per scegliere la password.
 * Restituisce il nuovo ID della scheda.
 */
export async function creaAccountSocio(s: Socio): Promise<string> {
  if (s.uid) throw new Error('Il socio ha già un account.');
  const email = s.email.trim().toLowerCase();
  const a2 = secondaria();
  const cred = await createUserWithEmailAndPassword(a2, email, passwordCasuale());
  const uid = cred.user.uid;
  await signOut(a2);

  // Sposta la scheda su soci/{uid}: l'Area soci cerca il socio con l'uid dell'account.
  const { id, ...dati } = s;
  const b = writeBatch(db);
  b.set(doc(db, 'soci', uid), { ...dati, email, uid, accountCreatoIl: serverTimestamp(), updatedAt: serverTimestamp() });
  if (id !== uid) b.delete(doc(db, 'soci', id));
  await b.commit();

  await sendPasswordResetEmail(auth, email);
  return uid;
}

/** Rimanda l'email per scegliere (o reimpostare) la password. */
export async function inviaInvito(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
