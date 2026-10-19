// Invio del biglietto via email tramite lo script Google del comitato (strumenti/email-biglietti.gs).
// L'indirizzo dello script si imposta da Gestione → Informative e contatti; se manca, l'app non manda email.
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';

const rif = doc(db, 'contenuti', 'email');
export const URL_SCRIPT_VALIDO = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

let urlCorrente: string | null = null;

export function ascoltaConfigEmail(cb: (url: string | null) => void) {
  return onSnapshot(
    rif,
    (d) => {
      const u = d.exists() ? String(d.data().url ?? '') : '';
      urlCorrente = URL_SCRIPT_VALIDO.test(u) ? u : null;
      cb(urlCorrente);
    },
    () => cb(null),
  );
}

/** undefined mentre carica, null se l'invio email non è configurato. */
export function useEmailBiglietti() {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => ascoltaConfigEmail(setUrl), []);
  return url;
}

export async function salvaConfigEmail(url: string) {
  await setDoc(rif, { url: url.trim(), aggiornatoIl: serverTimestamp() });
}

export type EsitoEmail = 'inviata' | 'limite' | 'errore';

export async function inviaBigliettoEmail(codice: string, url = urlCorrente): Promise<EsitoEmail> {
  if (!url) return 'errore';
  try {
    // text/plain: richiesta "semplice", senza preflight CORS (Apps Script non lo gestisce).
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ codice }) });
    const j = (await r.json()) as { ok: boolean; errore?: string };
    if (j.ok) return 'inviata';
    return j.errore === 'limite' ? 'limite' : 'errore';
  } catch {
    return 'errore';
  }
}
