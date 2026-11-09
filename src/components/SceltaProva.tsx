import { useState } from 'react';
import { liberiSlot, slotGiornata } from '../lib/carnevale';
import type { GiornataProve } from '../types';

const etichettaGiorno = (g: GiornataProve) =>
  g.data.toDate().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' });

/** Giornate e orari della prova costume: mostra solo gli orari con abbastanza posti per tutta la famiglia. */
export function SceltaProva({ giornate, persone, valore, onChange, ignoraLimite = false }: {
  giornate: GiornataProve[];
  persone: number;
  valore: { giornata: string; ora: string } | null;
  onChange: (v: { giornata: string; ora: string } | null) => void;
  /** Organizzatori: possono riempire uno slot oltre il limite. */
  ignoraLimite?: boolean;
}) {
  // eslint-disable-next-line react-hooks/purity
  const adesso = Date.now();
  const future = giornate.filter((g) => g.data.toMillis() + 12 * 3600 * 1000 > adesso);
  const [scelta, setScelta] = useState(valore?.giornata ?? future[0]?.id ?? '');
  const g = future.find((x) => x.id === scelta) ?? future[0];
  if (future.length === 0) return <p className="nota">Le date delle prove non sono ancora uscite: iscriviti ora e prenota la prova più tardi dal tuo link, oppure su WhatsApp.</p>;
  return (
    <div className="scelta-prova">
      <div className="giorni-prova" role="group" aria-label="Giornata">
        {future.map((x) => (
          <button type="button" key={x.id} className={x.id === g?.id ? 'scelta attiva' : 'scelta'} aria-pressed={x.id === g?.id} onClick={() => setScelta(x.id)}>
            <span className="giorno-prova">{etichettaGiorno(x)}</span>
            <span className="nota">{x.dalle}–{x.alle}</span>
          </button>
        ))}
      </div>
      {g && (
        <div className="slot-prova">
          {slotGiornata(g).map((ora) => {
            const liberi = liberiSlot(g, ora);
            const passato = new Date(`${g.giorno}T${ora}`).getTime() < adesso;
            const ok = !passato && (ignoraLimite || liberi >= persone);
            const sel = valore?.giornata === g.id && valore.ora === ora;
            return (
              <button type="button" key={ora} disabled={!ok && !sel} className={sel ? 'slot attivo' : 'slot'} aria-pressed={sel}
                onClick={() => onChange(sel ? null : { giornata: g.id, ora })}>
                <strong>{ora}</strong>
                <span>{passato ? 'passato' : liberi <= 0 ? 'pieno' : `${liberi} su ${g.postiSlot}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
