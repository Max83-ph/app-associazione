import {
  addDoc,
  getDoc,
  writeBatch,
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
import { eliminaFiles, type RifFile } from './file';

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
export async function inviaRichiesta(uid: string, dati: DatiSocio, firma: string, codiceIscrizione?: string) {
  await setDoc(doc(soci, uid), {
    ...pulisci(dati),
    uid,
    ...(codiceIscrizione ? { codiceIscrizione } : {}),
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
export async function creaSocioAdmin(dati: DatiSocio, firma: string | null, moduloCartaceo: RifFile[] = []): Promise<string> {
  const ref = await addDoc(soci, {
    ...pulisci(dati),
    uid: null,
    firma,
    firmatoIl: firma ? serverTimestamp() : null,
    moduloCartaceo,
    stato: 'attivo',
    tessere: {},
    note: '',
    creatoDa: 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function aggiornaSocioAdmin(id: string, dati: DatiSocio, nuovaFirma: string | null, moduloCartaceo?: RifFile[], moduliPrima: RifFile[] = []) {
  const extra: Record<string, unknown> = nuovaFirma ? { firma: nuovaFirma, firmatoIl: serverTimestamp() } : {};
  if (moduloCartaceo) extra.moduloCartaceo = moduloCartaceo;
  await updateDoc(doc(soci, id), { ...pulisci(dati), ...extra, updatedAt: serverTimestamp() });
  if (moduloCartaceo) await eliminaFiles(moduliPrima.filter((f) => !moduloCartaceo.some((x) => x.id === f.id)).map((f) => f.id));
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

export interface DatiAvviso { titolo: string; testo: string; inEvidenza: boolean; allegati: RifFile[] }

/** Salva l'avviso; i file tolti durante la modifica vengono eliminati dall'archivio. */
export async function salvaAvviso(id: string | null, a: DatiAvviso, autore: string, prima: RifFile[] = []) {
  const dati = { titolo: a.titolo.trim(), testo: a.testo.trim(), inEvidenza: a.inEvidenza, allegati: a.allegati };
  if (id) await updateDoc(doc(avvisi, id), { ...dati, modificatoIl: serverTimestamp() });
  else await addDoc(avvisi, { ...dati, autore, createdAt: serverTimestamp() });
  await eliminaFiles(prima.filter((f) => !a.allegati.some((x) => x.id === f.id)).map((f) => f.id));
}

export async function eliminaAvviso(a: Avviso) {
  await deleteDoc(doc(avvisi, a.id));
  await eliminaFiles((a.allegati ?? []).map((f) => f.id));
}

// ---------- Iscrizione online ----------
// Modalità (pubblica, in contenuti/iscrizione): "aperte" a tutti, solo con "codice", "chiuse".
// Le regole di sicurezza la applicano anche lato server.
// Il codice valido è un documento in "codiciIscrizione" con ID = codice:
// chiunque può verificare un codice che conosce, nessuno può elencarli.
// Il codice in uso lo vedono solo gli organizzatori (impostazioni/iscrizione).

export type ModoIscrizione = 'aperte' | 'codice' | 'chiuse';
/** Se l'organizzatore non ha mai scelto, le iscrizioni sono aperte (come finora). */
export const MODO_PREDEFINITO: ModoIscrizione = 'aperte';

export function ascoltaModoIscrizione(cb: (m: ModoIscrizione) => void) {
  return onSnapshot(
    doc(db, 'contenuti', 'iscrizione'),
    (d) => cb((d.exists() ? (d.data().modo as ModoIscrizione) : null) ?? MODO_PREDEFINITO),
    () => cb(MODO_PREDEFINITO),
  );
}

export interface ImpostazioniIscrizione {
  codice: string;
  modo: ModoIscrizione;
}

export const normalizzaCodiceIscrizione = (c: string) => c.toUpperCase().replace(/[^A-Z0-9-]/g, '');

export async function verificaCodiceIscrizione(input: string): Promise<boolean> {
  const c = normalizzaCodiceIscrizione(input);
  if (c.length < 4) return false;
  try {
    const d = await getDoc(doc(db, 'codiciIscrizione', c));
    return d.exists() && d.data().attivo === true;
  } catch {
    return false;
  }
}

export function ascoltaImpostazioniIscrizione(cb: (i: ImpostazioniIscrizione | null) => void, err: (e: Error) => void) {
  return onSnapshot(
    doc(db, 'impostazioni', 'iscrizione'),
    (d) => cb(d.exists() ? { codice: d.data().codice ?? '', modo: d.data().modo ?? (d.data().attiva ? 'codice' : 'chiuse') } : null),
    err,
  );
}

/** Cambia modalità e/o codice (il codice vecchio smette subito di funzionare). */
export async function salvaImpostazioniIscrizione(nuovo: ImpostazioniIscrizione, vecchioCodice: string | null) {
  const codice = normalizzaCodiceIscrizione(nuovo.codice);
  const b = writeBatch(db);
  if (vecchioCodice && vecchioCodice !== codice) b.delete(doc(db, 'codiciIscrizione', vecchioCodice));
  if (codice) b.set(doc(db, 'codiciIscrizione', codice), { attivo: nuovo.modo === 'codice', aggiornatoIl: serverTimestamp() });
  b.set(doc(db, 'impostazioni', 'iscrizione'), { codice, modo: nuovo.modo, attiva: nuovo.modo === 'codice', aggiornatoIl: serverTimestamp() });
  b.set(doc(db, 'contenuti', 'iscrizione'), { modo: nuovo.modo, aggiornatoIl: serverTimestamp() });
  await b.commit();
}
