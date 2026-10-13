// Pagine comunicazioni: messaggi al volo per chi ha il link (o il codice).
// comunicazioni/{CODICE}              → titolo, attiva
// comunicazioni/{CODICE}/messaggi/{m} → titolo, testo, allegati, data
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { eliminaFiles, type RifFile } from './file';

export interface PaginaComunicazioni {
  codice: string;
  titolo: string;
  attiva: boolean;
  createdAt?: Timestamp;
}

export interface Messaggio {
  id: string;
  titolo: string;
  testo: string;
  allegati: RifFile[];
  inEvidenza: boolean;
  createdAt: Timestamp | null;
  modificatoIl?: Timestamp;
}

const col = collection(db, 'comunicazioni');
const messaggi = (codice: string) => collection(db, 'comunicazioni', codice, 'messaggi');

// Niente 0/O, 1/I/L: si legge e si detta senza errori.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function nuovoCodice(): string {
  const r = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(r, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export const normalizzaCodice = (c: string) => c.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
export const codiceValido = (c: string) => /^[A-Z0-9]{8,30}$/.test(c);
/** "7K3MQ9XR2B" → "7K3M-Q9XR-2B" (i trattini sono solo per leggerlo meglio). */
export const codiceLeggibile = (c: string) => c.match(/.{1,4}/g)?.join('-') ?? c;
export const linkPagina = (codice: string) => `${window.location.origin}/c/${codice}`;

export function ascoltaPagina(codice: string, cb: (p: PaginaComunicazioni | null) => void) {
  return onSnapshot(doc(col, codice), (d) => cb(d.exists() ? ({ codice: d.id, ...d.data() } as PaginaComunicazioni) : null), () => cb(null));
}

export function ascoltaMessaggi(codice: string, cb: (m: Messaggio[]) => void, err?: (e: Error) => void) {
  return onSnapshot(
    query(messaggi(codice), orderBy('createdAt', 'desc')),
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, allegati: [], inEvidenza: false, ...d.data() }) as unknown as Messaggio)
          .sort((a, b) => Number(b.inEvidenza) - Number(a.inEvidenza)),
      ),
    (e) => err?.(e),
  );
}

export function ascoltaTuttePagine(cb: (l: PaginaComunicazioni[]) => void, err: (e: Error) => void) {
  return onSnapshot(col, (s) => cb(s.docs.map((d) => ({ codice: d.id, ...d.data() }) as PaginaComunicazioni).sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'))), err);
}

export class CodiceGiaUsato extends Error {}

export async function creaPagina(titolo: string, codice: string) {
  const c = normalizzaCodice(codice);
  const esistenti = await getDocs(col);
  if (esistenti.docs.some((d) => d.id === c)) throw new CodiceGiaUsato('Questo codice è già usato da un\'altra pagina.');
  await setDoc(doc(col, c), { titolo: titolo.trim(), attiva: true, createdAt: serverTimestamp() });
  return c;
}

export async function aggiornaPagina(codice: string, dati: Partial<Pick<PaginaComunicazioni, 'titolo' | 'attiva'>>) {
  await updateDoc(doc(col, codice), dati);
}

/** Cambia codice (e quindi link): copia pagina e messaggi sul nuovo, poi cancella il vecchio. */
export async function cambiaCodice(p: PaginaComunicazioni, nuovo: string): Promise<string> {
  const c = normalizzaCodice(nuovo);
  const esistenti = await getDocs(col);
  if (esistenti.docs.some((d) => d.id === c)) throw new CodiceGiaUsato('Questo codice è già usato da un\'altra pagina.');
  const vecchi = await getDocs(messaggi(p.codice));
  const b = writeBatch(db);
  b.set(doc(col, c), { titolo: p.titolo, attiva: p.attiva, createdAt: p.createdAt ?? serverTimestamp() });
  vecchi.docs.forEach((m) => {
    b.set(doc(messaggi(c), m.id), m.data());
    b.delete(m.ref);
  });
  b.delete(doc(col, p.codice));
  await b.commit();
  return c;
}

export async function eliminaPagina(p: PaginaComunicazioni) {
  const vecchi = await getDocs(messaggi(p.codice));
  const file = vecchi.docs.flatMap((m) => ((m.data().allegati ?? []) as RifFile[]).map((f) => f.id));
  const b = writeBatch(db);
  vecchi.docs.forEach((m) => b.delete(m.ref));
  b.delete(doc(col, p.codice));
  await b.commit();
  await eliminaFiles(file);
}

export interface DatiMessaggio { titolo: string; testo: string; allegati: RifFile[]; inEvidenza: boolean }

export async function salvaMessaggio(codice: string, id: string | null, m: DatiMessaggio, prima: RifFile[] = []) {
  const dati = { titolo: m.titolo.trim(), testo: m.testo.trim(), allegati: m.allegati, inEvidenza: m.inEvidenza };
  if (id) await updateDoc(doc(messaggi(codice), id), { ...dati, modificatoIl: serverTimestamp() });
  else await addDoc(messaggi(codice), { ...dati, createdAt: serverTimestamp() });
  await eliminaFiles(prima.filter((f) => !m.allegati.some((x) => x.id === f.id)).map((f) => f.id));
}

export async function eliminaMessaggio(codice: string, m: Messaggio) {
  await deleteDoc(doc(messaggi(codice), m.id));
  await eliminaFiles(m.allegati.map((f) => f.id));
}

// Codici aperti su questo telefono, per ritrovarli da Info (solo comodità: può non funzionare).
const CHIAVE = 'pagine-comunicazioni';
export function ricordaCodice(codice: string, titolo: string) {
  try {
    const l = codiciRicordati().filter((x) => x.codice !== codice);
    localStorage.setItem(CHIAVE, JSON.stringify([{ codice, titolo }, ...l].slice(0, 10)));
  } catch { /* niente memoria: pazienza */ }
}
export function dimenticaCodice(codice: string) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(codiciRicordati().filter((x) => x.codice !== codice))); } catch { /* */ }
}
export function codiciRicordati(): { codice: string; titolo: string }[] {
  try { return JSON.parse(localStorage.getItem(CHIAVE) ?? '[]'); } catch { return []; }
}
