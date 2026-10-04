import { useEffect, useMemo, useState } from 'react';
import { Intestazione } from '../components/Layout';
import { CardEvento } from '../components/CardEvento';
import { ascoltaEventiPubblici } from '../lib/dati';
import type { Evento } from '../types';

type Filtro = 'tutti' | 'pasti' | 'bambini' | 'laboratori';

const FILTRI: { id: Filtro; testo: string }[] = [
  { id: 'tutti', testo: 'Tutti' },
  { id: 'pasti', testo: 'Pranzi e cene' },
  { id: 'laboratori', testo: 'Laboratori' },
  { id: 'bambini', testo: 'Bambini' },
];

export function Home() {
  const [eventi, setEventi] = useState<Evento[] | null>(null);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('tutti');

  useEffect(() => ascoltaEventiPubblici(setEventi, (e) => setErrore(e.message)), []);

  const futuri = useMemo(() => {
    const ieri = Date.now() - 6 * 3600 * 1000;
    return (eventi ?? []).filter((e) => e.data.toMillis() > ieri);
  }, [eventi]);

  const visibili = futuri.filter((e) => {
    if (filtro === 'pasti') return e.tipo === 'pasto';
    if (filtro === 'laboratori') return e.tipo === 'laboratorio';
    if (filtro === 'bambini') return e.pubblico !== 'adulti' && e.tipo !== 'pasto';
    return true;
  });

  return (
    <>
      <Intestazione titolo="Prossimi eventi">
        <div className="filtri" role="group" aria-label="Filtra gli eventi">
          {FILTRI.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filtro === f.id ? 'filtro attivo' : 'filtro'}
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
            >
              {f.testo}
            </button>
          ))}
        </div>
      </Intestazione>
      <main className="contenuto">
        {errore && <p className="avviso errore">Impossibile caricare gli eventi: {errore}</p>}
        {eventi === null && !errore && <p className="vuoto">Caricamento…</p>}
        {eventi !== null && visibili.length === 0 && (
          <p className="vuoto">Nessun evento in programma{filtro !== 'tutti' ? ' per questo filtro' : ''}. Torna a trovarci presto!</p>
        )}
        <div className="lista-card">
          {visibili.map((ev, i) => (
            <CardEvento key={ev.id} ev={ev} grande={i === 0 || !!ev.locandina} />
          ))}
        </div>
      </main>
    </>
  );
}
