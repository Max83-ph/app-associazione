import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Intestazione } from '../components/Layout';
import { Testo } from '../components/TestoRicco';
import { Allegati } from '../components/File';
import {
  ascoltaMessaggi, ascoltaPagina, codiceValido, codiciRicordati, dimenticaCodice, normalizzaCodice, ricordaCodice,
  type Messaggio, type PaginaComunicazioni,
} from '../lib/comunicazioni';

const quando = (m: Messaggio) =>
  m.createdAt?.toDate().toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) ?? 'adesso';

/** /c/:codice — la pagina comunicazioni per chi ha il link o il codice. */
export function PaginaComunicazioniPubblica() {
  const { codice: grezzo = '' } = useParams();
  const codice = normalizzaCodice(grezzo);
  const [letta, setLetta] = useState<PaginaComunicazioni | null | undefined>(undefined);
  const [lista, setLista] = useState<Messaggio[] | null>(null);
  const p = codiceValido(codice) ? letta : null;

  useEffect(() => (codiceValido(codice) ? ascoltaPagina(codice, setLetta) : undefined), [codice]);
  useEffect(() => {
    if (!p?.attiva) return;
    ricordaCodice(codice, p.titolo);
    return ascoltaMessaggi(codice, setLista, () => setLista([]));
  }, [p?.attiva, p?.titolo, codice]);
  useEffect(() => { if (p === null) dimenticaCodice(codice); }, [p, codice]);

  if (p === undefined) return <><Intestazione titolo="Comunicazioni" /><main className="contenuto"><p className="vuoto">Caricamento…</p></main></>;
  if (!p || !p.attiva) {
    return (
      <>
        <Intestazione titolo="Pagina non disponibile" />
        <main className="contenuto">
          <div className="pannello">
            <p>Il link o il codice non è valido, oppure la pagina è stata chiusa o cambiata. Chiedi il link aggiornato agli organizzatori.</p>
          </div>
          <InserisciCodice />
        </main>
      </>
    );
  }
  return (
    <>
      <Intestazione titolo={p.titolo} />
      <main className="contenuto">
        {lista === null && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">Ancora nessuna comunicazione. Torna a controllare più tardi.</p>}
        <div className="lista-avvisi">
          {(lista ?? []).map((m) => (
            <article key={m.id} className={m.inEvidenza ? 'avviso-card evidenza' : 'avviso-card'}>
              <div className="avviso-data">
                {m.inEvidenza && <span className="etichetta etichetta-caldo">In evidenza</span>}
                <span>{quando(m)}</span>
                {m.modificatoIl && <span className="nota">(aggiornato)</span>}
              </div>
              {m.titolo && <h2>{m.titolo}</h2>}
              <Testo testo={m.testo} />
              <Allegati lista={m.allegati} />
            </article>
          ))}
        </div>
        <p className="nota">Salva questo link o aggiungilo alla schermata Home: la pagina si aggiorna da sola.</p>
      </main>
    </>
  );
}

/** "Ho un codice": campo per aprire una pagina comunicazioni + quelle già aperte su questo telefono. */
export function InserisciCodice() {
  const navigate = useNavigate();
  const [codice, setCodice] = useState('');
  const [ricordate] = useState(codiciRicordati);
  const c = normalizzaCodice(codice);
  return (
    <section className="pannello">
      <h2>Hai un codice?</h2>
      <p className="nota">Se gli organizzatori ti hanno dato il codice di una pagina comunicazioni, scrivilo qui.</p>
      <form className="riga-codice" onSubmit={(e) => { e.preventDefault(); if (codiceValido(c)) navigate(`/c/${c}`); }}>
        <label className="visivamente-nascosto" htmlFor="codice-comunicazioni">Codice</label>
        <input id="codice-comunicazioni" value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="es. 7K3M-Q9XR-2B" autoCapitalize="characters" autoComplete="off" spellCheck={false} className="maiuscolo" />
        <button type="submit" className="bottone piccolo" disabled={!codiceValido(c)}>Apri</button>
      </form>
      {ricordate.length > 0 && (
        <ul className="lista-link">
          {ricordate.map((r) => <li key={r.codice}><Link to={`/c/${r.codice}`}>{r.titolo}</Link></li>)}
        </ul>
      )}
    </section>
  );
}
