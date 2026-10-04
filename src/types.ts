import type { Timestamp } from 'firebase/firestore';

export type TipoEvento = 'pasto' | 'laboratorio' | 'tema';
export type Pubblico = 'adulti' | 'bambini' | 'famiglie';
export type StatoEvento = 'bozza' | 'aperto' | 'chiuso';
export type IconaEvento = 'pasto' | 'laboratorio' | 'musica' | 'festa';
export type Modalita = 'tavolo' | 'asporto' | 'partecipazione';
export type StatoBiglietto = 'valido' | 'usato' | 'annullato';
export type StatoPagamento = 'da_pagare' | 'pagato_in_loco' | 'pagato_online';
export type Ruolo = 'in_attesa' | 'staff' | 'organizzatore';

export interface Evento {
  id: string;
  titolo: string;
  descrizione: string;
  luogo: string;
  data: Timestamp;
  /** Mezzanotte del giorno dell'evento: da qui vale il limite porzioni asporto. */
  inizioGiorno: Timestamp;
  chiusuraIscrizioni: Timestamp | null;
  tipo: TipoEvento;
  pubblico: Pubblico;
  icona: IconaEvento;
  colore: string;
  /** Immagine ridotta salvata come data URL (piano gratuito, niente Storage). */
  locandina: string | null;
  prezzo: string;
  stato: StatoEvento;
  visibile: boolean;
  postiMax: number;
  postiOccupati: number;
  asportoAttivo: boolean;
  porzioniMaxGiornoEvento: number;
  porzioniPrenotate: number;
  documentiRichiesti: { privacy: boolean; liberatoriaFoto: boolean };
  ultimaPrenotazione: string;
  ultimaAnnullata: string;
}

export interface Partecipante {
  nome: string;
  cognome: string;
  eta: number;
}

export interface Prenotazione {
  id: string;
  eventId: string;
  eventoTitolo: string;
  eventoData: Timestamp;
  modalita: Modalita;
  nome: string;
  cognome: string;
  email: string;
  quantita: number;
  partecipanti: Partecipante[];
  consensi: { privacy: boolean; liberatoriaFoto: boolean | null };
  firma: string | null;
  statoBiglietto: StatoBiglietto;
  checkInAt: Timestamp | null;
  annullataAt?: Timestamp;
  createdAt: Timestamp;
  pagamento: {
    stato: StatoPagamento;
    importo: number | null;
    metodo: string | null;
    riferimentoTransazione: string | null;
  };
}

export interface Utente {
  id: string;
  email: string;
  nome: string;
  ruolo: Ruolo;
}
