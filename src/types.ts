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

// ---------- Soci ----------

export type StatoSocio = 'in_attesa' | 'attivo' | 'respinto' | 'sospeso';

export interface Tessera {
  numero: string;
  quotaPagata: boolean;
  pagataIl: Timestamp | null;
}

export interface Residenza {
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
}

export interface ConsensiSocio {
  privacy: boolean;
  liberatoriaFoto: boolean;
  whatsapp: boolean;
  mailingList: boolean;
}

export interface DatiSocio {
  nome: string;
  cognome: string;
  /** "AAAA-MM-GG" */
  dataNascita: string;
  luogoNascita: string;
  codiceFiscale: string;
  residenza: Residenza;
  email: string;
  cellulare: string;
  consensi: ConsensiSocio;
}

export interface Socio extends DatiSocio {
  id: string;
  /** Account collegato; null per i soci inseriti dall'admin senza account. */
  uid: string | null;
  firma: string | null;
  firmatoIl: Timestamp | null;
  stato: StatoSocio;
  /** Chiave: anno ("2026"). */
  tessere: Record<string, Tessera>;
  note: string;
  creatoDa: 'socio' | 'admin';
  /** Codice di iscrizione usato (solo per le richieste dall'app). */
  codiceIscrizione?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Avviso {
  id: string;
  titolo: string;
  testo: string;
  inEvidenza: boolean;
  createdAt: Timestamp;
  autore: string;
}

// ---------- Documenti da firmare ----------

export interface DocumentoFirma {
  id: string;
  titolo: string;
  /** Testo del documento (può essere vuoto se c'è il PDF). */
  testo: string;
  /** PDF allegato come data URL (max ~650 KB), oppure null. */
  pdf: string | null;
  pdfNome: string | null;
  attivo: boolean;
  /** Sale quando cambiano testo o PDF: le firme precedenti vanno rifatte. */
  versione: number;
  autore: string;
  createdAt: Timestamp;
  aggiornatoIl: Timestamp;
}

export interface FirmaDocumento {
  /** `${documentoId}_${uid}` */
  id: string;
  documentoId: string;
  uid: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  /** Titolo e testo al momento della firma. */
  titolo: string;
  testo: string;
  pdfNome: string | null;
  versione: number;
  firma: string;
  firmatoIl: Timestamp;
}
