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
