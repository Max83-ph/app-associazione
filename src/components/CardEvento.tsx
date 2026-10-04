import { Link } from 'react-router-dom';
import type { Evento } from '../types';
import { dataBreve, etichettaPubblico, etichetteEvento } from '../lib/format';
import { Icona } from './Icona';

export function CardEvento({ ev, grande }: { ev: Evento; grande?: boolean }) {
  const etichette = etichetteEvento(ev);
  const pubblico = ev.tipo === 'pasto' ? null : etichettaPubblico[ev.pubblico];

  if (grande) {
    return (
      <Link to={`/evento/${ev.id}`} className="card card-grande">
        <Copertina ev={ev} altezza={140} />
        <div className="card-corpo">
          <div className="card-data" style={{ color: scurisci(ev.colore) }}>{dataBreve(ev.data)}</div>
          <div className="card-titolo">{ev.titolo}</div>
          {pubblico && <div className="card-sotto">{pubblico}</div>}
          <Etichette lista={etichette} />
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/evento/${ev.id}`} className="card card-riga">
      <div className="card-icona" style={{ background: ev.colore }}>
        {ev.locandina ? <img src={ev.locandina} alt="" /> : <Icona nome={ev.icona} size={32} />}
      </div>
      <div className="card-corpo">
        <div className="card-data" style={{ color: scurisci(ev.colore) }}>{dataBreve(ev.data)}</div>
        <div className="card-titolo">{ev.titolo}</div>
        <div className="card-sotto">
          {[pubblico, etichette[0]?.testo].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Link>
  );
}

export function Copertina({ ev, altezza }: { ev: Evento; altezza: number }) {
  return (
    <div className="copertina" style={{ background: ev.colore, height: altezza }}>
      {ev.locandina ? (
        <img src={ev.locandina} alt={`Locandina: ${ev.titolo}`} />
      ) : (
        <Icona nome={ev.icona} size={56} spessore={1.4} />
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

/** Versione più scura del colore evento, leggibile come testo su sfondo bianco. */
export function scurisci(hex: string, f = 0.62): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#1D3557';
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `rgb(${c.join(',')})`;
}
