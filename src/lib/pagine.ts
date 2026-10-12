// Pagine modificabili dal pannello: tre fisse (Home, Carnevale, Info) e quante pagine nuove si vuole.
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { eliminaFiles, type RifFile } from './file';

export type VisibilitaPagina = 'pubblica' | 'soci';

export interface Pagina {
  id: string;
  titolo: string;
  /** Testo formattato (Markdown semplice). */
  contenuto: string;
  /** Foto (in galleria) e file da scaricare. */
  allegati: RifFile[];
  visibilita: VisibilitaPagina;
  ordine: number;
}

export const PAGINE_FISSE: Record<string, { titolo: string; dove: string }> = {
  home: { titolo: 'Home', dove: 'Testo e foto in cima alla Home, sopra gli eventi.' },
  carnevale: { titolo: 'Carnevale', dove: 'La sezione Carnevale (se vuota mostra "In arrivo").' },
  info: { titolo: 'Chi siamo', dove: 'La pagina Info, sopra i contatti.' },
};

export const isFissa = (id: string) => id in PAGINE_FISSE;

const pagine = collection(db, 'pagine');
const conId = (id: string, d: Partial<Pagina>): Pagina => ({ titolo: '', contenuto: '', allegati: [], visibilita: 'pubblica', ordine: 0, ...d, id });
const perOrdine = (a: Pagina, b: Pagina) => a.ordine - b.ordine || a.titolo.localeCompare(b.titolo, 'it');

/** Una pagina; null se non è ancora stata scritta o non è leggibile da chi guarda. */
export function ascoltaPagina(id: string, cb: (p: Pagina | null) => void) {
  return onSnapshot(doc(pagine, id), (d) => cb(d.exists() ? conId(d.id, d.data()) : null), () => cb(null));
}

/** Le pagine nuove (non fisse) con quella visibilità. */
export function ascoltaPagineLibere(visibilita: VisibilitaPagina, cb: (p: Pagina[]) => void) {
  return onSnapshot(
    query(pagine, where('visibilita', '==', visibilita)),
    (s) => cb(s.docs.map((d) => conId(d.id, d.data())).filter((p) => !isFissa(p.id)).sort(perOrdine)),
    () => cb([]),
  );
}

/** Tutte le pagine, per il pannello. */
export function ascoltaTuttePagine(cb: (p: Pagina[]) => void, err: (e: Error) => void) {
  return onSnapshot(pagine, (s) => cb(s.docs.map((d) => conId(d.id, d.data())).sort(perOrdine)), err);
}

export function idDaTitolo(titolo: string): string {
  const base = titolo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return base && !isFissa(base) ? base : `pagina-${Date.now().toString(36)}`;
}

export async function salvaPagina(p: Pagina, prima: Pagina | null, autore: string) {
  const visibilita: VisibilitaPagina = isFissa(p.id) ? 'pubblica' : p.visibilita;
  await setDoc(doc(pagine, p.id), {
    titolo: p.titolo.trim(),
    contenuto: p.contenuto.trim(),
    allegati: p.allegati,
    visibilita,
    ordine: p.ordine,
    aggiornatoDa: autore,
    aggiornatoIl: serverTimestamp(),
  });
  // I file seguono la visibilità della pagina.
  const v = visibilita === 'pubblica' ? 'pubblico' : 'soci';
  if (p.allegati.length) {
    const b = writeBatch(db);
    p.allegati.forEach((f) => b.update(doc(db, 'file', f.id), { visibilita: v }));
    await b.commit();
  }
  await eliminaFiles((prima?.allegati ?? []).filter((f) => !p.allegati.some((x) => x.id === f.id)).map((f) => f.id));
}

export async function spostaPagina(p: Pagina, ordine: number) {
  await updateDoc(doc(pagine, p.id), { ordine });
}

export async function eliminaPagina(p: Pagina) {
  await deleteDoc(doc(pagine, p.id));
  await eliminaFiles(p.allegati.map((f) => f.id));
}
