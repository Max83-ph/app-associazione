import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ascoltaArchivio, eliminaVoce, perCartella, salvaVoce, type VoceArchivio } from '../../lib/archivio';
import { eliminaFile, type RifFile } from '../../lib/file';
import { Icona } from '../../components/Icona';
import { Allegati, ModificaAllegati } from '../../components/File';

interface Bozza { cartella: string; titolo: string; descrizione: string; file: RifFile[] }
const VUOTA: Bozza = { cartella: '', titolo: '', descrizione: '', file: [] };

export function GestioneArchivio() {
  const { utente } = useAuth();
  const [lista, setLista] = useState<VoceArchivio[] | null>(null);
  const [errore, setErrore] = useState('');
  const [b, setB] = useState<Bozza>(VUOTA);
  const [inModifica, setInModifica] = useState<VoceArchivio | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => ascoltaArchivio(setLista, (e) => setErrore(e.message)), []);
  const cartelle = [...new Set((lista ?? []).map((v) => v.cartella).filter(Boolean))];
  const valido = b.file.length === 1 && (b.titolo.trim() || b.file[0]?.nome);

  const scegliFile = (l: RifFile[]) => setB((x) => ({ ...x, file: l, titolo: x.titolo || (l[0]?.nome.replace(/\.[^.]+$/, '') ?? '') }));

  const annulla = async () => {
    const f = b.file[0];
    if (f && f.id !== inModifica?.file.id) await eliminaFile(f.id).catch(() => undefined);
    setB(VUOTA);
    setInModifica(null);
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaVoce(inModifica?.id ?? null, { cartella: b.cartella, titolo: b.titolo || b.file[0].nome, descrizione: b.descrizione, file: b.file[0] }, utente?.email ?? '', inModifica?.file);
      setB(VUOTA);
      setInModifica(null);
    } catch (err) {
      setErrore(err instanceof Error ? `Salvataggio non riuscito: ${err.message}` : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  };

  const elimina = async (v: VoceArchivio) => {
    if (!confirm(`Eliminare "${v.titolo}" dall'archivio?`)) return;
    await eliminaVoce(v).catch((err) => setErrore(err instanceof Error ? err.message : 'Eliminazione non riuscita.'));
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Archivio soci</h1>
      </header>
      <main className="contenuto">
        <p className="nota">Statuto, verbali, moduli, foto: i soci attivi li trovano nell'Area soci → Documenti, divisi per cartella.</p>
        <form className="modulo" onSubmit={salva}>
          <fieldset>
            <legend>{inModifica ? 'Modifica file' : 'Aggiungi un file'}</legend>
            <ModificaAllegati valore={b.file} onChange={scegliFile} visibilita="soci" etichetta="+ Scegli il file" max={1} salvati={inModifica ? [inModifica.file] : []} />
            <label>Cartella
              <input value={b.cartella} onChange={(e) => setB({ ...b, cartella: e.target.value })} list="cartelle-archivio" maxLength={60} placeholder="es. Verbali, Statuto, Moduli" />
              <datalist id="cartelle-archivio">{cartelle.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>Titolo<input value={b.titolo} onChange={(e) => setB({ ...b, titolo: e.target.value })} maxLength={120} /></label>
            <label>Descrizione (facoltativa)<textarea rows={2} value={b.descrizione} onChange={(e) => setB({ ...b, descrizione: e.target.value })} maxLength={500} /></label>
            <div className="griglia-2">
              {inModifica || b.file.length ? <button type="button" className="bottone contorno" onClick={annulla}>Annulla</button> : <span />}
              <button type="submit" className="bottone" disabled={salvo || !valido}>{salvo ? 'Salvo…' : inModifica ? 'Salva' : 'Aggiungi all\'archivio'}</button>
            </div>
          </fieldset>
        </form>
        {errore && <p className="avviso errore">{errore}</p>}
        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">L'archivio è vuoto.</p>}
        {perCartella(lista ?? []).map(([cartella, voci]) => (
          <section key={cartella} className="cartella">
            <h2 className="titolo-sezione">{cartella}</h2>
            <div className="lista-avvisi">
              {voci.map((v) => (
                <article key={v.id} className="avviso-card">
                  <h2>{v.titolo}</h2>
                  {v.descrizione && <p className="testo-a-capo">{v.descrizione}</p>}
                  <Allegati lista={[v.file]} />
                  <div className="riga-azioni">
                    <button type="button" className="mini" onClick={() => { setInModifica(v); setB({ cartella: v.cartella, titolo: v.titolo, descrizione: v.descrizione, file: [v.file] }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifica</button>
                    <button type="button" className="mini" onClick={() => elimina(v)}>Elimina</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
