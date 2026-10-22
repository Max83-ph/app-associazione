import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Link } from 'react-router-dom';
import { ascoltaRegistroPulizie, cancellaPrenotazioni, eventiDaPulire, MESI_CONSERVAZIONE, registraPulizia, type EventoDaPulire, type Pulizia } from '../../lib/pulizia';
import { dataBreve } from '../../lib/format';
import { Icona } from '../../components/Icona';

const SCELTE = [6, 12, 24];

export function PuliziaDati() {
  const { utente } = useAuth();
  const [mesi, setMesi] = useState(MESI_CONSERVAZIONE);
  const [registro, setRegistro] = useState<Pulizia[] | null>(null);
  useEffect(() => ascoltaRegistroPulizie(setRegistro, () => setRegistro([])), []);
  // Arrivando dall'avviso in Gestione, l'elenco da approvare è già pronto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cerca(MESI_CONSERVAZIONE); }, []);
  const [lista, setLista] = useState<EventoDaPulire[] | null>(null);
  const [stato, setStato] = useState('');
  const [errore, setErrore] = useState('');
  const [fatto, setFatto] = useState<number | null>(null);

  const cerca = async (m = mesi) => {
    setErrore('');
    setFatto(null);
    setLista(null);
    setStato('Cerco…');
    try {
      setLista(await eventiDaPulire(m));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Ricerca non riuscita.');
    } finally {
      setStato('');
    }
  };

  const totale = (lista ?? []).reduce((n, x) => n + x.prenotazioni, 0);

  const pulisci = async () => {
    if (!lista?.length) return;
    if (!confirm(`Approvi la cancellazione definitiva di ${totale} prenotazioni di ${lista.length} eventi? Non si può annullare.`)) return;
    setErrore('');
    let n = 0;
    try {
      for (const [i, x] of lista.entries()) {
        setStato(`Cancello ${i + 1} di ${lista.length}: ${x.ev.titolo}…`);
        n += await cancellaPrenotazioni(x.ev.id);
      }
      setFatto(n);
      await registraPulizia(utente?.email ?? '', mesi, lista, n).catch(() => undefined);
      setLista([]);
    } catch (e) {
      setErrore(`Interrotto dopo ${n} prenotazioni: ${e instanceof Error ? e.message : 'errore'}. Riprova.`);
    } finally {
      setStato('');
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Privacy e pulizia dati</h1>
      </header>
      <main className="contenuto">
        <section className="pannello">
          <h2>Cancella le vecchie prenotazioni</h2>
          <p>
            Per il GDPR i dati vanno tenuti solo per il tempo dichiarato nell'informativa (la bozza dice <strong>12 mesi dopo l'evento</strong>).
            Qui cancelli nomi, email, firme e partecipanti delle prenotazioni degli eventi conclusi. Gli eventi restano, con il numero di posti occupati.
          </p>
          <p className="nota">Consiglio: fallo una o due volte l'anno. Se ti servono gli elenchi (es. per la contabilità), scaricali prima dalla pagina iscritti dell'evento.</p>
          <div className="etichetta-campo">Eventi conclusi da più di</div>
          <div className="griglia-3">
            {SCELTE.map((m) => (
              <button key={m} type="button" className={mesi === m ? 'scelta attiva' : 'scelta'} aria-pressed={mesi === m} onClick={() => { setMesi(m); setLista(null); }}>{m} mesi</button>
            ))}
          </div>
          <button type="button" className="bottone contorno piccolo" disabled={!!stato} onClick={() => cerca()}>{stato === 'Cerco…' ? 'Cerco…' : 'Cerca le prenotazioni da cancellare'}</button>
        </section>

        {errore && <p className="avviso errore">{errore}</p>}
        {fatto !== null && <p className="avviso">Fatto: cancellate {fatto} prenotazioni.</p>}
        {lista && lista.length === 0 && fatto === null && <p className="vuoto">Niente da cancellare: nessuna prenotazione di eventi conclusi da più di {mesi} mesi.</p>}
        {lista && lista.length > 0 && (
          <section className="pannello">
            <h2>{totale} prenotazioni in {lista.length} eventi</h2>
            <ul className="elenco-import">
              {lista.map((x) => (
                <li key={x.ev.id}><strong>{x.ev.titolo}</strong><span>{dataBreve(x.ev.data)} · {x.prenotazioni} prenotazioni</span></li>
              ))}
            </ul>
            <button type="button" className="bottone pericolo" disabled={!!stato} onClick={pulisci}>{stato || `Approva e cancella ${totale} prenotazioni`}</button>
          </section>
        )}

        <section className="pannello">
          <h2>Registro delle pulizie</h2>
          <p className="nota">Ogni cancellazione approvata resta annotata qui: è la prova che i tempi dichiarati nell'informativa vengono rispettati.</p>
          {registro === null && <p className="vuoto">Caricamento…</p>}
          {registro?.length === 0 && <p className="vuoto">Nessuna pulizia ancora.</p>}
          {registro && registro.length > 0 && (
            <ul className="elenco-import">
              {registro.map((r) => (
                <li key={r.id}>
                  <strong>{r.quando?.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}: {r.prenotazioni} prenotazioni</strong>
                  <span>{r.eventi.length} eventi conclusi da oltre {r.mesi} mesi · approvata da {r.da || 'organizzatore'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pannello">
          <h2>Testi privacy</h2>
          <p>Informative, liberatorie e la pagina <Link to="/privacy">Privacy e cookie</Link> si modificano da <Link to="/admin/testi">Informative e contatti</Link>.</p>
        </section>
      </main>
    </>
  );
}
