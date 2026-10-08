import { useEffect, useState } from 'react';
import { Firma } from '../../components/Firma';
import { apriPdf, ascoltaDocumentiAttivi, ascoltaMieFirme, firmaDocumento, firmaValida, scaricaCopiaFirmata } from '../../lib/documenti';
import type { DocumentoFirma, FirmaDocumento, Socio } from '../../types';

const PDF_INFORMATIVA = '/documenti/informativa-privacy-soci.pdf';

export interface StatoDocumenti {
  documenti: DocumentoFirma[] | null;
  firme: Map<string, FirmaDocumento>;
  daFirmare: number;
  errore: string;
}

/** Documenti visibili e firme del socio, condivisi tra la scheda e il contatore. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDocumentiSocio(uid: string): StatoDocumenti {
  const [documenti, setDocumenti] = useState<DocumentoFirma[] | null>(null);
  const [mie, setMie] = useState<FirmaDocumento[]>([]);
  const [errore, setErrore] = useState('');
  useEffect(() => ascoltaDocumentiAttivi(setDocumenti, (e) => setErrore(e.message)), []);
  useEffect(() => ascoltaMieFirme(uid, setMie, (e) => setErrore(e.message)), [uid]);
  const firme = new Map(mie.map((f) => [f.documentoId, f]));
  const daFirmare = (documenti ?? []).filter((d) => !firmaValida(firme.get(d.id), d)).length;
  return { documenti, firme, daFirmare, errore };
}

export function DocumentiSoci({ socio, uid, stato }: { socio: Socio; uid: string; stato: StatoDocumenti }) {
  const [aperto, setAperto] = useState<string | null>(null);
  const { documenti, firme, errore } = stato;
  const doc = documenti?.find((d) => d.id === aperto);

  if (doc) return <Documento d={doc} f={firme.get(doc.id)} socio={socio} uid={uid} onChiudi={() => setAperto(null)} />;

  return (
    <>
      {errore && <p className="avviso errore">Impossibile caricare i documenti: {errore}</p>}
      {documenti === null && !errore && <p className="vuoto">Caricamento…</p>}
      {documenti && documenti.length > 0 && (
        <div className="lista-avvisi">
          {documenti.map((d) => {
            const f = firme.get(d.id);
            const ok = firmaValida(f, d);
            return (
              <button type="button" key={d.id} className="avviso-card documento-card" onClick={() => setAperto(d.id)}>
                <div className="avviso-data">
                  <span className={ok ? 'etichetta etichetta-ok' : 'etichetta etichetta-caldo'}>
                    {ok ? 'Firmato' : f ? 'Aggiornato: da rifirmare' : 'Da firmare'}
                  </span>
                </div>
                <h2>{d.titolo}</h2>
                <span className="nota">{ok ? `Firmato il ${f!.firmatoIl?.toDate().toLocaleDateString('it-IT')}. Tocca per rivederlo.` : 'Tocca per leggerlo e firmarlo.'}</span>
              </button>
            );
          })}
        </div>
      )}
      {documenti?.length === 0 && <p className="vuoto">Nessun documento da firmare per ora.</p>}
      <div className="pannello">
        <h2>Informativa privacy</h2>
        <p>L'informativa sul trattamento dei dati personali dei soci, con il modulo di consenso. Il PDF è compilabile: puoi scrivere nome, codice fiscale, luogo e data direttamente dal telefono o dal computer.</p>
        <div className="riga-azioni">
          <a className="bottone piccolo" href={PDF_INFORMATIVA} target="_blank" rel="noopener">Apri il PDF</a>
          <a className="bottone contorno piccolo" href={PDF_INFORMATIVA} download="Informativa privacy soci - Rione Cappuccini.pdf">Scarica</a>
        </div>
      </div>
    </>
  );
}

function Documento({ d, f, socio, uid, onChiudi }: { d: DocumentoFirma; f?: FirmaDocumento; socio: Socio; uid: string; onChiudi: () => void }) {
  const [letto, setLetto] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  const ok = firmaValida(f, d);

  const firmaOra = async () => {
    if (!firma || !letto) return;
    setInvio(true);
    setErrore('');
    try {
      await firmaDocumento(d, socio, uid, firma);
    } catch {
      setErrore('Firma non salvata. Controlla la connessione e riprova; se il problema resta scrivi agli organizzatori.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <div className="modulo">
      <button type="button" className="link-bottone" onClick={onChiudi}>← Tutti i documenti</button>
      <div className="pannello">
        <h2>{d.titolo}</h2>
        {d.pdf && (
          <div className="riga-azioni">
            <button type="button" className="bottone contorno piccolo" onClick={() => apriPdf(d)}>Apri il documento (PDF)</button>
            <span className="nota">{d.pdfNome}</span>
          </div>
        )}
        {d.testo && <p className="testo-a-capo">{d.testo}</p>}
      </div>

      {ok ? (
        <div className="pannello">
          <p><strong>Hai firmato questo documento</strong> il {f!.firmatoIl?.toDate().toLocaleString('it-IT')}.</p>
          <img src={f!.firma} alt="La tua firma" className="firma-img" />
          <button type="button" className="bottone contorno piccolo" onClick={() => scaricaCopiaFirmata(f!, d)}>Scarica la copia firmata</button>
        </div>
      ) : (
        <fieldset>
          <legend>Firma</legend>
          {f && <p className="avviso">Il documento è stato aggiornato dopo la tua firma: rileggilo e firma di nuovo.</p>}
          <label className="spunta">
            <input type="checkbox" checked={letto} onChange={(e) => setLetto(e.target.checked)} />
            {d.pdf ? 'Ho letto il documento allegato e quanto scritto sopra' : 'Ho letto il documento'}
          </label>
          <p className="nota">Firma qui sotto con il dito, come {socio.nome} {socio.cognome}.</p>
          <Firma onChange={setFirma} />
          {errore && <p className="avviso errore">{errore}</p>}
          <button type="button" className="bottone" disabled={!letto || !firma || invio} onClick={firmaOra}>{invio ? 'Salvo la firma…' : 'Firma il documento'}</button>
        </fieldset>
      )}
    </div>
  );
}
