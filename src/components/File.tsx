import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { apriFile, caricaFile, dimensioneLeggibile, eliminaFile, isImmagine, leggiFile, type RifFile, type Visibilita } from '../lib/file';

function useUrlFile(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [errore, setErrore] = useState(false);
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    let creato: string | null = null;
    leggiFile(id)
      .then((b) => { if (vivo) { creato = URL.createObjectURL(b); setUrl(creato); } })
      .catch(() => vivo && setErrore(true));
    return () => { vivo = false; if (creato) URL.revokeObjectURL(creato); };
  }, [id]);
  return { url, errore };
}

export function ImmagineFile({ rif, alt, className }: { rif: RifFile; alt: string; className?: string }) {
  const { url, errore } = useUrlFile(rif.id);
  if (errore) return <div className={`immagine-segnaposto ${className ?? ''}`}>Foto non disponibile</div>;
  if (!url) return <div className={`immagine-segnaposto ${className ?? ''}`} aria-busy="true" />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

/** Foto in griglia (toccandole si aprono grandi) e altri file come elenco da scaricare. */
export function Allegati({ lista, titoloFoto = 'Foto' }: { lista: RifFile[] | undefined; titoloFoto?: string }) {
  const [errore, setErrore] = useState('');
  if (!lista?.length) return null;
  const foto = lista.filter((f) => isImmagine(f.tipo));
  const altri = lista.filter((f) => !isImmagine(f.tipo));
  const apri = (f: RifFile, scarica = false) => apriFile(f, scarica).catch(() => setErrore(`Impossibile aprire "${f.nome}".`));
  return (
    <div className="allegati">
      {foto.length > 0 && (
        <div className="galleria" aria-label={titoloFoto}>
          {foto.map((f) => (
            <button key={f.id} type="button" className="galleria-foto" onClick={() => apri(f)} aria-label={`Apri ${f.nome}`}>
              <ImmagineFile rif={f} alt={f.nome} />
            </button>
          ))}
        </div>
      )}
      {altri.length > 0 && (
        <ul className="elenco-file">
          {altri.map((f) => (
            <li key={f.id}>
              <button type="button" className="file-riga" onClick={() => apri(f)}>
                <span className="file-icona" aria-hidden="true">{estensione(f.nome)}</span>
                <span className="file-nome">{f.nome}</span>
                <span className="file-peso">{dimensioneLeggibile(f.dimensione)}</span>
              </button>
              <button type="button" className="mini" onClick={() => apri(f, true)}>Scarica</button>
            </li>
          ))}
        </ul>
      )}
      {errore && <p className="avviso errore">{errore}</p>}
    </div>
  );
}

const estensione = (nome: string) => (/\.([a-z0-9]{1,4})$/i.exec(nome)?.[1] ?? 'file').toUpperCase();

/**
 * Per i moduli di gestione: elenco dei file allegati con "Togli" e pulsante per aggiungerne.
 * I file vengono caricati subito. Un file appena caricato e poi tolto viene eliminato qui;
 * quelli già salvati (`salvati`) li elimina il chiamante quando salva.
 */
export function ModificaAllegati({
  valore,
  onChange,
  visibilita,
  soloImmagini = false,
  etichetta = 'Aggiungi file',
  max = 20,
  salvati = [],
}: {
  valore: RifFile[];
  onChange: (l: RifFile[]) => void;
  visibilita: Visibilita;
  soloImmagini?: boolean;
  etichetta?: string;
  max?: number;
  salvati?: RifFile[];
}) {
  const { utente } = useAuth();
  const [stato, setStato] = useState('');
  const [errore, setErrore] = useState('');

  const aggiungi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setErrore('');
    let lista = valore;
    for (const [i, f] of files.slice(0, Math.max(0, max - valore.length)).entries()) {
      try {
        setStato(`Carico ${i + 1} di ${files.length}: ${f.name}…`);
        const rif = await caricaFile(f, visibilita, utente?.email ?? '', (p) => setStato(`Carico ${i + 1} di ${files.length}: ${f.name} (${Math.round(p * 100)}%)`));
        lista = [...lista, rif];
        onChange(lista);
      } catch (err) {
        setErrore(err instanceof Error ? err.message : `Caricamento di "${f.name}" non riuscito.`);
      }
    }
    if (files.length > max - valore.length) setErrore(`Massimo ${max} file.`);
    setStato('');
  };

  const togli = (f: RifFile) => {
    onChange(valore.filter((x) => x.id !== f.id));
    if (!salvati.some((x) => x.id === f.id)) eliminaFile(f.id).catch(() => undefined);
  };

  const sposta = (i: number, d: -1 | 1) => {
    const l = [...valore];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    onChange(l);
  };

  return (
    <div className="modifica-allegati">
      {valore.length > 0 && (
        <ul className="elenco-file modifica">
          {valore.map((f, i) => (
            <li key={f.id}>
              {isImmagine(f.tipo) ? <ImmagineFile rif={f} alt={f.nome} className="miniatura" /> : <span className="file-icona" aria-hidden="true">{estensione(f.nome)}</span>}
              <span className="file-nome">{f.nome}<span className="file-peso"> · {dimensioneLeggibile(f.dimensione)}</span></span>
              {valore.length > 1 && (
                <>
                  <button type="button" className="mini" disabled={i === 0} onClick={() => sposta(i, -1)} aria-label={`Sposta su ${f.nome}`}>↑</button>
                  <button type="button" className="mini" disabled={i === valore.length - 1} onClick={() => sposta(i, 1)} aria-label={`Sposta giù ${f.nome}`}>↓</button>
                </>
              )}
              <button type="button" className="mini" onClick={() => togli(f)}>Togli</button>
            </li>
          ))}
        </ul>
      )}
      {valore.length < max && (
        <label className={stato ? 'bottone contorno piccolo disabilitato' : 'bottone contorno piccolo'}>
          {stato || etichetta}
          <input type="file" multiple accept={soloImmagini ? 'image/*' : undefined} onChange={aggiungi} disabled={!!stato} className="visivamente-nascosto" />
        </label>
      )}
      <span className="nota">
        {soloImmagini ? 'Le foto vengono ridotte automaticamente.' : `Foto, PDF, Word, Excel… fino a ${dimensioneLeggibile(8 * 1024 * 1024)} per file; le foto vengono ridotte automaticamente.`}
        {visibilita === 'soci' ? ' Visibili solo ai soci.' : ' Visibili a tutti.'}
      </span>
      {errore && <p className="avviso errore">{errore}</p>}
    </div>
  );
}
