import type { Timestamp } from 'firebase/firestore';
import type { Evento } from '../types';

const GIORNI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];

const due = (n: number) => String(n).padStart(2, '0');

/** "DOM 18 OTT · 12:30" */
export function dataBreve(ts: Timestamp): string {
  const d = ts.toDate();
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} · ${due(d.getHours())}:${due(d.getMinutes())}`;
}

/** Valore per un campo <input type="datetime-local">. */
export function perInputDataOra(d: Date): string {
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}`;
}

export const etichettaPubblico: Record<Evento['pubblico'], string> = {
  adulti: 'Per adulti',
  bambini: 'Per bambini',
  famiglie: 'Per famiglie',
};

export const etichettaTipo: Record<Evento['tipo'], string> = {
  pasto: 'Pranzo o cena',
  laboratorio: 'Laboratorio',
  tema: 'Evento a tema',
};

export interface StatoCard {
  testo: string;
  tono: 'caldo' | 'neutro' | 'spento';
}

/** Etichette mostrate sulle card della Home. */
export function etichetteEvento(ev: Evento, adesso = new Date()): StatoCard[] {
  const out: StatoCard[] = [];
  const passato = ev.data.toDate() <= adesso;
  const chiuse =
    ev.stato !== 'aperto' || passato || (ev.chiusuraIscrizioni !== null && ev.chiusuraIscrizioni.toDate() <= adesso);
  const liberi = Math.max(0, ev.postiMax - ev.postiOccupati);

  if (chiuse) out.push({ testo: 'Iscrizioni chiuse', tono: 'spento' });
  else if (liberi === 0) out.push({ testo: 'Esaurito', tono: 'spento' });
  else if (liberi <= 10) out.push({ testo: `Ultimi ${liberi} posti`, tono: 'caldo' });
  else out.push({ testo: `${liberi} posti liberi`, tono: 'neutro' });

  if (!chiuse && ev.tipo === 'pasto' && ev.asportoAttivo && asportoDisponibile(ev, adesso) > 0) {
    out.push({ testo: 'Asporto disponibile', tono: 'neutro' });
  }
  return out;
}

/** Porzioni d'asporto ancora prenotabili (Infinity prima del giorno dell'evento). */
export function asportoDisponibile(ev: Evento, adesso = new Date()): number {
  if (adesso < ev.inizioGiorno.toDate()) return Infinity;
  return Math.max(0, ev.porzioniMaxGiornoEvento - ev.porzioniPrenotate);
}

export function iscrizioniAperte(ev: Evento, adesso = new Date()): boolean {
  return (
    ev.stato === 'aperto' &&
    ev.data.toDate() > adesso &&
    (ev.chiusuraIscrizioni === null || ev.chiusuraIscrizioni.toDate() > adesso)
  );
}
