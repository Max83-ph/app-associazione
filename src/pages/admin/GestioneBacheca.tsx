import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ascoltaAvvisi, eliminaAvviso, salvaAvviso, type DatiAvviso } from '../../lib/soci';
import { eliminaFiles } from '../../lib/file';
import { Icona } from '../../components/Icona';
import { Allegati, ModificaAllegati } from '../../components/File';
import { EditorTesto, Testo } from '../../components/TestoRicco';
import type { Avviso } from '../../types';

const VUOTO: DatiAvviso = { titolo: '', testo: '', inEvidenza: false, allegati: [] };

export function GestioneBacheca() {
  const { utente } = useAuth();
  const [lista, setLista] = useState<Avviso[] | null>(null);
  const [errore, setErrore] = useState('');
  const [bozza, setBozza] = useState<DatiAvviso>(VUOTO);
  const [inModifica, setInModifica] = useState<Avviso | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => ascoltaAvvisi(setLista, (e) => setErrore(e.message)), []);

  const valido = bozza.titolo.trim() && (bozza.testo.trim() || bozza.allegati.length);

  const annulla = () => {
    // I file caricati ma non salvati in nessun avviso vengono eliminati.
    const salvati = inModifica?.allegati ?? [];
    eliminaFiles(bozza.allegati.filter((f) => !salvati.some((x) => x.id === f.id)).map((f) => f.id));
    setInModifica(null);
    setBozza(VUOTO);
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaAvviso(inModifica?.id ?? null, bozza, utente?.email ?? '', inModifica?.allegati ?? []);
      setBozza(VUOTO);
      setInModifica(null);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  };

  const elimina = async (a: Avviso) => {
    if (!confirm(`Eliminare l'avviso "${a.titolo}"${a.allegati?.length ? ' e i suoi allegati' : ''}?`)) return;
    await eliminaAvviso(a).catch((err) => setErrore(err instanceof Error ? err.message : 'Eliminazione non riuscita.'));
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Bacheca soci</h1>
      </header>
      <main className="contenuto">
        <form className="modulo" onSubmit={salva}>
          <fieldset>
            <legend>{inModifica ? 'Modifica avviso' : 'Nuovo avviso'}</legend>
            <label>Titolo<input value={bozza.titolo} onChange={(e) => setBozza({ ...bozza, titolo: e.target.value })} maxLength={120} /></label>
            <div className="etichetta-campo">Testo</div>
            <EditorTesto etichetta="Testo dell'avviso" valore={bozza.testo} onChange={(testo) => setBozza((b) => ({ ...b, testo }))} max={8000} />
            <div className="etichetta-campo">Foto e file allegati</div>
            <ModificaAllegati valore={bozza.allegati} onChange={(allegati) => setBozza((b) => ({ ...b, allegati }))} visibilita="soci" etichetta="+ Aggiungi foto o file" salvati={inModifica?.allegati} />
            <label className="spunta"><input type="checkbox" checked={bozza.inEvidenza} onChange={(e) => setBozza({ ...bozza, inEvidenza: e.target.checked })} /> In evidenza (resta in cima)</label>
            <div className="griglia-2">
              {inModifica || bozza.allegati.length ? (
                <button type="button" className="bottone contorno" onClick={annulla}>Annulla</button>
              ) : <span />}
              <button type="submit" className="bottone" disabled={salvo || !valido}>
                {salvo ? 'Pubblico…' : inModifica ? 'Salva' : 'Pubblica'}
              </button>
            </div>
          </fieldset>
        </form>
        {errore && <p className="avviso errore">{errore}</p>}
        <p className="nota">Gli avvisi e i loro allegati li vedono solo i soci attivi, nell'Area soci.</p>
        {lista?.length === 0 && <p className="vuoto">Nessun avviso pubblicato.</p>}
        <div className="lista-avvisi">
          {(lista ?? []).map((a) => (
            <article key={a.id} className={a.inEvidenza ? 'avviso-card evidenza' : 'avviso-card'}>
              <div className="avviso-data">
                {a.inEvidenza && <span className="etichetta etichetta-caldo">In evidenza</span>}
                {a.createdAt?.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <h2>{a.titolo}</h2>
              <Testo testo={a.testo} />
              <Allegati lista={a.allegati} />
              <div className="riga-azioni">
                <button type="button" className="mini" onClick={() => { setInModifica(a); setBozza({ titolo: a.titolo, testo: a.testo, inEvidenza: a.inEvidenza, allegati: a.allegati ?? [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifica</button>
                <button type="button" className="mini" onClick={() => elimina(a)}>Elimina</button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
