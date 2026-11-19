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

/** Motivo dell'ultimo invio non riuscito, spiegato per l'admin (pannello Email dei biglietti). */
export let ultimoErroreEmail = '';

function spiega(e: string): string {
  if (e === 'risposta') return 'lo script non ha risposto come app web. Controlla il deployment: tipo "App web", "Esegui come: Me", "Chi ha accesso: Chiunque", e dopo ogni modifica del codice "Gestisci deployment → Nuova versione".';
  if (e === 'rete') return 'lo script non risponde. Apri l\'indirizzo /exec in una finestra in incognito: deve comparire {"ok":true…}. Se chiede di accedere, nel deployment metti "Chi ha accesso: Chiunque"; se dà errore, l\'indirizzo è vecchio: copia quello attuale da "Gestisci deployment" e salvalo qui.';
  if (/permission|autorizz|authoriz/i.test(e)) return 'lo script non ha i permessi: aprilo, esegui la funzione "prova" e consenti l\'accesso, poi pubblica una Nuova versione.';
  if (/troppe volte|too many times|limit/i.test(e)) return 'Gmail ha raggiunto il limite giornaliero di invii: riprova domani.';
  if (e === 'biglietto non trovato') return 'lo script non trova il biglietto (codice sbagliato?).';
  if (e === 'email') return 'la prenotazione non ha un indirizzo email valido.';
  return `lo script ha risposto: ${e}`;
}

/** tipo 'carnevale': iscrizione a "Sfila con noi" (motivo: nuova, prova cambiata, dati modificati). */
export async function inviaBigliettoEmail(codice: string, url = urlCorrente, tipo?: 'carnevale', motivo?: 'nuova' | 'prova' | 'dati'): Promise<EsitoEmail> {
  if (!url) return 'errore';
  try {
    // text/plain: richiesta "semplice", senza preflight CORS (Apps Script non lo gestisce).
    let r: Response;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ codice, tipo, motivo }) });
    } catch {
      ultimoErroreEmail = spiega('rete');
      return 'errore';
    }
    let j: { ok: boolean; errore?: string };
    try {
      j = (await r.json()) as { ok: boolean; errore?: string };
    } catch {
      ultimoErroreEmail = spiega('risposta');
      return 'errore';
    }
    if (j.ok) { ultimoErroreEmail = ''; return 'inviata'; }
    if (j.errore === 'limite') return 'limite';
    ultimoErroreEmail = spiega(String(j.errore ?? 'sconosciuto'));
    return 'errore';
  } catch {
    ultimoErroreEmail = spiega('rete');
    return 'errore';
  }
}
