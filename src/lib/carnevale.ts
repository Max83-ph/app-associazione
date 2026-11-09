import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { nuovoCodice } from './codice';
import { normalizzaCF } from './codiceFiscale';
import type { FiguranteCarnevale, GiornataProve, ImpostazioniCarnevale, IscrizioneCarnevale, MovimentoCarnevale } from '../types';

export const IMPOSTAZIONI_PREDEFINITE: ImpostazioniCarnevale = {
  aperte: false,
  quotaAdulto: 0,
  quotaBambino: 0,
  anticipo: 2000,
  etaBambino: 14,
  slotMinuti: 10,
  postiSlot: 5,
  sfilate: 'Sabato 30 gennaio e domenica 7 febbraio 2027',
  luogoProve: '',
};

const rifImpostazioni = doc(db, 'contenuti', 'carnevale');
const giornate = collection(db, 'proveCarnevale');
const iscrizioni = collection(db, 'iscrizioniCarnevale');
const conId = <T,>(id: string, data: unknown) => ({ id, ...(data as object) }) as T;

export class ErroreCarnevale extends Error {}

// ---------- Impostazioni ----------

export function ascoltaImpostazioniCarnevale(cb: (i: ImpostazioniCarnevale) => void) {
  return onSnapshot(rifImpostazioni, (d) => cb({ ...IMPOSTAZIONI_PREDEFINITE, ...(d.exists() ? d.data() : {}) } as ImpostazioniCarnevale), () => cb(IMPOSTAZIONI_PREDEFINITE));
}

export async function salvaImpostazioniCarnevale(i: ImpostazioniCarnevale) {
  await setDoc(rifImpostazioni, { ...i, aggiornatoIl: serverTimestamp() });
}

// ---------- Età e quote ----------

export function etaAl(dataNascita: string, al = new Date()): number {
  const [a, m, g] = dataNascita.split('-').map(Number);
  if (!a || !m || !g) return NaN;
  let eta = al.getFullYear() - a;
  if (al.getMonth() + 1 < m || (al.getMonth() + 1 === m && al.getDate() < g)) eta--;
  return eta;
}
export const minorenne = (dataNascita: string) => etaAl(dataNascita) < 18;
export const isBambino = (dataNascita: string, imp: ImpostazioniCarnevale) => etaAl(dataNascita) < imp.etaBambino;

export function quoteIscrizione(persone: Pick<FiguranteCarnevale, 'bambino'>[], imp: ImpostazioniCarnevale) {
  const numBambini = persone.filter((p) => p.bambino).length;
  const numAdulti = persone.length - numBambini;
  return {
    numAdulti,
    numBambini,
    totale: numAdulti * imp.quotaAdulto + numBambini * imp.quotaBambino,
    anticipo: persone.length * imp.anticipo,
  };
}

/** Quanto incassare adesso: anticipo (se non è stato pagato niente), tutto, o il saldo che manca. */
export function daIncassare(i: Pick<IscrizioneCarnevale, 'totale' | 'pagato' | 'persone'>, imp: ImpostazioniCarnevale) {
  const resto = Math.max(0, i.totale - i.pagato);
  const anticipo = Math.min(resto, i.persone.length * imp.anticipo);
  return { resto, anticipo: i.pagato === 0 ? anticipo : 0 };
}

// ---------- Giornate e slot ----------

const minuti = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function slotGiornata(g: Pick<GiornataProve, 'dalle' | 'alle' | 'slotMinuti'>): string[] {
  const out: string[] = [];
  for (let t = minuti(g.dalle); t + g.slotMinuti <= minuti(g.alle); t += g.slotMinuti) out.push(hhmm(t));
  return out;
}
/** Chiave dello slot nella mappa dei prenotati: "15:40" → "h1540". */
export const chiaveSlot = (ora: string) => 'h' + ora.replace(':', '');
export const occupatiSlot = (g: GiornataProve, ora: string) => g.prenotati?.[chiaveSlot(ora)] ?? 0;
export const liberiSlot = (g: GiornataProve, ora: string) => g.postiSlot - occupatiSlot(g, ora);
export const postiGiornata = (g: GiornataProve) => slotGiornata(g).length * g.postiSlot;
export const prenotatiGiornata = (g: GiornataProve) => Object.values(g.prenotati ?? {}).reduce((s, n) => s + n, 0);

export function dataSlot(giorno: string, ora: string): Date {
  const [a, m, d] = giorno.split('-').map(Number);
  const [h, mi] = ora.split(':').map(Number);
  return new Date(a, m - 1, d, h, mi);
}

export function ascoltaGiornate(cb: (g: GiornataProve[]) => void, err: (e: Error) => void = () => undefined) {
  return onSnapshot(giornate, (s) => cb(s.docs.map((d) => conId<GiornataProve>(d.id, d.data())).sort((a, b) => a.data.toMillis() - b.data.toMillis())), err);
}

export async function aggiungiGiornata(giorno: string, dalle: string, alle: string, imp: ImpostazioniCarnevale) {
  if (minuti(alle) - minuti(dalle) < imp.slotMinuti) throw new ErroreCarnevale('L\'orario di fine deve venire dopo l\'inizio.');
  const id = `${giorno}-${dalle.replace(':', '')}`;
  await setDoc(doc(giornate, id), {
    data: Timestamp.fromDate(dataSlot(giorno, dalle)),
    giorno, dalle, alle,
    slotMinuti: imp.slotMinuti,
    postiSlot: imp.postiSlot,
    prenotati: {},
  });
}

export async function eliminaGiornata(id: string) {
  await deleteDoc(doc(giornate, id));
}

// ---------- Iscrizioni ----------

export interface NuovaIscrizioneCarnevale {
  persone: FiguranteCarnevale[];
  referente: { indirizzo: string; cellulare: string; email: string };
  liberatoriaFoto: boolean | null;
  firma: string | null;
  prova: { giornata: string; ora: string } | null;
  /** Inserita da un organizzatore (firma e consensi si possono completare alla prova). */
  manuale?: { note: string; autore: string };
}

/** Crea l'iscrizione e, se c'è, occupa i posti dello slot scelto. Un codice fiscale già iscritto blocca tutto. */
export async function creaIscrizioneCarnevale(n: NuovaIscrizioneCarnevale, imp: ImpostazioniCarnevale): Promise<string> {
  const codice = nuovoCodice();
  const persone = n.persone.map((p) => ({
    nome: p.nome.trim(), cognome: p.cognome.trim(), dataNascita: p.dataNascita, luogoNascita: p.luogoNascita.trim(),
    codiceFiscale: normalizzaCF(p.codiceFiscale), bambino: isBambino(p.dataNascita, imp),
  }));
  const q = quoteIscrizione(persone, imp);
  const completa = !!n.firma;
  try {
    await runTransaction(db, async (tx) => {
      let prova = null;
      if (n.prova) {
        const rif = doc(giornate, n.prova.giornata);
        const gs = await tx.get(rif);
        if (!gs.exists()) throw new ErroreCarnevale('Giornata di prova non trovata.');
        const g = conId<GiornataProve>(gs.id, gs.data());
        if (liberiSlot(g, n.prova.ora) < persone.length) throw new ErroreCarnevale('Quell\'orario si è appena riempito: scegline un altro.');
        tx.update(rif, { [`prenotati.${chiaveSlot(n.prova.ora)}`]: occupatiSlot(g, n.prova.ora) + persone.length, ultimaPrenotazione: codice });
        prova = { giornata: g.id, ora: n.prova.ora, data: Timestamp.fromDate(dataSlot(g.giorno, n.prova.ora)) };
      }
      tx.set(doc(iscrizioni, codice), {
        persone,
        cfs: persone.map((p) => p.codiceFiscale),
        numAdulti: q.numAdulti,
        numBambini: q.numBambini,
        referente: { indirizzo: n.referente.indirizzo.trim(), cellulare: n.referente.cellulare.trim(), email: n.referente.email.trim().toLowerCase() },
        consensi: { privacy: completa || !n.manuale, liberatoriaFoto: completa || !n.manuale ? n.liberatoriaFoto : null },
        firma: n.firma,
        prova,
        stato: 'valido',
        createdAt: serverTimestamp(),
        totale: q.totale,
        pagato: 0,
        movimenti: [],
        provato: false,
        consegnato: false,
        ...(n.manuale ? { manuale: true, daCompletare: !completa, note: n.manuale.note.trim(), inseritaDa: n.manuale.autore } : {}),
      });
      for (const p of persone) tx.set(doc(db, 'cfCarnevale', p.codiceFiscale), { codice });
    });
  } catch (e) {
    if (e instanceof ErroreCarnevale) throw e;
    if (e && typeof e === 'object' && 'code' in e && e.code === 'permission-denied') {
      throw new ErroreCarnevale('Iscrizione non riuscita: forse una delle persone è già iscritta (stesso codice fiscale), oppure le iscrizioni sono chiuse. Scrivici e controlliamo.');
    }
    throw e;
  }
  return codice;
}

/** Prenota (o, per gli organizzatori, sposta) la prova di un'iscrizione. */
export async function prenotaProva(codice: string, giornataId: string, ora: string) {
  await runTransaction(db, async (tx) => {
    const ri = doc(iscrizioni, codice);
    const is = await tx.get(ri);
    if (!is.exists()) throw new ErroreCarnevale('Iscrizione non trovata.');
    const i = conId<IscrizioneCarnevale>(is.id, is.data());
    const n = i.persone.length;
    const rif = doc(giornate, giornataId);
    const gs = await tx.get(rif);
    if (!gs.exists()) throw new ErroreCarnevale('Giornata di prova non trovata.');
    const g = conId<GiornataProve>(gs.id, gs.data());
    const stessa = i.prova?.giornata === giornataId;
    const giaQui = stessa && i.prova?.ora === ora ? n : 0;
    if (liberiSlot(g, ora) + giaQui < n) throw new ErroreCarnevale('Quell\'orario è pieno: scegline un altro.');
    // Spostamento (solo organizzatori): libera il vecchio slot.
    const vecchia = i.prova;
    let vecchiaG: GiornataProve | null = null;
    if (vecchia && !stessa) {
      const vs = await tx.get(doc(giornate, vecchia.giornata));
      if (vs.exists()) vecchiaG = conId<GiornataProve>(vs.id, vs.data());
    }
    const prenotati = { ...(g.prenotati ?? {}) };
    const kv = vecchia ? chiaveSlot(vecchia.ora) : '';
    if (vecchia && stessa) prenotati[kv] = Math.max(0, (prenotati[kv] ?? 0) - n);
    prenotati[chiaveSlot(ora)] = (prenotati[chiaveSlot(ora)] ?? 0) + n;
    if (vecchia) tx.update(rif, { prenotati, ultimaPrenotazione: codice });
    else tx.update(rif, { [`prenotati.${chiaveSlot(ora)}`]: occupatiSlot(g, ora) + n, ultimaPrenotazione: codice });
    if (vecchiaG && vecchia) tx.update(doc(giornate, vecchiaG.id), { [`prenotati.${kv}`]: Math.max(0, occupatiSlot(vecchiaG, vecchia.ora) - n) });
    tx.update(ri, { prova: { giornata: g.id, ora, data: Timestamp.fromDate(dataSlot(g.giorno, ora)) } });
  });
}

export function ascoltaIscrizioneCarnevale(codice: string, cb: (i: IscrizioneCarnevale | null) => void, err: (e: Error) => void) {
  return onSnapshot(doc(iscrizioni, codice), (d) => cb(d.exists() ? conId<IscrizioneCarnevale>(d.id, d.data()) : null), err);
}

export async function leggiIscrizioneCarnevale(codice: string) {
  const d = await getDoc(doc(iscrizioni, codice));
  return d.exists() ? conId<IscrizioneCarnevale>(d.id, d.data()) : null;
}

export function ascoltaIscrizioniCarnevale(cb: (l: IscrizioneCarnevale[]) => void, err: (e: Error) => void = () => undefined) {
  return onSnapshot(query(iscrizioni, where('stato', '==', 'valido')), (s) =>
    cb(s.docs.map((d) => conId<IscrizioneCarnevale>(d.id, d.data())).sort((a, b) => (a.persone[0]?.cognome ?? '').localeCompare(b.persone[0]?.cognome ?? '', 'it'))), err);
}

/** Toglie un'iscrizione: libera lo slot e i codici fiscali. */
export async function eliminaIscrizioneCarnevale(codice: string) {
  await runTransaction(db, async (tx) => {
    const ri = doc(iscrizioni, codice);
    const is = await tx.get(ri);
    if (!is.exists()) return;
    const i = conId<IscrizioneCarnevale>(is.id, is.data());
    if (i.prova) {
      const rg = doc(giornate, i.prova.giornata);
      const gs = await tx.get(rg);
      if (gs.exists()) {
        const g = conId<GiornataProve>(gs.id, gs.data());
        tx.update(rg, { [`prenotati.${chiaveSlot(i.prova.ora)}`]: Math.max(0, occupatiSlot(g, i.prova.ora) - i.persone.length) });
      }
    }
    for (const cf of i.cfs ?? []) tx.delete(doc(db, 'cfCarnevale', cf));
    tx.delete(ri);
  });
}

// ---------- Alla prova (staff) ----------

export async function registraProva(codice: string, taglie: string[], persone: FiguranteCarnevale[]) {
  await updateDoc(doc(iscrizioni, codice), {
    persone: persone.map((p, k) => ({ ...p, taglia: taglie[k] ?? p.taglia ?? '' })),
    provato: true,
    provatoAt: serverTimestamp(),
  });
}

export async function registraPagamento(i: IscrizioneCarnevale, tipo: MovimentoCarnevale['tipo'], importo: number, da: string) {
  await updateDoc(doc(iscrizioni, i.id), {
    pagato: i.pagato + importo,
    movimenti: [...(i.movimenti ?? []), { tipo, importo, at: Timestamp.now(), da }],
  });
}

/** Annulla l'ultimo incasso (errore di tocco). */
export async function annullaUltimoPagamento(i: IscrizioneCarnevale) {
  const m = [...(i.movimenti ?? [])];
  const ultimo = m.pop();
  if (!ultimo) return;
  await updateDoc(doc(iscrizioni, i.id), { pagato: Math.max(0, i.pagato - ultimo.importo), movimenti: m });
}

export async function segnaConsegna(codice: string, consegnato: boolean) {
  await updateDoc(doc(iscrizioni, codice), { consegnato, consegnatoAt: consegnato ? serverTimestamp() : null });
}

export async function completaFirmaCarnevale(codice: string, liberatoriaFoto: boolean | null, firma: string) {
  await updateDoc(doc(iscrizioni, codice), {
    consensi: { privacy: true, liberatoriaFoto },
    firma,
    daCompletare: false,
    completataAt: serverTimestamp(),
  });
}

export async function salvaNoteCarnevale(codice: string, note: string) {
  await updateDoc(doc(iscrizioni, codice), { note });
}

export const TAGLIE = ['Bimbo 2-3', 'Bimbo 4-5', 'Bimbo 6-7', 'Bimbo 8-9', 'Bimbo 10-11', 'Bimbo 12-13', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
