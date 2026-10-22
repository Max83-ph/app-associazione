import type { IconaEvento } from '../types';

const tratti: Record<string, string[]> = {
  pasto: ['M3 10h18', 'M5 10v9', 'M19 10v9', 'M8 6h8'],
  laboratorio: ['M4 20l4-1 11-11-3-3L5 16z', 'M14 6l3 3'],
  musica: ['M9 18V5l11-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  festa: ['M4 20l5-14 9 9z', 'M14 4l1 2', 'M19 9l2-1', 'M17 3l-1 3'],
  asporto: ['M5 8h14l-1 12H6z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  indietro: ['M15 18l-6-6 6-6'],
  ok: ['M5 12l5 5 9-10'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  modifica: ['M4 20l4-1 11-11-3-3L5 16z'],
  chiudi: ['M6 6l12 12', 'M18 6L6 18'],
  qr: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 18h2v2h-2z', 'M14 18h2'],
  utenti: ['M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1', 'M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', 'M21 19v-1a4 4 0 0 0-3-3.9', 'M16 3.1a3.5 3.5 0 0 1 0 6.8'],
  scarica: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  carica: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  calendario: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  aggiungi: ['M12 5v14', 'M5 12h14'],
  socioAggiungi: ['M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1', 'M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', 'M19 8v6', 'M16 11h6'],
  megafono: ['M3 10v4h3l7 4V6L6 10z', 'M17 9a4 4 0 0 1 0 6', 'M19.5 6.5a7.5 7.5 0 0 1 0 11'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  firma: ['M3 17c3-3 5-6 6-6s-1 6 1 6 3-4 4-4 1 3 3 3', 'M3 21h18'],
  pagina: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  cartella: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  testo: ['M5 6h14', 'M5 10h14', 'M5 14h9', 'M5 18h11'],
  scansiona: ['M4 8V5a1 1 0 0 1 1-1h3', 'M16 4h3a1 1 0 0 1 1 1v3', 'M20 16v3a1 1 0 0 1-1 1h-3', 'M8 20H5a1 1 0 0 1-1-1v-3', 'M7 12h10'],
  freccia: ['M9 6l6 6-6 6'],
  lucchetto: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
};

export type NomeIcona = IconaEvento | keyof typeof tratti;

export function Icona({ nome, size = 24, spessore = 1.8 }: { nome: NomeIcona; size?: number; spessore?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={spessore}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(tratti[nome] ?? tratti.festa).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
