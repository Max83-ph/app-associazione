import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { annoCorrente, ascoltaSoci } from '../../lib/soci';
import { importaSoci, leggiExcel, scaricaModello, type RigaImport } from '../../lib/importaSoci';
import { Icona } from '../../components/Icona';
import type { Socio } from '../../types';

export function ImportaSoci() {
  const anno = annoCorrente();
  const [esistenti, setEsistenti] = useState<Socio[] | null>(null);
  const [righe, setRighe] = useState<RigaImport[] | null>(null);
  const [mancanti, setMancanti] = useState<string[]>([]);
  const [nomeFile, setNomeFile] = useState('');
  const [errore, setErrore] = useState('');
  const [stato, setStato] = useState('');
  const [fatto, setFatto] = useState<number | null>(null);

  useEffect(() => ascoltaSoci(setEsistenti, (e) => setErrore(e.message)), []);

  const scegli = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !esistenti) return;
    setErrore('');
    setFatto(null);
    setRighe(null);
    setStato('Leggo il file…');
    try {
      const r = await leggiExcel(f, esistenti);
      setRighe(r.righe);
      setMancanti(r.mancanti);
      setNomeFile(f.name);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'File non leggibile. Usa un file Excel (.xlsx).');
    } finally {
      setStato('');
    }
  };

  const valide = (righe ?? []).filter((r) => !r.problemi.length);
  const scartate = (righe ?? []).filter((r) => r.problemi.length);

  const importa = async () => {
    if (!valide.length) return;
    if (!confirm(`Importare ${valide.length} soci come attivi?`)) return;
    setErrore('');
    setStato(`Importo 0 di ${valide.length}…`);
    try {
      const n = await importaSoci(valide, anno, (k) => setStato(`Importo ${k} di ${valide.length}…`));
      setFatto(n);
      setRighe(null);
    } catch (err) {
      setErrore(`Importazione interrotta: ${err instanceof Error ? err.message : 'errore'}. Controlla l'elenco soci prima di riprovare, per non creare doppioni.`);
    } finally {
      setStato('');
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin/soci" className="indietro-chiaro" aria-label="Torna ai soci"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Importa soci da Excel</h1>
      </header>
      <main className="contenuto">
        <div className="pannello">
          <h2>1. Prepara il file</h2>
          <p>Scarica il modello, incolla l'elenco dei soci (una riga per socio) e salvalo. Va bene anche un vostro file Excel, se ha le colonne con gli stessi nomi.</p>
          <button type="button" className="bottone contorno piccolo" onClick={() => scaricaModello()}>Scarica il modello Excel</button>
        </div>

        <div className="pannello">
          <h2>2. Carica il file</h2>
          <p className="nota">Prima di salvare ti mostro chi verrà importato e quali righe hanno problemi. I soci già presenti (stesso codice fiscale) vengono saltati.</p>
          <label className={stato || !esistenti ? 'bottone piccolo disabilitato' : 'bottone piccolo'}>
            {stato || 'Scegli il file Excel'}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={scegli} disabled={!!stato || !esistenti} className="visivamente-nascosto" />
          </label>
        </div>

        {errore && <p className="avviso errore">{errore}</p>}
        {fatto !== null && (
          <div className="pannello">
            <h2>Fatto</h2>
            <p>Importati <strong>{fatto}</strong> soci. Li trovi in <Link to="/admin/soci">Gestione → Soci</Link>; da ogni scheda puoi creare l'account per l'app e allegare il modulo firmato.</p>
          </div>
        )}

        {righe && (
          <div className="pannello">
            <h2>3. Controlla e importa</h2>
            <p>File <strong>{nomeFile}</strong>: {righe.length} righe, <strong>{valide.length} pronte</strong>{scartate.length ? `, ${scartate.length} da correggere` : ''}.</p>
            {mancanti.length > 0 && <p className="avviso">Nel file mancano le colonne: {mancanti.join(', ')}. Le righe risulteranno incomplete.</p>}
            {valide.length > 0 && (
              <>
                <details className="documento">
                  <summary>Vedi i {valide.length} soci da importare</summary>
                  <ul className="elenco-import">
                    {valide.map((r) => (
                      <li key={r.riga}>
                        <strong>{r.dati.cognome} {r.dati.nome}</strong> <span className="mono">{r.dati.codiceFiscale}</span>
                        {r.numeroTessera && <> · tessera {r.numeroTessera}</>}{r.quotaPagata && <> · quota {anno} pagata</>}
                      </li>
                    ))}
                  </ul>
                </details>
                <button type="button" className="bottone" disabled={!!stato} onClick={importa}>{stato || `Importa ${valide.length} soci`}</button>
              </>
            )}
            {scartate.length > 0 && (
              <>
                <h3>Righe che non importo</h3>
                <p className="nota">Correggile nel file e ricaricalo: quelle già importate verranno riconosciute e saltate.</p>
                <ul className="elenco-import errori">
                  {scartate.map((r) => (
                    <li key={r.riga}>
                      <strong>Riga {r.riga}{r.dati.cognome || r.dati.nome ? `: ${r.dati.cognome} ${r.dati.nome}` : ''}</strong>
                      <span>Manca o non va: {r.problemi.join('; ')}.</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
