import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  aggiornaPagina, ascoltaMessaggi, ascoltaPagina, ascoltaTuttePagine, cambiaCodice, codiceLeggibile, codiceValido, creaPagina,
  eliminaMessaggio, eliminaPagina, linkPagina, normalizzaCodice, nuovoCodice, salvaMessaggio,
  type DatiMessaggio, type Messaggio, type PaginaComunicazioni,
} from '../../lib/comunicazioni';
import { eliminaFiles } from '../../lib/file';
import { qrLinkDataUrl } from '../../lib/biglietto';
import { Icona } from '../../components/Icona';
import { Allegati, ModificaAllegati } from '../../components/File';
import { EditorTesto, Testo } from '../../components/TestoRicco';

function Testata({ titolo, indietro }: { titolo: string; indietro: string }) {
  return (
    <header className="intestazione compatta">
      <Link to={indietro} className="indietro-chiaro" aria-label="Indietro"><Icona nome="indietro" size={22} spessore={2} /></Link>
      <h1>{titolo}</h1>
    </header>
  );
}

/** Campo codice: generato in automatico, oppure scelto (almeno 8 lettere o numeri). */
function CampoCodice({ valore, onChange }: { valore: string; onChange: (c: string) => void }) {
  const c = normalizzaCodice(valore);
  return (
    <label>Codice (è anche la parte finale del link)
      <div className="riga-codice">
        <input value={valore} onChange={(e) => onChange(e.target.value.toUpperCase())} maxLength={36} autoCapitalize="characters" autoComplete="off" spellCheck={false} className="maiuscolo" />
        <button type="button" className="mini" onClick={() => onChange(codiceLeggibile(nuovoCodice()))}>Genera</button>
      </div>
      <span className="nota">
        {codiceValido(c) ? `Link: ${linkPagina(c)}` : 'Almeno 8 lettere o numeri (spazi e trattini non contano). Più è lungo, più è sicuro: evita parole facili da indovinare.'}
      </span>
    </label>
  );
}

export function GestioneComunicazioni() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<PaginaComunicazioni[] | null>(null);
  const [errore, setErrore] = useState('');
  const [titolo, setTitolo] = useState('');
  const [codice, setCodice] = useState(() => codiceLeggibile(nuovoCodice()));
  const [salvo, setSalvo] = useState(false);

  useEffect(() => ascoltaTuttePagine(setLista, (e) => setErrore(e.message)), []);
  const valido = titolo.trim() && codiceValido(normalizzaCodice(codice));

  const crea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setSalvo(true);
    setErrore('');
    try {
      const c = await creaPagina(titolo, codice);
      navigate(`/admin/comunicazioni/${c}`);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Creazione non riuscita.');
      setSalvo(false);
    }
  };

  return (
    <>
      <Testata titolo="Comunicazioni con link" indietro="/admin" />
      <main className="contenuto">
        <p className="nota">
          Pagine per avvisi al volo: le vede solo chi ha il link (o scrive il codice in Info → "Hai un codice?"), senza account.
          Utili per gruppi come figuranti, volontari della cucina, direttivo.
        </p>
        {errore && <p className="avviso errore">{errore}</p>}
        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">Nessuna pagina: creane una qui sotto.</p>}
        <div className="lista-admin">
          {(lista ?? []).map((p) => (
            <div key={p.codice} className="riga-admin">
              <div className="riga-admin-testo">
                <div className="riga-admin-titolo">{p.titolo}</div>
                <div className="riga-admin-sotto mono">{codiceLeggibile(p.codice)}</div>
                <div className="riga-admin-sotto"><span className={p.attiva ? 'stato stato-aperto' : 'stato stato-chiuso'}>{p.attiva ? 'attiva' : 'disattivata'}</span></div>
              </div>
              <div className="riga-admin-azioni"><Link to={`/admin/comunicazioni/${p.codice}`} className="mini">Apri</Link></div>
            </div>
          ))}
        </div>
        <form className="modulo" onSubmit={crea}>
          <fieldset>
            <legend>Nuova pagina</legend>
            <label>Nome della pagina<input value={titolo} onChange={(e) => setTitolo(e.target.value)} maxLength={80} placeholder="es. Figuranti Carnevale 2027" /></label>
            <CampoCodice valore={codice} onChange={setCodice} />
            <button type="submit" className="bottone" disabled={salvo || !valido}>{salvo ? 'Creo…' : 'Crea la pagina'}</button>
          </fieldset>
        </form>
      </main>
    </>
  );
}

const VUOTO: DatiMessaggio = { titolo: '', testo: '', allegati: [], inEvidenza: false };

export function ModificaComunicazioni() {
  const { codice = '' } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<PaginaComunicazioni | null | undefined>(undefined);
  const [lista, setLista] = useState<Messaggio[] | null>(null);
  const [errore, setErrore] = useState('');
  const [bozza, setBozza] = useState<DatiMessaggio>(VUOTO);
  const [inModifica, setInModifica] = useState<Messaggio | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [qr, setQr] = useState('');
  const [msg, setMsg] = useState('');
  const [nuovoCod, setNuovoCod] = useState<string | null>(null);
  const [titolo, setTitolo] = useState<string | null>(null);

  useEffect(() => ascoltaPagina(codice, setP), [codice]);
  useEffect(() => ascoltaMessaggi(codice, setLista, (e) => setErrore(e.message)), [codice]);
  const link = linkPagina(codice);
  useEffect(() => { qrLinkDataUrl(link).then(setQr); }, [link]);

  if (p === undefined) return <><Testata titolo="Comunicazioni" indietro="/admin/comunicazioni" /><main className="contenuto"><p className="vuoto">Caricamento…</p></main></>;
  if (p === null) return <><Testata titolo="Pagina non trovata" indietro="/admin/comunicazioni" /><main className="contenuto"><p className="vuoto">Questa pagina non esiste più.</p></main></>;

  const valido = bozza.testo.trim() || bozza.allegati.length || bozza.titolo.trim();

  const pubblica = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaMessaggio(codice, inModifica?.id ?? null, bozza, inModifica?.allegati ?? []);
      setBozza(VUOTO);
      setInModifica(null);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Pubblicazione non riuscita.');
    } finally {
      setSalvo(false);
    }
  };

  const annulla = () => {
    const salvati = inModifica?.allegati ?? [];
    eliminaFiles(bozza.allegati.filter((f) => !salvati.some((x) => x.id === f.id)).map((f) => f.id));
    setInModifica(null);
    setBozza(VUOTO);
  };

  const copia = async (testo: string, cosa: string) => {
    try { await navigator.clipboard.writeText(testo); setMsg(`${cosa} copiato.`); } catch { setMsg(testo); }
  };

  const condividi = async () => {
    const testo = `${p.titolo}: le comunicazioni del Rione Cappuccini sono qui ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: p.titolo, text: testo, url: link }); } catch { /* annullato */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(testo)}`, '_blank', 'noopener');
    }
  };

  const confermaCodice = async () => {
    if (!nuovoCod) return;
    if (!confirm('Il link e il codice attuali smetteranno subito di funzionare. Dovrai mandare quello nuovo. Continuare?')) return;
    try {
      const c = await cambiaCodice(p, nuovoCod);
      setNuovoCod(null);
      navigate(`/admin/comunicazioni/${c}`, { replace: true });
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Cambio non riuscito.');
    }
  };

  const elimina = async () => {
    if (!confirm(`Eliminare la pagina "${p.titolo}" con tutti i messaggi e i file?`)) return;
    await eliminaPagina(p);
    navigate('/admin/comunicazioni', { replace: true });
  };

  return (
    <>
      <Testata titolo={p.titolo} indietro="/admin/comunicazioni" />
      <main className="contenuto">
        {errore && <p className="avviso errore">{errore}</p>}

        <section className="pannello">
          <h2>Link da mandare</h2>
          {!p.attiva && <p className="avviso">La pagina è disattivata: chi apre il link vede "Pagina non disponibile".</p>}
          <div className="link-iscrizione"><code>{link}</code><button type="button" className="mini" onClick={() => copia(link, 'Link')}>Copia</button></div>
          <p>Codice: <strong className="mono">{codiceLeggibile(codice)}</strong> <button type="button" className="mini" onClick={() => copia(codiceLeggibile(codice), 'Codice')}>Copia</button></p>
          <div className="riga-azioni">
            <button type="button" className="bottone piccolo" onClick={condividi}>Condividi (WhatsApp…)</button>
            <Link to={`/c/${codice}`} className="bottone contorno piccolo">Vedi come la vedono</Link>
          </div>
          <div className="qr-iscrizione">
            {qr && <img src={qr} width={120} height={120} alt="QR della pagina" />}
            {qr && <a className="bottone contorno piccolo" href={qr} download={`qr-${codice}.png`}>Scarica il QR</a>}
          </div>
          {msg && <p className="avviso">{msg}</p>}
        </section>

        <form className="modulo" onSubmit={pubblica}>
          <fieldset>
            <legend>{inModifica ? 'Modifica messaggio' : 'Nuovo messaggio'}</legend>
            <label>Titolo (facoltativo)<input value={bozza.titolo} maxLength={120} onChange={(e) => setBozza({ ...bozza, titolo: e.target.value })} placeholder="es. Prova abiti spostata a giovedì" /></label>
            <EditorTesto etichetta="Testo del messaggio" valore={bozza.testo} onChange={(testo) => setBozza((b) => ({ ...b, testo }))} righe={5} max={8000} />
            <ModificaAllegati valore={bozza.allegati} onChange={(allegati) => setBozza((b) => ({ ...b, allegati }))} visibilita="link" etichetta="+ Foto o file" salvati={inModifica?.allegati} />
            <label className="spunta"><input type="checkbox" checked={bozza.inEvidenza} onChange={(e) => setBozza({ ...bozza, inEvidenza: e.target.checked })} /> In evidenza (resta in cima)</label>
            <div className="griglia-2">
              {inModifica || bozza.allegati.length ? <button type="button" className="bottone contorno" onClick={annulla}>Annulla</button> : <span />}
              <button type="submit" className="bottone" disabled={salvo || !valido}>{salvo ? 'Pubblico…' : inModifica ? 'Salva' : 'Pubblica'}</button>
            </div>
          </fieldset>
        </form>

        {lista?.length === 0 && <p className="vuoto">Nessun messaggio pubblicato.</p>}
        <div className="lista-avvisi">
          {(lista ?? []).map((m) => (
            <article key={m.id} className={m.inEvidenza ? 'avviso-card evidenza' : 'avviso-card'}>
              <div className="avviso-data">
                {m.inEvidenza && <span className="etichetta etichetta-caldo">In evidenza</span>}
                {m.createdAt?.toDate().toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              {m.titolo && <h2>{m.titolo}</h2>}
              <Testo testo={m.testo} />
              <Allegati lista={m.allegati} />
              <div className="riga-azioni">
                <button type="button" className="mini" onClick={() => { setInModifica(m); setBozza({ titolo: m.titolo, testo: m.testo, allegati: m.allegati, inEvidenza: m.inEvidenza }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifica</button>
                <button type="button" className="mini" onClick={() => confirm('Eliminare questo messaggio?') && eliminaMessaggio(codice, m)}>Elimina</button>
              </div>
            </article>
          ))}
        </div>

        <section className="pannello">
          <h2>Impostazioni</h2>
          <label>Nome della pagina
            <div className="riga-codice">
              <input value={titolo ?? p.titolo} maxLength={80} onChange={(e) => setTitolo(e.target.value)} />
              <button type="button" className="mini" disabled={titolo === null || !titolo.trim() || titolo === p.titolo} onClick={async () => { await aggiornaPagina(codice, { titolo: titolo!.trim() }); setTitolo(null); }}>Salva</button>
            </div>
          </label>
          <label className="spunta">
            <input type="checkbox" checked={p.attiva} onChange={(e) => aggiornaPagina(codice, { attiva: e.target.checked })} /> Pagina attiva (visibile a chi ha il link)
          </label>
          {nuovoCod === null ? (
            <button type="button" className="bottone contorno piccolo" onClick={() => setNuovoCod(codiceLeggibile(nuovoCodice()))}>Cambia link e codice</button>
          ) : (
            <div className="modulo">
              <CampoCodice valore={nuovoCod} onChange={setNuovoCod} />
              <div className="griglia-2">
                <button type="button" className="bottone contorno" onClick={() => setNuovoCod(null)}>Annulla</button>
                <button type="button" className="bottone" disabled={!codiceValido(normalizzaCodice(nuovoCod))} onClick={confermaCodice}>Cambia</button>
              </div>
            </div>
          )}
          <button type="button" className="link-bottone pericolo" onClick={elimina}>Elimina la pagina</button>
        </section>
      </main>
    </>
  );
}
