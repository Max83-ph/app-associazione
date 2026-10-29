import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  addDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Evento, Modalita, Partecipante, Prenotazione, Ruolo, Utente, VoceOrdine } from '../types';
import { nuovoCodice } from './codice';
import { asportoDisponibile, iscrizioniAperte } from './format';

const eventi = collection(db, 'events');
const prenotazioni = collection(db, 'bookings');

const conId = <T,>(id: string, data: unknown) => ({ id, ...(data as object) }) as T;
const perData = (a: Evento, b: Evento) => a.data.toMillis() - b.data.toMillis();

// ---------- Eventi ----------

/** Eventi pubblicati, in ordine di data (per la Home). */
export function ascoltaEventiPubblici(cb: (ev: Evento[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    query(eventi, where('visibile', '==', true)),
    (snap) => cb(snap.docs.map((d) => conId<Evento>(d.id, d.data())).sort(perData)),
    err,
  );
}

/** Tutti gli eventi, bozze comprese (solo organizzatori). */
export function ascoltaTuttiGliEventi(cb: (ev: Evento[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    eventi,
    (snap) => cb(snap.docs.map((d) => conId<Evento>(d.id, d.data())).sort(perData)),
    err,
  );
}

export function ascoltaEvento(id: string, cb: (ev: Evento | null) => void, err: (e: Error) => void) {
  return onSnapshot(
    doc(eventi, id),
    (d) => cb(d.exists() ? conId<Evento>(d.id, d.data()) : null),
    err,
  );
}

export type DatiEvento = Omit<
  Evento,
  'id' | 'postiOccupati' | 'porzioniPrenotate' | 'ultimaPrenotazione' | 'ultimaAnnullata' | 'visibile'
>;

export async function salvaEvento(id: string | null, dati: DatiEvento): Promise<string> {
  const visibile = dati.stato !== 'bozza';
  if (id) {
    await updateDoc(doc(eventi, id), { ...dati, visibile });
    return id;
  }
  const ref = await addDoc(eventi, {
    ...dati,
    visibile,
    postiOccupati: 0,
    porzioniPrenotate: 0,
    ultimaPrenotazione: '',
    ultimaAnnullata: '',
  });
  return ref.id;
}

// ---------- Prenotazioni ----------

export interface NuovaPrenotazione {
  modalita: Modalita;
  nome: string;
  cognome: string;
  email: string;
  quantita: number;
  partecipanti: Partecipante[];
  liberatoriaFoto: boolean | null;
  firma: string | null;
  /** Solo asporto con menù: piatti scelti e totale in centesimi. */
  ordine?: VoceOrdine[];
  totale?: number;
}

export class ErrorePrenotazione extends Error {}

/**
 * Crea la prenotazione e aggiorna i contatori dell'evento nella stessa transazione.
 * Le regole di sicurezza verificano che i contatori salgano esattamente della
 * quantità prenotata e non superino i limiti: niente posti in più, anche se
 * due persone prenotano nello stesso istante.
 */
export async function creaPrenotazione(eventId: string, p: NuovaPrenotazione): Promise<string> {
  const codice = nuovoCodice();
  const refEvento = doc(eventi, eventId);
  const refPren = doc(prenotazioni, codice);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refEvento);
    if (!snap.exists()) throw new ErrorePrenotazione('Evento non trovato.');
    const ev = conId<Evento>(snap.id, snap.data());
    if (!iscrizioniAperte(ev)) throw new ErrorePrenotazione('Le iscrizioni a questo evento sono chiuse.');

    const aggiornamento: Partial<Evento> = { ultimaPrenotazione: codice };
    if (p.modalita === 'asporto') {
      if (p.quantita > asportoDisponibile(ev)) {
        throw new ErrorePrenotazione('Le porzioni d\'asporto per oggi sono finite.');
      }
      aggiornamento.porzioniPrenotate = ev.porzioniPrenotate + p.quantita;
    } else {
      const liberi = ev.postiMax - ev.postiOccupati;
      if (p.quantita > liberi) {
        throw new ErrorePrenotazione(
          liberi > 0 ? `Sono rimasti solo ${liberi} posti.` : 'I posti sono esauriti.',
        );
      }
      aggiornamento.postiOccupati = ev.postiOccupati + p.quantita;
    }

    tx.set(refPren, {
      eventId,
      eventoTitolo: ev.titolo,
      eventoData: ev.data,
      modalita: p.modalita,
      nome: p.nome.trim(),
      cognome: p.cognome.trim(),
      email: p.email.trim().toLowerCase(),
      quantita: p.quantita,
      partecipanti: p.partecipanti,
      ...(p.ordine?.length ? { ordine: p.ordine, totale: p.totale ?? 0 } : {}),
      consensi: { privacy: true, liberatoriaFoto: p.liberatoriaFoto },
      firma: p.firma,
      statoBiglietto: 'valido',
      checkInAt: null,
      createdAt: serverTimestamp(),
      pagamento: { stato: 'da_pagare', importo: null, metodo: null, riferimentoTransazione: null },
    });
    tx.update(refEvento, aggiornamento);
  });

  return codice;
}

export interface IscrittoManuale {
  modalita: Modalita;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  note: string;
  quantita: number;
  partecipanti: Partecipante[];
  /** Informativa (ed eventuale liberatoria) già firmate su carta: niente da completare all'ingresso. */
  cartaceo: boolean;
  liberatoriaFoto: boolean | null;
  pagato: boolean;
  importo: number | null;
}

/** Iscrizione presa fuori dall'app: la inserisce l'organizzatore, anche oltre i posti. */
export async function aggiungiIscrittoManuale(eventId: string, d: IscrittoManuale, autore: string): Promise<string> {
  const codice = nuovoCodice();
  const refEvento = doc(eventi, eventId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refEvento);
    if (!snap.exists()) throw new ErrorePrenotazione('Evento non trovato.');
    const ev = conId<Evento>(snap.id, snap.data());
    tx.set(doc(prenotazioni, codice), {
      eventId,
      eventoTitolo: ev.titolo,
      eventoData: ev.data,
      modalita: d.modalita,
      nome: d.nome.trim(),
      cognome: d.cognome.trim(),
      email: d.email.trim().toLowerCase(),
      telefono: d.telefono.trim(),
      note: d.note.trim(),
      quantita: d.quantita,
      partecipanti: d.partecipanti,
      consensi: { privacy: d.cartaceo, liberatoriaFoto: d.cartaceo ? d.liberatoriaFoto : null },
      firma: null,
      statoBiglietto: 'valido',
      checkInAt: null,
      createdAt: serverTimestamp(),
      pagamento: d.pagato
        ? { stato: 'pagato_in_loco', importo: d.importo, metodo: 'in_loco', riferimentoTransazione: null }
        : { stato: 'da_pagare', importo: null, metodo: null, riferimentoTransazione: null },
      manuale: true,
      daCompletare: !d.cartaceo,
      inseritaDa: autore,
    });
    tx.update(refEvento, d.modalita === 'asporto'
      ? { porzioniPrenotate: ev.porzioniPrenotate + d.quantita }
      : { postiOccupati: ev.postiOccupati + d.quantita });
  });
  return codice;
}

/** Toglie un'iscrizione inserita a mano e restituisce i posti. */
export async function eliminaIscrittoManuale(codice: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ps = await tx.get(doc(prenotazioni, codice));
    if (!ps.exists()) return;
    const p = conId<Prenotazione>(ps.id, ps.data());
    const refEvento = doc(eventi, p.eventId);
    const es = await tx.get(refEvento);
    if (es.exists() && p.statoBiglietto !== 'annullato') {
      const ev = conId<Evento>(es.id, es.data());
      tx.update(refEvento, p.modalita === 'asporto'
        ? { porzioniPrenotate: Math.max(0, ev.porzioniPrenotate - p.quantita) }
        : { postiOccupati: Math.max(0, ev.postiOccupati - p.quantita) });
    }
    tx.delete(doc(prenotazioni, codice));
  });
}

/** All'ingresso: dati mancanti, presa visione, liberatoria e firma di un'iscrizione inserita a mano. */
export async function completaIscrizione(
  codice: string,
  d: { nome: string; cognome: string; email: string; partecipanti: Partecipante[]; liberatoriaFoto: boolean | null; firma: string | null; entra: boolean },
) {
  await updateDoc(doc(prenotazioni, codice), {
    nome: d.nome.trim(),
    cognome: d.cognome.trim(),
    email: d.email.trim().toLowerCase(),
    partecipanti: d.partecipanti,
    consensi: { privacy: true, liberatoriaFoto: d.liberatoriaFoto },
    firma: d.firma,
    daCompletare: false,
    completataAt: serverTimestamp(),
    ...(d.entra ? { statoBiglietto: 'usato', checkInAt: serverTimestamp() } : {}),
  });
}

export async function leggiPrenotazione(codice: string): Promise<Prenotazione | null> {
  const snap = await getDoc(doc(prenotazioni, codice));
  return snap.exists() ? conId<Prenotazione>(snap.id, snap.data()) : null;
}

export function ascoltaPrenotazione(
  codice: string,
  cb: (p: Prenotazione | null) => void,
  err: (e: Error) => void,
) {
  return onSnapshot(
    doc(prenotazioni, codice),
    (d) => cb(d.exists() ? conId<Prenotazione>(d.id, d.data()) : null),
    err,
  );
}

/** Annulla un biglietto e libera i posti (o le porzioni) nell'evento. */
export async function annullaPrenotazione(codice: string): Promise<void> {
  const refPren = doc(prenotazioni, codice);
  await runTransaction(db, async (tx) => {
    const ps = await tx.get(refPren);
    if (!ps.exists()) throw new ErrorePrenotazione('Biglietto non trovato.');
    const p = conId<Prenotazione>(ps.id, ps.data());
    if (p.statoBiglietto !== 'valido') throw new ErrorePrenotazione('Questo biglietto non è più attivo.');

    const refEvento = doc(eventi, p.eventId);
    const es = await tx.get(refEvento);
    if (!es.exists()) throw new ErrorePrenotazione('Evento non trovato.');
    const ev = conId<Evento>(es.id, es.data());

    const aggiornamento: Partial<Evento> = { ultimaAnnullata: codice };
    if (p.modalita === 'asporto') aggiornamento.porzioniPrenotate = ev.porzioniPrenotate - p.quantita;
    else aggiornamento.postiOccupati = ev.postiOccupati - p.quantita;

    tx.update(refPren, { statoBiglietto: 'annullato', annullataAt: serverTimestamp() });
    tx.update(refEvento, aggiornamento);
  });
}

export function ascoltaPrenotazioniEvento(
  eventId: string,
  cb: (p: Prenotazione[]) => void,
  err: (e: Error) => void,
) {
  return onSnapshot(
    query(prenotazioni, where('eventId', '==', eventId)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => conId<Prenotazione>(d.id, d.data()))
          .sort((a, b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome, 'it')),
      ),
    err,
  );
}

export async function registraIngresso(codice: string) {
  await updateDoc(doc(prenotazioni, codice), { statoBiglietto: 'usato', checkInAt: serverTimestamp() });
}

export async function annullaIngresso(codice: string) {
  await updateDoc(doc(prenotazioni, codice), { statoBiglietto: 'valido', checkInAt: null });
}

/** importo in centesimi (es. il totale dell'ordine d'asporto), se noto. */
export async function segnaPagamento(codice: string, pagato: boolean, importo?: number | null) {
  await updateDoc(doc(prenotazioni, codice), {
    'pagamento.stato': pagato ? 'pagato_in_loco' : 'da_pagare',
    'pagamento.metodo': pagato ? 'in_loco' : null,
    ...(importo !== undefined ? { 'pagamento.importo': pagato ? importo : null } : {}),
  });
}

// ---------- Utenti e ruoli ----------

export async function registraProfilo(uid: string, email: string, nome: string) {
  await setDoc(doc(db, 'users', uid), {
    email,
    nome: nome.trim(),
    ruolo: 'in_attesa',
    createdAt: serverTimestamp(),
  });
}

export function ascoltaUtenti(cb: (u: Utente[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) =>
      cb(
        snap.docs
          .map((d) => conId<Utente>(d.id, d.data()))
          .sort((a, b) => a.email.localeCompare(b.email)),
      ),
    err,
  );
}

export async function cambiaRuolo(uid: string, ruolo: Ruolo) {
  await updateDoc(doc(db, 'users', uid), { ruolo });
}

export { Timestamp };
