import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useTesti } from '../../lib/testi';
import { eliminaFiles } from '../../lib/file';
import {
  ascoltaPagina,
  ascoltaTuttePagine,
  eliminaPagina,
  idDaTitolo,
  isFissa,
  PAGINE_FISSE,
  salvaPagina,
  spostaPagina,
  type Pagina,
} from '../../lib/pagine';
import { Icona } from '../../components/Icona';
import { ModificaAllegati } from '../../components/File';
import { EditorTesto } from '../../components/TestoRicco';

function Testata({ titolo, indietro }: { titolo: string; indietro: string }) {
  return (
    <header className="intestazione compatta">
      <Link to={indietro} className="indietro-chiaro" aria-label="Indietro"><Icona nome="indietro" size={22} spessore={2} /></Link>
      <h1>{titolo}</h1>
    </header>
  );
}

export function GestionePagine() {
  const [lista, setLista] = useState<Pagina[] | null>(null);
  const [errore, setErrore] = useState('');
  useEffect(() => ascoltaTuttePagine(setLista, (e) => setErrore(e.message)), []);

  const scritte = new Map((lista ?? []).map((p) => [p.id, p]));
  const libere = (lista ?? []).filter((p) => !isFissa(p.id));

  const sposta = async (i: number, d: -1 | 1) => {
    const l = [...libere];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    await Promise.all(l.map((p, n) => (p.ordine !== n ? spostaPagina(p, n) : null)));
  };

  return (
    <>
      <Testata titolo="Pagine" indietro="/admin" />
      <main className="contenuto">
        {errore && <p className="avviso errore">{errore}</p>}
        <h2 className="titolo-sezione">Pagine dell'app</h2>
        <div className="lista-admin">
          {Object.entries(PAGINE_FISSE).map(([id, f]) => (
            <div key={id} className="riga-admin">
              <div className="riga-admin-testo">
                <div className="riga-admin-titolo">{f.titolo}</div>
                <div className="riga-admin-sotto">{f.dove}</div>
                <div className="riga-admin-sotto">{scritte.has(id) ? 'Personalizzata' : 'Testo predefinito'}</div>
              </div>
              <div className="riga-admin-azioni"><Link to={`/admin/pagine/${id}`} className="mini">Modifica</Link></div>
            </div>
          ))}
        </div>

        <h2 className="titolo-sezione">Pagine aggiunte</h2>
        <p className="nota">Le pagine pubbliche compaiono in fondo alla pagina Info; quelle per i soci nell'Area soci → Documenti.</p>
        {lista !== null && libere.length === 0 && <p className="vuoto">Nessuna pagina aggiunta.</p>}
        <div className="lista-admin">
          {libere.map((p, i) => (
            <div key={p.id} className="riga-admin">
              <div className="riga-admin-testo">
                <div className="riga-admin-titolo">{p.titolo}</div>
                <div className="riga-admin-sotto">{p.visibilita === 'soci' ? 'Solo soci' : 'Pubblica'} · /pagina/{p.id}</div>
              </div>
              <div className="riga-admin-azioni">
                {libere.length > 1 && (
                  <>
                    <button type="button" className="mini" disabled={i === 0} onClick={() => sposta(i, -1)} aria-label={`Sposta su ${p.titolo}`}>↑</button>
                    <button type="button" className="mini" disabled={i === libere.length - 1} onClick={() => sposta(i, 1)} aria-label={`Sposta giù ${p.titolo}`}>↓</button>
                  </>
                )}
                <Link to={`/admin/pagine/${p.id}`} className="mini">Modifica</Link>
              </div>
            </div>
          ))}
        </div>
        <Link to="/admin/pagine/nuova" className="bottone">+ Nuova pagina</Link>
      </main>
    </>
  );
}

export function ModificaPagina() {
  const { id = 'nuova' } = useParams();
  const nuova = id === 'nuova';
  const navigate = useNavigate();
  const { utente } = useAuth();
  const testi = useTesti();
  const [prima, setPrima] = useState<Pagina | null | undefined>(nuova ? null : undefined);
  const [b, setB] = useState<Pagina | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (nuova) return;
    let primo = true;
    return ascoltaPagina(id, (p) => {
      setPrima(p);
      if (primo) {
        primo = false;
        setB(
          p ?? {
            id,
            titolo: PAGINE_FISSE[id]?.titolo ?? '',
            // La pagina Info parte dal testo "Chi siamo" già scritto.
            contenuto: id === 'info' ? testi.chiSiamo : '',
            allegati: [],
            visibilita: 'pubblica',
            ordine: 0,
          },
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nuova]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (nuova) setB({ id: '', titolo: '', contenuto: '', allegati: [], visibilita: 'pubblica', ordine: 999 }); }, [nuova]);

  if (!b || prima === undefined) return <><Testata titolo="Pagina" indietro="/admin/pagine" /><main className="contenuto"><p className="vuoto">Caricamento…</p></main></>;

  const fissa = isFissa(b.id);
  const valido = b.titolo.trim() || fissa;

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaPagina({ ...b, id: nuova ? idDaTitolo(b.titolo) : b.id }, prima ?? null, utente?.email ?? '');
      navigate('/admin/pagine');
    } catch (err) {
      setErrore(err instanceof Error ? `Salvataggio non riuscito: ${err.message}` : 'Salvataggio non riuscito.');
      setSalvo(false);
    }
  };

  const annulla = async () => {
    await eliminaFiles(b.allegati.filter((f) => !(prima?.allegati ?? []).some((x) => x.id === f.id)).map((f) => f.id));
    navigate('/admin/pagine');
  };

  const elimina = async () => {
    if (!prima) return;
    const msg = fissa ? 'Tornare al testo predefinito? Testo e file di questa pagina verranno eliminati.' : `Eliminare la pagina "${prima.titolo}" e i suoi file?`;
    if (!confirm(msg)) return;
    await eliminaPagina(prima);
    navigate('/admin/pagine');
  };

  const vista = fissa ? (b.id === 'home' ? '/' : `/${b.id}`) : prima ? `/pagina/${b.id}` : null;

  return (
    <>
      <Testata titolo={nuova ? 'Nuova pagina' : fissa ? `Pagina ${PAGINE_FISSE[b.id].titolo}` : 'Modifica pagina'} indietro="/admin/pagine" />
      <main className="contenuto">
        {fissa && <p className="nota">{PAGINE_FISSE[b.id].dove}</p>}
        <form className="modulo" onSubmit={salva}>
          <fieldset>
            <legend>Contenuto</legend>
            {!fissa && <label>Titolo<input value={b.titolo} maxLength={80} onChange={(e) => setB({ ...b, titolo: e.target.value })} /></label>}
            <div className="etichetta-campo">Testo</div>
            <EditorTesto etichetta="Testo della pagina" valore={b.contenuto} onChange={(contenuto) => setB((x) => (x ? { ...x, contenuto } : x))} righe={12} />
            <div className="etichetta-campo">Foto e file</div>
            <ModificaAllegati
              valore={b.allegati}
              onChange={(allegati) => setB((x) => (x ? { ...x, allegati } : x))}
              visibilita={b.visibilita === 'soci' ? 'soci' : 'pubblico'}
              etichetta="+ Aggiungi foto o file"
              max={40}
              salvati={prima?.allegati}
            />
          </fieldset>
          {!fissa && (
            <fieldset>
              <legend>Chi la vede</legend>
              <div className="griglia-2">
                <button type="button" className={b.visibilita === 'pubblica' ? 'scelta attiva' : 'scelta'} aria-pressed={b.visibilita === 'pubblica'} onClick={() => setB({ ...b, visibilita: 'pubblica' })}>Tutti</button>
                <button type="button" className={b.visibilita === 'soci' ? 'scelta attiva' : 'scelta'} aria-pressed={b.visibilita === 'soci'} onClick={() => setB({ ...b, visibilita: 'soci' })}>Solo soci</button>
              </div>
            </fieldset>
          )}
          {errore && <p className="avviso errore">{errore}</p>}
          <div className="griglia-2">
            <button type="button" className="bottone contorno" onClick={annulla}>Annulla</button>
            <button type="submit" className="bottone" disabled={salvo || !valido}>{salvo ? 'Salvo…' : 'Salva'}</button>
          </div>
          {vista && <Link to={vista} className="link-bottone">Vedi la pagina nell'app</Link>}
          {prima && <button type="button" className="link-bottone pericolo" onClick={elimina}>{fissa ? 'Torna al testo predefinito' : 'Elimina la pagina'}</button>}
        </form>
      </main>
    </>
  );
}
