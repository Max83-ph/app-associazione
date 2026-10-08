import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  apriPdf,
  ascoltaFirmeDocumento,
  ascoltaTuttiDocumenti,
  eliminaDocumento,
  firmaValida,
  leggiPdfComeDataUrl,
  MAX_PDF_BYTE,
  salvaDocumento,
  scaricaCopiaFirmata,
  scaricaTutteLeFirme,
  type DatiDocumento,
} from '../../lib/documenti';
import { ascoltaSoci } from '../../lib/soci';
import { Icona } from '../../components/Icona';
import type { DocumentoFirma, FirmaDocumento, Socio } from '../../types';

const VUOTO: DatiDocumento = { titolo: '', testo: '', pdf: null, pdfNome: null, attivo: true };

export function GestioneDocumenti() {
  const { utente } = useAuth();
  const [lista, setLista] = useState<DocumentoFirma[] | null>(null);
  const [soci, setSoci] = useState<Socio[]>([]);
  const [errore, setErrore] = useState('');
  const [bozza, setBozza] = useState<DatiDocumento>(VUOTO);
  const [inModifica, setInModifica] = useState<DocumentoFirma | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [aperto, setAperto] = useState<string | null>(null);

  useEffect(() => ascoltaTuttiDocumenti(setLista, (e) => setErrore(e.message)), []);
  useEffect(() => ascoltaSoci(setSoci, (e) => setErrore(e.message)), []);

  const firmatari = soci.filter((s) => s.stato === 'attivo' && s.uid);
  const valido = bozza.titolo.trim() && (bozza.testo.trim() || bozza.pdf);
  const contenutoCambiato = !!inModifica && (inModifica.testo !== bozza.testo.trim() || inModifica.pdf !== bozza.pdf);

  const scegliPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErrore('');
    if (f.type !== 'application/pdf') return setErrore('Il file deve essere un PDF.');
    if (f.size > MAX_PDF_BYTE) return setErrore(`Il PDF è troppo grande (${Math.round(f.size / 1024)} KB): il massimo è ${MAX_PDF_BYTE / 1024} KB. Prova a comprimerlo o a toglierne le immagini.`);
    setBozza((b) => ({ ...b, pdf: null, pdfNome: null }));
    const pdf = await leggiPdfComeDataUrl(f);
    setBozza((b) => ({ ...b, pdf, pdfNome: f.name }));
  };

  const annulla = () => { setInModifica(null); setBozza(VUOTO); };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    if (contenutoCambiato && !confirm('Hai cambiato il contenuto del documento: chi lo ha già firmato dovrà firmarlo di nuovo. Continuare?')) return;
    setSalvo(true);
    setErrore('');
    try {
      await salvaDocumento(inModifica?.id ?? null, bozza, contenutoCambiato, utente?.email ?? '');
      annulla();
    } catch (err) {
      setErrore(err instanceof Error ? `Salvataggio non riuscito: ${err.message}` : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  };

  const elimina = async (d: DocumentoFirma) => {
    if (!confirm(`Eliminare "${d.titolo}" e tutte le firme raccolte? Scarica prima le firme se ti servono.`)) return;
    try {
      await eliminaDocumento(d.id);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Documenti da firmare</h1>
      </header>
      <main className="contenuto">
        <p className="nota">I documenti visibili compaiono ai soci attivi nell'Area soci → Documenti, dove li leggono e li firmano con il dito.</p>
        <form className="modulo" onSubmit={salva}>
          <fieldset>
            <legend>{inModifica ? 'Modifica documento' : 'Nuovo documento'}</legend>
            <label>Titolo<input value={bozza.titolo} maxLength={120} onChange={(e) => setBozza({ ...bozza, titolo: e.target.value })} placeholder="es. Regolamento sfilata 2027" /></label>
            <label>Testo da firmare
              <textarea rows={8} value={bozza.testo} maxLength={20000} onChange={(e) => setBozza({ ...bozza, testo: e.target.value })} />
              <span className="nota">Facoltativo se alleghi un PDF: in quel caso scrivi qui una breve dichiarazione, es. "Dichiaro di aver letto e accettato il regolamento allegato".</span>
            </label>
            <div className="file-pdf">
              {bozza.pdf ? (
                <>
                  <span className="etichetta etichetta-neutro">PDF: {bozza.pdfNome}</span>
                  <button type="button" className="mini" onClick={() => setBozza({ ...bozza, pdf: null, pdfNome: null })}>Togli PDF</button>
                </>
              ) : (
                <label className="bottone contorno piccolo">
                  Allega un PDF
                  <input type="file" accept="application/pdf" onChange={scegliPdf} className="visivamente-nascosto" />
                </label>
              )}
              <span className="nota">Massimo {MAX_PDF_BYTE / 1024} KB.</span>
            </div>
            <label className="spunta"><input type="checkbox" checked={bozza.attivo} onChange={(e) => setBozza({ ...bozza, attivo: e.target.checked })} /> Visibile ai soci (da firmare)</label>
            {contenutoCambiato && <p className="avviso">Hai cambiato il contenuto: salvando, i soci dovranno firmare di nuovo.</p>}
            <div className="griglia-2">
              {inModifica ? <button type="button" className="bottone contorno" onClick={annulla}>Annulla</button> : <span />}
              <button type="submit" className="bottone" disabled={salvo || !valido}>{salvo ? 'Salvo…' : inModifica ? 'Salva' : 'Pubblica'}</button>
            </div>
          </fieldset>
        </form>
        {errore && <p className="avviso errore">{errore}</p>}
        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">Nessun documento. Creane uno qui sopra.</p>}
        <div className="lista-avvisi">
          {(lista ?? []).map((d) => (
            <article key={d.id} className="avviso-card">
              <div className="avviso-data">
                <span className={d.attivo ? 'etichetta etichetta-ok' : 'etichetta etichetta-spento'}>{d.attivo ? 'Visibile ai soci' : 'Nascosto'}</span>
                {d.pdfNome && <span className="etichetta etichetta-neutro">PDF allegato</span>}
                <span>versione {d.versione}</span>
              </div>
              <h2>{d.titolo}</h2>
              {d.testo && <p className="testo-a-capo">{d.testo.length > 280 ? d.testo.slice(0, 280) + '…' : d.testo}</p>}
              <div className="riga-azioni">
                <button type="button" className="mini" onClick={() => setAperto(aperto === d.id ? null : d.id)}>{aperto === d.id ? 'Chiudi firme' : 'Vedi firme'}</button>
                {d.pdf && <button type="button" className="mini" onClick={() => apriPdf(d)}>Apri PDF</button>}
                <button type="button" className="mini" onClick={() => { setInModifica(d); setBozza({ titolo: d.titolo, testo: d.testo, pdf: d.pdf, pdfNome: d.pdfNome, attivo: d.attivo }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Modifica</button>
                <button type="button" className="mini" onClick={() => elimina(d)}>Elimina</button>
              </div>
              {aperto === d.id && <Firme documento={d} soci={firmatari} />}
            </article>
          ))}
        </div>
      </main>
    </>
  );
}

function Firme({ documento, soci }: { documento: DocumentoFirma; soci: Socio[] }) {
  const [firme, setFirme] = useState<FirmaDocumento[] | null>(null);
  const [errore, setErrore] = useState('');
  useEffect(() => ascoltaFirmeDocumento(documento.id, setFirme, (e) => setErrore(e.message)), [documento.id]);

  if (errore) return <p className="avviso errore">{errore}</p>;
  if (!firme) return <p className="vuoto">Caricamento firme…</p>;

  const perUid = new Map(firme.map((f) => [f.uid, f]));
  const valide = firme.filter((f) => firmaValida(f, documento));
  const righe = [...soci].sort((a, b) => (a.cognome + a.nome).localeCompare(b.cognome + b.nome, 'it'));

  return (
    <div className="firme-documento">
      <p><strong>{valide.length}</strong> firme su {soci.length} soci attivi con account.</p>
      {valide.length > 0 && (
        <button type="button" className="bottone contorno piccolo" onClick={() => scaricaTutteLeFirme(valide, documento)}>Scarica tutte le firme (PDF)</button>
      )}
      <ul className="lista-iscritti">
        {righe.map((s) => {
          const f = perUid.get(s.uid!);
          const ok = firmaValida(f, documento);
          return (
            <li key={s.id} className="iscritto">
              <div className="iscritto-testa">
                <div>
                  <div className="iscritto-nome">{s.cognome} {s.nome}</div>
                  <div className="iscritto-sotto">
                    {ok ? `Firmato il ${f!.firmatoIl?.toDate().toLocaleDateString('it-IT')}` : f ? 'Firmato una versione precedente' : 'Da firmare'}
                  </div>
                </div>
                {f ? (
                  <button type="button" className="mini" onClick={() => scaricaCopiaFirmata(f, documento)}>PDF firmato</button>
                ) : (
                  <span className="etichetta etichetta-caldo">Manca</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nota">I soci inseriti a mano senza account non compaiono: possono firmare solo su carta.</p>
    </div>
  );
}
