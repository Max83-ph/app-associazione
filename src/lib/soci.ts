import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Avviso, DatiSocio, StatoSocio, Socio, Tessera } from '../types';
import { normalizzaCF } from './codiceFiscale';

const soci = collection(db, 'soci');
const avvisi = collection(db, 'avvisi');

const conId = <T,>(id: string, data: unknown) => ({ id, ...(data as object) }) as T;
const perNome = (a: Socio, b: Socio) =>
  (a.cognome + ' ' + a.nome).localeCompare(b.cognome + ' ' + b.nome, 'it');

export const annoCorrente = () => String(new Date().getFullYear());

/** Ripulisce i dati prima del salvataggio (spazi, maiuscole dove servono). */
export function pulisci(d: DatiSocio): DatiSocio {
  const t = (s: string) => s.trim().replace(/\s+/g, ' ');
  return {
    nome: t(d.nome),
    cognome: t(d.cognome),
    dataNascita: d.dataNascita,
    luogoNascita: t(d.luogoNascita),
    codiceFiscale: normalizzaCF(d.codiceFiscale),
    residenza: {
      indirizzo: t(d.residenza.indirizzo),
      cap: d.residenza.cap.trim(),
      comune: t(d.residenza.comune),
      provincia: d.residenza.provincia.trim().toUpperCase(),
    },
    email: d.email.trim().toLowerCase(),
    cellulare: d.cellulare.replace(/[^\d+]/g, ''),
    consensi: { ...d.consensi },
  };
}

// ---------- Il socio stesso ----------

export function ascoltaMioSocio(uid: string, cb: (s: Socio | null) => void, err: (e: Error) => void) {
  return onSnapshot(doc(soci, uid), (d) => cb(d.exists() ? conId<Socio>(d.id, d.data()) : null), err);
}

/** Richiesta di adesione: il documento ha come ID l'uid dell'account. */
export async function inviaRichiesta(uid: string, dati: DatiSocio, firma: string) {
  await setDoc(doc(soci, uid), {
    ...pulisci(dati),
    uid,
    firma,
    firmatoIl: serverTimestamp(),
    stato: 'in_attesa',
    tessere: {},
    note: '',
    creatoDa: 'socio',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export type ModificheSocio = Pick<DatiSocio, 'residenza' | 'email' | 'cellulare' | 'consensi'>;

/** Il socio aggiorna contatti, residenza e preferenze. */
export async function aggiornaMieiDati(uid: string, m: ModificheSocio) {
  await updateDoc(doc(soci, uid), {
    residenza: m.residenza,
    email: m.email.trim().toLowerCase(),
    cellulare: m.cellulare.replace(/[^\d+]/g, ''),
    consensi: { ...m.consensi, privacy: true },
    updatedAt: serverTimestamp(),
  });
}

// ---------- Gestione (organizzatori) ----------

export function ascoltaSoci(cb: (s: Socio[]) => void, err: (e: Error) => void) {
  return onSnapshot(soci, (snap) => cb(snap.docs.map((d) => conId<Socio>(d.id, d.data())).sort(perNome)), err);
}

export function ascoltaSocio(id: string, cb: (s: Socio | null) => void, err: (e: Error) => void) {
  return onSnapshot(doc(soci, id), (d) => cb(d.exists() ? conId<Socio>(d.id, d.data()) : null), err);
}

/** Socio inserito dall'admin (per chi non usa l'app): attivo da subito, senza account. */
export async function creaSocioAdmin(dati: DatiSocio, firma: string): Promise<string> {
  const ref = await addDoc(soci, {
    ...pulisci(dati),
    uid: null,
    firma,
    firmatoIl: serverTimestamp(),
    stato: 'attivo',
    tessere: {},
    note: '',
    creatoDa: 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function aggiornaSocioAdmin(id: string, dati: DatiSocio, nuovaFirma: string | null) {
  const extra: Record<string, unknown> = nuovaFirma ? { firma: nuovaFirma, firmatoIl: serverTimestamp() } : {};
  await updateDoc(doc(soci, id), { ...pulisci(dati), ...extra, updatedAt: serverTimestamp() });
}

export async function impostaStato(id: string, stato: StatoSocio) {
  await updateDoc(doc(soci, id), { stato, updatedAt: serverTimestamp() });
}

export async function impostaNote(id: string, note: string) {
  await updateDoc(doc(soci, id), { note, updatedAt: serverTimestamp() });
}

export async function impostaTessera(id: string, anno: string, t: Omit<Tessera, 'pagataIl'>, giaPagata: boolean) {
  const pagataIl: FieldValue | null | undefined = t.quotaPagata ? (giaPagata ? undefined : serverTimestamp()) : null;
  await updateDoc(doc(soci, id), {
    [`tessere.${anno}.numero`]: t.numero.trim(),
    [`tessere.${anno}.quotaPagata`]: t.quotaPagata,
    ...(pagataIl !== undefined ? { [`tessere.${anno}.pagataIl`]: pagataIl } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function eliminaSocio(id: string) {
  await deleteDoc(doc(soci, id));
}

/** Prossimo numero di tessera libero per l'anno. */
export function prossimoNumero(lista: Socio[], anno: string): string {
  const numeri = lista.map((s) => parseInt(s.tessere?.[anno]?.numero ?? '', 10)).filter((n) => !Number.isNaN(n));
  return String((numeri.length ? Math.max(...numeri) : 0) + 1);
}

// ---------- Bacheca ----------

export function ascoltaAvvisi(cb: (a: Avviso[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    avvisi,
    (snap) =>
      cb(
        snap.docs
          .map((d) => conId<Avviso>(d.id, d.data()))
          .sort((a, b) => Number(b.inEvidenza) - Number(a.inEvidenza) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
      ),
    err,
  );
}

export async function salvaAvviso(id: string | null, a: { titolo: string; testo: string; inEvidenza: boolean }, autore: string) {
  const dati = { titolo: a.titolo.trim(), testo: a.testo.trim(), inEvidenza: a.inEvidenza };
  if (id) await updateDoc(doc(avvisi, id), dati);
  else await addDoc(avvisi, { ...dati, autore, createdAt: serverTimestamp() });
}

export async function eliminaAvviso(id: string) {
  await deleteDoc(doc(avvisi, id));
}
