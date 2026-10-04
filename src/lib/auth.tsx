import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Ruolo } from '../types';

interface StatoAuth {
  utente: User | null;
  ruolo: Ruolo | null;
  caricamento: boolean;
  isStaff: boolean;
  isOrganizzatore: boolean;
}

const Ctx = createContext<StatoAuth>({
  utente: null,
  ruolo: null,
  caricamento: true,
  isStaff: false,
  isOrganizzatore: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null>(null);
  const [ruolo, setRuolo] = useState<Ruolo | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let stopProfilo: (() => void) | undefined;
    const stop = onAuthStateChanged(auth, (u) => {
      stopProfilo?.();
      setUtente(u);
      if (!u) {
        setRuolo(null);
        setCaricamento(false);
        return;
      }
      stopProfilo = onSnapshot(
        doc(db, 'users', u.uid),
        (d) => {
          setRuolo(d.exists() ? (d.data().ruolo as Ruolo) : null);
          setCaricamento(false);
        },
        () => {
          setRuolo(null);
          setCaricamento(false);
        },
      );
    });
    return () => {
      stopProfilo?.();
      stop();
    };
  }, []);

  const isOrganizzatore = ruolo === 'organizzatore';
  const isStaff = isOrganizzatore || ruolo === 'staff';
  return (
    <Ctx.Provider value={{ utente, ruolo, caricamento, isStaff, isOrganizzatore }}>{children}</Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx);
