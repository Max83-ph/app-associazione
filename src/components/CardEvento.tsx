import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import type { Evento } from '../types';
import { etichettaPubblico, etichetteEvento, ora, partiData } from '../lib/format';
import { Icona } from './Icona';

type ConColore = CSSProperties & { '--colore': string; '--colore-testo': string };

const colori = (ev: Evento): ConColore => ({ '--colore': ev.colore, '--colore-testo': scurisci(ev.colore) });

export function CardEvento({ ev, grande }: { ev: Evento; grande?: boolean }) {
  const etichette = etichetteEvento(ev);
  const pubblico = ev.tipo === 'pasto' ? null : etichettaPubblico[ev.pubblico];
  const d = partiData(ev.data);

  return (
    <Link to={`/evento/${ev.id}`} className={grande ? 'card card-grande' : 'card'} style={colori(ev)}>
      {grande && <Copertina ev={ev} altezza={ev.locandina ? 180 : 132} />}
      <div className="card-riga">
        <div className="data-tessera" aria-hidden="true">
          <span className="data-giorno">{d.giorno}</span>
          <span className="data-mese">{d.mese}</span>
        </div>
        <div className="card-corpo">
          <div className="card-quando">{d.settimana}, ore {ora(ev.data)}</div>
          <div className="card-titolo">{ev.titolo}</div>
          {pubblico && <div className="card-sotto">{pubblico}</div>}
          <Etichette lista={etichette} />
        </div>
      </div>
      <span className="visivamente-nascosto">{d.settimana} {d.giorno} {d.mese}</span>
    </Link>
  );
}

export function Copertina({ ev, altezza }: { ev: Evento; altezza: number }) {
  return (
    <div className="copertina" style={{ ...colori(ev), height: altezza }}>
      {ev.locandina ? (
        <img src={ev.locandina} alt={`Locandina: ${ev.titolo}`} />
      ) : (
        <Icona nome={ev.icona} size={52} spessore={1.3} />
      )}
    </div>
  );
}

export function Etichette({ lista }: { lista: { testo: string; tono: string }[] }) {
  return (
    <div className="etichette">
      {lista.map((e) => (
        <span key={e.testo} className={`etichetta etichetta-${e.tono}`}>{e.testo}</span>
      ))}
    </div>
  );
}

/** Versione più scura del colore evento, leggibile come testo su sfondo chiaro. */
// eslint-disable-next-line react-refresh/only-export-components
export function scurisci(hex: string, f = 0.6): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#1E6B45';
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `rgb(${c.join(',')})`;
}
