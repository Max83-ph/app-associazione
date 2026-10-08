import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  CONTATTI,
  INFORMATIVA_PRIVACY,
  INFORMATIVA_SOCI,
  LIBERATORIA_FOTO,
  LIBERATORIA_SOCI,
  NOME_ASSOCIAZIONE,
} from '../config';

/** Testi dell'associazione modificabili dal pannello (Gestione → Testi). */
export interface Contatti {
  email: string;
  telefono: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  indirizzo: string;
}

export interface Testi {
  chiSiamo: string;
  informativaPrivacy: string;
  liberatoriaFoto: string;
  informativaSoci: string;
  liberatoriaSoci: string;
  contatti: Contatti;
}

export const CHI_SIAMO_PREDEFINITO = `${NOME_ASSOCIAZIONE} è un'associazione di volontari che organizza feste, pranzi, laboratori per bambini e la sfilata di Carnevale.

[Qui la storia dell'associazione, chi la porta avanti e come partecipare: si modifica da Gestione → Testi.]`;

export const TESTI_PREDEFINITI: Testi = {
  chiSiamo: CHI_SIAMO_PREDEFINITO,
  informativaPrivacy: INFORMATIVA_PRIVACY,
  liberatoriaFoto: LIBERATORIA_FOTO,
  informativaSoci: INFORMATIVA_SOCI,
  liberatoriaSoci: LIBERATORIA_SOCI,
  contatti: { ...CONTATTI },
};

const rif = doc(db, 'contenuti', 'testi');

/** Unisce i testi salvati con quelli predefiniti: un campo vuoto usa il predefinito. */
function unisci(salvati: Partial<Testi> | undefined): Testi {
  const s = salvati ?? {};
  const testo = (k: Exclude<keyof Testi, 'contatti'>) => (typeof s[k] === 'string' && s[k]!.trim() ? s[k]! : TESTI_PREDEFINITI[k]);
  return {
    chiSiamo: testo('chiSiamo'),
    informativaPrivacy: testo('informativaPrivacy'),
    liberatoriaFoto: testo('liberatoriaFoto'),
    informativaSoci: testo('informativaSoci'),
    liberatoriaSoci: testo('liberatoriaSoci'),
    contatti: { ...TESTI_PREDEFINITI.contatti, ...(s.contatti ?? {}) },
  };
}

// Copia sempre aggiornata, per il codice che non è un componente (PDF).
let correnti: Testi = TESTI_PREDEFINITI;
export const testiCorrenti = () => correnti;

const Ctx = createContext<Testi>(TESTI_PREDEFINITI);

export function TestiProvider({ children }: { children: ReactNode }) {
  const [testi, setTesti] = useState<Testi>(TESTI_PREDEFINITI);
  useEffect(
    () =>
      onSnapshot(
        rif,
        (d) => {
          correnti = unisci(d.exists() ? (d.data() as Partial<Testi>) : undefined);
          setTesti(correnti);
        },
        // Se il documento non è leggibile restano i testi predefiniti.
        () => undefined,
      ),
    [],
  );
  return <Ctx.Provider value={testi}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTesti = () => useContext(Ctx);

export async function salvaTesti(t: Testi, autore: string) {
  await setDoc(rif, { ...t, aggiornatoDa: autore, aggiornatoIl: serverTimestamp() });
}
