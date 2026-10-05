import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ascoltaAvvisi, eliminaAvviso, salvaAvviso } from '../../lib/soci';
import { Icona } from '../../components/Icona';
import type { Avviso } from '../../types';

const VUOTO = { titolo: '', testo: '', inEvidenza: false };

export function GestioneBacheca() {
  const { utente } = useAuth();
  const [lista, setLista] = useState<Avviso[] | null>(null);
  const [errore, setErrore] = useState('');
  const [bozza, setBozza] = useState(VUOTO);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => ascoltaAvvisi(setLista, (e) => setErrore(e.message)), []);

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bozza.titolo.trim() || !bozza.testo.trim()) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaAvviso(inModifica, bozza, utente?.email ?? '');
      setBozza(VUOTO);
      setInModifica(null);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
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
            <label>Testo<textarea rows={5} value={bozza.testo} onChange={(e) => setBozza({ ...bozza, testo: e.target.value })} maxLength={4000} /></label>
            <label className="spunta"><input type="checkbox" checked={bozza.inEvidenza} onChange={(e) => setBozza({ ...bozza, inEvidenza: e.target.checked })} /> In evidenza (resta in cima)</label>
            <div className="griglia-2">
              {inModifica ? (
                <button type="button" className="bottone contorno" onClick={() => { setInModifica(null); setBozza(VUOTO); }}>Annulla</button>
              ) : <span />}
              <button type="submit" className="bottone" disabled={salvo || !bozza.titolo.trim() || !bozza.testo.trim()}>
                {salvo ? 'Pubblico…' : inModifica ? 'Salva' : 'Pubblica'}
              </button>
            </div>
          </fieldset>
        </form>
        {errore && <p className="avviso errore">{errore}</p>}
        <p className="nota">Gli avvisi li vedono solo i soci attivi, nell'Area soci.</p>
        {lista?.length === 0 && <p className="vuoto">Nessun avviso pubblicato.</p>}
        <div className="lista-avvisi">
          {(lista ?? []).map((a) => (
            <article key={a.id} className={a.inEvidenza ? 'avviso-card evidenza' : 'avviso-card'}>
              <div className="avviso-data">
                {a.inEvidenza && <span className="etichetta etichetta-caldo">In evidenza</span>}
                {a.createdAt?.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <h2>{a.titolo}</h2>
              <p>{a.testo}</p>
              <div className="riga-azioni">
                <button type="button" className="mini" onClick={() => { setInModifica(a.id); setBozza({ titolo: a.titolo, testo: a.testo, inEvidenza: a.inEvidenza }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifica</button>
                <button type="button" className="mini" onClick={() => eliminaAvviso(a.id)}>Elimina</button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
