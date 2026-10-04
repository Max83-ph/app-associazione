import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { ascoltaEvento, salvaEvento, type DatiEvento } from '../../lib/dati';
import { perInputDataOra } from '../../lib/format';
import { Icona } from '../../components/Icona';
import type { Evento, IconaEvento, Pubblico, StatoEvento, TipoEvento } from '../../types';

const COLORI = ['#E76F51', '#2A9D8F', '#6D597A', '#E9A23B', '#1D3557', '#C8553D'];
const ICONE: IconaEvento[] = ['pasto', 'laboratorio', 'musica', 'festa'];

interface Bozza {
  titolo: string;
  descrizione: string;
  luogo: string;
  data: string;
  chiusura: string;
  tipo: TipoEvento;
  pubblico: Pubblico;
  icona: IconaEvento;
  colore: string;
  locandina: string | null;
  prezzo: string;
  stato: StatoEvento;
  postiMax: number;
  asportoAttivo: boolean;
  porzioniMaxGiornoEvento: number;
  privacy: boolean;
  liberatoriaFoto: boolean;
}

const vuota: Bozza = {
  titolo: '',
  descrizione: '',
  luogo: 'Sede',
  data: '',
  chiusura: '',
  tipo: 'pasto',
  pubblico: 'adulti',
  icona: 'pasto',
  colore: COLORI[0],
  locandina: null,
  prezzo: '',
  stato: 'bozza',
  postiMax: 60,
  asportoAttivo: true,
  porzioniMaxGiornoEvento: 20,
  privacy: true,
  liberatoriaFoto: true,
};

function daEvento(ev: Evento): Bozza {
  return {
    titolo: ev.titolo,
    descrizione: ev.descrizione,
    luogo: ev.luogo,
    data: perInputDataOra(ev.data.toDate()),
    chiusura: ev.chiusuraIscrizioni ? perInputDataOra(ev.chiusuraIscrizioni.toDate()) : '',
    tipo: ev.tipo,
    pubblico: ev.pubblico,
    icona: ev.icona,
    colore: ev.colore,
    locandina: ev.locandina,
    prezzo: ev.prezzo,
    stato: ev.stato,
    postiMax: ev.postiMax,
    asportoAttivo: ev.asportoAttivo,
    porzioniMaxGiornoEvento: ev.porzioniMaxGiornoEvento,
    privacy: ev.documentiRichiesti.privacy,
    liberatoriaFoto: ev.documentiRichiesti.liberatoriaFoto,
  };
}

export function EventoForm() {
  const { id } = useParams();
  const nuovo = !id || id === 'nuovo';
  const navigate = useNavigate();
  const [b, setB] = useState<Bozza | null>(nuovo ? vuota : null);
  const [originale, setOriginale] = useState<Evento | null>(null);
  const [errore, setErrore] = useState('');
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (nuovo) return;
    let primo = true;
    return ascoltaEvento(id!, (ev) => {
      setOriginale(ev);
      if (ev && primo) {
        setB(daEvento(ev));
        primo = false;
      }
    }, (e) => setErrore(e.message));
  }, [id, nuovo]);

  if (!b) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  const set = <K extends keyof Bozza>(k: K, v: Bozza[K]) => setB({ ...b, [k]: v });

  const caricaLocandina = async (file: File | undefined) => {
    if (!file) return;
    try {
      set('locandina', await riduciImmagine(file));
    } catch {
      setErrore('Immagine non leggibile.');
    }
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');
    if (!b.titolo.trim() || !b.data) return setErrore('Titolo e data sono obbligatori.');
    if (originale && b.postiMax < originale.postiOccupati)
      return setErrore(`Ci sono già ${originale.postiOccupati} posti prenotati: il massimo non può essere più basso.`);
    const data = new Date(b.data);
    const inizioGiorno = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    const dati: DatiEvento = {
      titolo: b.titolo.trim(),
      descrizione: b.descrizione.trim(),
      luogo: b.luogo.trim(),
      data: Timestamp.fromDate(data),
      inizioGiorno: Timestamp.fromDate(inizioGiorno),
      chiusuraIscrizioni: b.chiusura ? Timestamp.fromDate(new Date(b.chiusura)) : null,
      tipo: b.tipo,
      pubblico: b.tipo === 'pasto' ? 'adulti' : b.pubblico,
      icona: b.icona,
      colore: b.colore,
      locandina: b.locandina,
      prezzo: b.prezzo.trim(),
      stato: b.stato,
      postiMax: b.postiMax,
      asportoAttivo: b.tipo === 'pasto' && b.asportoAttivo,
      porzioniMaxGiornoEvento: b.porzioniMaxGiornoEvento,
      documentiRichiesti: { privacy: b.privacy, liberatoriaFoto: b.tipo !== 'pasto' && b.liberatoriaFoto },
    };
    setSalvo(true);
    try {
      await salvaEvento(nuovo ? null : id!, dati);
      navigate('/admin');
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setSalvo(false);
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>{nuovo ? 'Nuovo evento' : 'Modifica evento'}</h1>
      </header>
      <main className="contenuto">
        <form className="modulo" onSubmit={salva}>
          <fieldset>
            <legend>Tipo</legend>
            <div className="griglia-3">
              {(['pasto', 'laboratorio', 'tema'] as TipoEvento[]).map((t) => (
                <button key={t} type="button" className={b.tipo === t ? 'scelta attiva' : 'scelta'} aria-pressed={b.tipo === t}
                  onClick={() => setB({ ...b, tipo: t, icona: t === 'pasto' ? 'pasto' : t === 'laboratorio' ? 'laboratorio' : 'festa' })}>
                  {t === 'pasto' ? 'Pranzo/cena' : t === 'laboratorio' ? 'Laboratorio' : 'A tema'}
                </button>
              ))}
            </div>
            {b.tipo !== 'pasto' && (
              <label>Per chi
                <select value={b.pubblico} onChange={(e) => set('pubblico', e.target.value as Pubblico)}>
                  <option value="adulti">Adulti</option>
                  <option value="bambini">Bambini (si iscrive il genitore)</option>
                  <option value="famiglie">Famiglie (si iscrive il genitore)</option>
                </select>
              </label>
            )}
          </fieldset>

          <fieldset>
            <legend>Informazioni</legend>
            <label>Titolo<input value={b.titolo} onChange={(e) => set('titolo', e.target.value)} required maxLength={80} /></label>
            <label>Descrizione<textarea rows={4} value={b.descrizione} onChange={(e) => set('descrizione', e.target.value)} maxLength={1500} /></label>
            <label>Data e ora<input type="datetime-local" value={b.data} onChange={(e) => set('data', e.target.value)} required /></label>
            <label>Luogo<input value={b.luogo} onChange={(e) => set('luogo', e.target.value)} maxLength={80} /></label>
            <label>Prezzo (facoltativo)<input value={b.prezzo} onChange={(e) => set('prezzo', e.target.value)} placeholder="es. 15 € adulti, 8 € bambini" maxLength={60} /></label>
            <label>Chiusura iscrizioni (facoltativa)<input type="datetime-local" value={b.chiusura} onChange={(e) => set('chiusura', e.target.value)} />
              <span className="nota">Se vuota, le iscrizioni restano aperte fino all'inizio dell'evento.</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Posti</legend>
            <label>Posti massimi{b.tipo === 'pasto' ? ' al tavolo' : ''}
              <input type="number" min={1} max={500} value={b.postiMax} onChange={(e) => set('postiMax', Number(e.target.value))} />
            </label>
            {originale && <p className="nota">Già prenotati: {originale.postiOccupati} posti{b.tipo === 'pasto' ? `, ${originale.porzioniPrenotate} porzioni d'asporto` : ''}.</p>}
            {b.tipo === 'pasto' && (
              <>
                <label className="spunta"><input type="checkbox" checked={b.asportoAttivo} onChange={(e) => set('asportoAttivo', e.target.checked)} /> Prenotazione asporto</label>
                {b.asportoAttivo && (
                  <label>Porzioni d'asporto massime (totale), valido dal giorno dell'evento
                    <input type="number" min={0} max={1000} value={b.porzioniMaxGiornoEvento} onChange={(e) => set('porzioniMaxGiornoEvento', Number(e.target.value))} />
                    <span className="nota">Fino alla sera prima l'asporto è illimitato; dal giorno dell'evento si accetta solo fino a questo totale.</span>
                  </label>
                )}
              </>
            )}
          </fieldset>

          {b.tipo !== 'pasto' && (
            <fieldset>
              <legend>Documenti da firmare</legend>
              <label className="spunta"><input type="checkbox" checked={b.privacy} onChange={(e) => set('privacy', e.target.checked)} /> Informativa privacy con firma</label>
              <label className="spunta"><input type="checkbox" checked={b.liberatoriaFoto} onChange={(e) => set('liberatoriaFoto', e.target.checked)} /> Liberatoria foto e video</label>
            </fieldset>
          )}

          <fieldset>
            <legend>Aspetto</legend>
            <div className="etichetta-campo">Colore</div>
            <div className="colori">
              {COLORI.map((c) => (
                <button key={c} type="button" className={b.colore === c ? 'colore attivo' : 'colore'} style={{ background: c }} aria-label={`Colore ${c}`} aria-pressed={b.colore === c} onClick={() => set('colore', c)} />
              ))}
            </div>
            <div className="etichetta-campo">Icona (se non c'è la locandina)</div>
            <div className="colori">
              {ICONE.map((i) => (
                <button key={i} type="button" className={b.icona === i ? 'icona-scelta attiva' : 'icona-scelta'} style={{ background: b.colore }} aria-label={`Icona ${i}`} aria-pressed={b.icona === i} onClick={() => set('icona', i)}>
                  <Icona nome={i} size={22} />
                </button>
              ))}
            </div>
            <label>Locandina (facoltativa)
              <input type="file" accept="image/*" onChange={(e) => caricaLocandina(e.target.files?.[0])} />
            </label>
            {b.locandina && (
              <div className="anteprima-locandina">
                <img src={b.locandina} alt="Anteprima locandina" />
                <button type="button" className="link-bottone" onClick={() => set('locandina', null)}>Rimuovi locandina</button>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Pubblicazione</legend>
            <div className="griglia-3">
              {(['bozza', 'aperto', 'chiuso'] as StatoEvento[]).map((s) => (
                <button key={s} type="button" className={b.stato === s ? 'scelta attiva' : 'scelta'} aria-pressed={b.stato === s} onClick={() => set('stato', s)}>
                  {s === 'bozza' ? 'Bozza' : s === 'aperto' ? 'Iscrizioni aperte' : 'Iscrizioni chiuse'}
                </button>
              ))}
            </div>
            <p className="nota">Le bozze non compaiono nella Home.</p>
          </fieldset>

          {errore && <p className="avviso errore">{errore}</p>}
          <button type="submit" className="bottone" disabled={salvo}>{salvo ? 'Salvataggio…' : 'Salva evento'}</button>
          {!nuovo && <LinkEvento id={id!} />}
        </form>
      </main>
    </>
  );
}

function LinkEvento({ id }: { id: string }) {
  const url = `${window.location.origin}/evento/${id}`;
  return (
    <p className="nota">Link diretto da condividere: <a href={url}>{url}</a>. Il QR per la locandina lo trovi nella pagina Iscritti.</p>
  );
}

/** Riduce l'immagine a max 900px e JPEG ~80%: resta sotto i 300 KB nel database. */
function riduciImmagine(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scala = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scala);
      c.height = Math.round(img.height * scala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.8;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 300_000 && q > 0.4) {
        q -= 0.1;
        out = c.toDataURL('image/jpeg', q);
      }
      URL.revokeObjectURL(img.src);
      resolve(out);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
