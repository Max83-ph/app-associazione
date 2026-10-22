// Pulizia periodica dei dati (GDPR, limitazione della conservazione):
// cancella le prenotazioni degli eventi conclusi da più di N mesi. Gli eventi restano, senza dati personali.
import { addDoc, collection, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Evento } from '../types';

const eventi = collection(db, 'events');
const prenotazioni = collection(db, 'bookings');

export interface EventoDaPulire { ev: Evento; prenotazioni: number }

export async function eventiDaPulire(mesi: number): Promise<EventoDaPulire[]> {
  const soglia = new Date();
  soglia.setMonth(soglia.getMonth() - mesi);
  const s = await getDocs(eventi);
  const vecchi = s.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Evento)
    .filter((e) => e.data && e.data.toDate() < soglia)
    .sort((a, b) => a.data.toMillis() - b.data.toMillis());
  const conteggi = await Promise.all(vecchi.map((ev) => getCountFromServer(query(prenotazioni, where('eventId', '==', ev.id)))));
  return vecchi.map((ev, i) => ({ ev, prenotazioni: conteggi[i].data().count })).filter((x) => x.prenotazioni > 0);
}

/** Cancella tutte le prenotazioni dell'evento, a blocchi. Restituisce quante ne ha cancellate. */
export async function cancellaPrenotazioni(eventId: string): Promise<number> {
  let totale = 0;
  for (;;) {
    const s = await getDocs(query(prenotazioni, where('eventId', '==', eventId), limit(400)));
    if (s.empty) return totale;
    const b = writeBatch(db);
    s.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    totale += s.size;
  }
}

/** Periodo di conservazione dichiarato nelle informative. */
export const MESI_CONSERVAZIONE = 12;

// Registro delle pulizie (accountability GDPR): lo leggono e scrivono solo gli organizzatori.
export interface Pulizia { id: string; quando: Timestamp; da: string; mesi: number; prenotazioni: number; eventi: { titolo: string; data: Timestamp; prenotazioni: number }[] }
const registro = collection(db, 'registroPulizie');

export async function registraPulizia(da: string, mesi: number, fatti: EventoDaPulire[], prenotazioniCancellate: number) {
  await addDoc(registro, {
    quando: serverTimestamp(), da, mesi, prenotazioni: prenotazioniCancellate,
    eventi: fatti.map((x) => ({ titolo: x.ev.titolo, data: x.ev.data, prenotazioni: x.prenotazioni })),
  });
}

export function ascoltaRegistroPulizie(cb: (l: Pulizia[]) => void, err: (e: Error) => void) {
  return onSnapshot(query(registro, orderBy('quando', 'desc'), limit(50)), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pulizia)), err);
}

/** Per l'avviso in Gestione: quante prenotazioni hanno superato il periodo di conservazione. */
export async function contaDaPulire(eventiNoti: Evento[], mesi = MESI_CONSERVAZIONE): Promise<number> {
  const soglia = new Date();
  soglia.setMonth(soglia.getMonth() - mesi);
  const vecchi = eventiNoti.filter((e) => e.data && e.data.toDate() < soglia);
  if (!vecchi.length) return 0;
  const c = await Promise.all(vecchi.map((ev) => getCountFromServer(query(prenotazioni, where('eventId', '==', ev.id)))));
  return c.reduce((n, x) => n + x.data().count, 0);
}
