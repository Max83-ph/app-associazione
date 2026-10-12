import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Intestazione } from '../components/Layout';
import { Testo } from '../components/TestoRicco';
import { Allegati } from '../components/File';
import { ascoltaPagina, ascoltaPagineLibere, type Pagina, type VisibilitaPagina } from '../lib/pagine';

/** Pagina; undefined mentre carica, null se non esiste o non è leggibile. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePagina(id: string) {
  const [p, setP] = useState<Pagina | null | undefined>(undefined);
  useEffect(() => ascoltaPagina(id, setP), [id]);
  return p;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePagineLibere(visibilita: VisibilitaPagina, attivo = true) {
  const [l, setL] = useState<Pagina[]>([]);
  useEffect(() => (attivo ? ascoltaPagineLibere(visibilita, setL) : undefined), [visibilita, attivo]);
  return l;
}

export function ContenutoPagina({ p }: { p: Pagina }) {
  return (
    <>
      <Testo testo={p.contenuto} />
      <Allegati lista={p.allegati} />
    </>
  );
}

export function ElencoPagine({ lista, titolo }: { lista: Pagina[]; titolo: string }) {
  if (!lista.length) return null;
  return (
    <section className="elenco-pagine">
      <h2 className="titolo-sezione">{titolo}</h2>
      <ul className="lista-link">
        {lista.map((p) => <li key={p.id}><Link to={`/pagina/${p.id}`}>{p.titolo}</Link></li>)}
      </ul>
    </section>
  );
}

export function PaginaLibera() {
  const { id = '' } = useParams();
  const p = usePagina(id);
  return (
    <>
      <Intestazione titolo={p?.titolo ?? (p === null ? 'Pagina non disponibile' : '')} />
      <main className="contenuto testo-lungo">
        {p === undefined && <p className="vuoto">Caricamento…</p>}
        {p === null && (
          <div className="pannello">
            <p>Questa pagina non esiste più oppure è riservata ai soci.</p>
            <p><Link to="/soci">Entra nell'Area soci</Link> · <Link to="/">Torna agli eventi</Link></p>
          </div>
        )}
        {p && <ContenutoPagina p={p} />}
      </main>
    </>
  );
}
