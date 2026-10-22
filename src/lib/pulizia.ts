// Pulizia periodica dei dati (GDPR, limitazione della conservazione):
// cancella le prenotazioni degli eventi conclusi da più di N mesi. Gli eventi restano, senza dati personali.
import { collection, getCountFromServer, getDocs, limit, query, where, writeBatch } from 'firebase/firestore';
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
