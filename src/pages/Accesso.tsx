import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../firebase';
import { useAuth } from '../lib/auth';
import { registraProfilo } from '../lib/dati';
import { Intestazione } from '../components/Layout';

const messaggi: Record<string, string> = {
  'auth/invalid-credential': 'Email o password non corrette.',
  'auth/email-already-in-use': 'Esiste già un account con questa email: accedi.',
  'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
  'auth/invalid-email': 'Email non valida.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/operation-not-allowed': 'L\'accesso con email e password non è attivo: abilitalo in Firebase → Authentication → Metodo di accesso.',
  'auth/configuration-not-found': 'Authentication non è ancora attivo nel progetto Firebase: in console apri Authentication → Inizia, poi abilita Email/password.',
  'permission-denied': 'Il database ha rifiutato il salvataggio del profilo (regole di sicurezza).',
};

export function Accesso() {
  const { utente, ruolo, caricamento, isOrganizzatore, isStaff } = useAuth();
  const [modo, setModo] = useState<'accedi' | 'registrati'>('accedi');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [info, setInfo] = useState('');
  const [invio, setInvio] = useState(false);

  if (caricamento) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (utente && isOrganizzatore) return <Navigate to="/admin" replace />;
  if (utente && isStaff) return <Navigate to="/staff" replace />;

  if (utente) {
    return (
      <>
        <Intestazione titolo="Area riservata" />
        <main className="contenuto">
          <div className="pannello">
            <p>Hai effettuato l'accesso come <strong>{utente.email}</strong>.</p>
            {ruolo === 'in_attesa' ? (
              <p>Il tuo account è <strong>in attesa</strong>: un organizzatore deve abilitarti come staff o organizzatore.</p>
            ) : (
              <p>Il profilo non è ancora completo.</p>
            )}
            <details className="documento">
              <summary>Sei il primo organizzatore?</summary>
              <p>
                Apri la console Firebase → Firestore Database → raccolta <code>users</code> → documento{' '}
                <code>{utente.uid}</code> e cambia il campo <code>ruolo</code> da <code>in_attesa</code> a{' '}
                <code>organizzatore</code>. Poi ricarica questa pagina.
              </p>
            </details>
            {!ruolo && (
              <button
                type="button"
                className="bottone"
                onClick={() =>
                  registraProfilo(utente.uid, utente.email ?? '', nome || (utente.email ?? '')).catch((err) =>
                    setErrore(err instanceof FirebaseError ? messaggi[err.code] ?? `${err.code}: ${err.message}` : 'Errore imprevisto.'),
                  )
                }
              >
                Completa il profilo
              </button>
            )}
            {errore && <p className="avviso errore">{errore}</p>}
            <button type="button" className="bottone contorno" onClick={() => signOut(auth)}>Esci</button>
          </div>
        </main>
      </>
    );
  }

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');
    setInfo('');
    setInvio(true);
    try {
      if (modo === 'accedi') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await registraProfilo(cred.user.uid, cred.user.email ?? email.trim(), nome || email.trim());
      }
    } catch (err) {
      setErrore(err instanceof FirebaseError ? messaggi[err.code] ?? `${err.code}: ${err.message}` : 'Errore imprevisto.');
    } finally {
      setInvio(false);
    }
  };

  const recupera = async () => {
    setErrore('');
    if (!email.trim()) return setErrore('Scrivi prima la tua email.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Ti abbiamo inviato un\'email per reimpostare la password.');
    } catch (err) {
      setErrore(err instanceof FirebaseError ? messaggi[err.code] ?? err.message : 'Errore imprevisto.');
    }
  };

  return (
    <>
      <Intestazione titolo="Area riservata" />
      <main className="contenuto">
        <p className="nota">Accesso per organizzatori e staff. Per iscriverti a un evento non serve un account: <Link to="/">scegli l'evento</Link>.</p>
        <form className="modulo pannello" onSubmit={invia}>
          {modo === 'registrati' && (
            <label>Nome e cognome<input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required /></label>
          )}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'} required minLength={6} /></label>
          {errore && <p className="avviso errore">{errore}</p>}
          {info && <p className="avviso">{info}</p>}
          <button type="submit" className="bottone" disabled={invio}>{modo === 'accedi' ? 'Accedi' : 'Crea account'}</button>
          {modo === 'accedi' ? (
            <div className="riga-link">
              <button type="button" className="link-bottone" onClick={recupera}>Password dimenticata?</button>
              <button type="button" className="link-bottone" onClick={() => setModo('registrati')}>Sono dello staff: crea account</button>
            </div>
          ) : (
            <button type="button" className="link-bottone" onClick={() => setModo('accedi')}>Ho già un account</button>
          )}
        </form>
      </main>
    </>
  );
}
