import { useEffect, useState } from 'react';
import {
  ascoltaImpostazioniIscrizione,
  normalizzaCodiceIscrizione,
  salvaImpostazioniIscrizione,
  type ImpostazioniIscrizione,
} from '../../lib/soci';
import { qrLinkDataUrl } from '../../lib/biglietto';

/** Riquadro in Gestione → Soci: codice, apertura delle iscrizioni, link e QR. */
export function IscrizioneOnline() {
  const [imp, setImp] = useState<ImpostazioniIscrizione | null | undefined>(undefined);
  const [codice, setCodice] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [msg, setMsg] = useState('');
  const [qr, setQr] = useState('');
  const link = `${window.location.origin}/soci/iscrizione`;

  useEffect(
    () =>
      ascoltaImpostazioniIscrizione(
        (i) => {
          setImp(i);
          setCodice(i?.codice ?? '');
        },
        () => setImp(null),
      ),
    [],
  );
  useEffect(() => {
    qrLinkDataUrl(link).then(setQr);
  }, [link]);

  const pulito = normalizzaCodiceIscrizione(codice);
  const valido = pulito.length >= 4 && pulito.length <= 30;
  const cambiato = pulito !== (imp?.codice ?? '');

  const salva = async (attiva: boolean) => {
    setMsg('');
    setSalvo(true);
    try {
      await salvaImpostazioniIscrizione({ codice: pulito, attiva }, imp?.codice ?? null);
      setMsg(attiva ? 'Salvato: le iscrizioni sono aperte con questo codice.' : 'Iscrizioni chiuse.');
    } catch (e) {
      setMsg(`Salvataggio non riuscito: ${e instanceof Error ? e.message : 'errore'}`);
    } finally {
      setSalvo(false);
    }
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMsg('Link copiato.');
    } catch {
      setMsg(link);
    }
  };

  if (imp === undefined) return null;
  const aperta = !!imp?.attiva;

  return (
    <section className="pannello">
      <h2>Iscrizione online</h2>
      <p className="nota">
        Il link di iscrizione non compare sul sito: lo condividete voi. Chi lo apre deve inserire il codice. Cambiando il codice, quello vecchio smette subito di funzionare.
      </p>
      <div className="riga-stato">
        <span className={aperta ? 'etichetta etichetta-ok' : 'etichetta etichetta-spento'}>{aperta ? 'Iscrizioni aperte' : 'Iscrizioni chiuse'}</span>
      </div>

      <label>Codice di iscrizione
        <input
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          placeholder="es. CAPPU2026"
          maxLength={30}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="maiuscolo"
        />
        <span className="nota">Da 4 a 30 caratteri: lettere, numeri e trattino.</span>
      </label>
      <div className="riga-azioni">
        <button type="button" className="bottone piccolo" disabled={salvo || !valido || (aperta && !cambiato)} onClick={() => salva(true)}>
          {aperta ? 'Salva il nuovo codice' : 'Apri le iscrizioni'}
        </button>
        {aperta && (
          <button type="button" className="bottone contorno piccolo" disabled={salvo} onClick={() => salva(false)}>Chiudi le iscrizioni</button>
        )}
      </div>

      <div className="etichetta-campo">Link da condividere</div>
      <div className="link-iscrizione">
        <code>{link}</code>
        <button type="button" className="mini" onClick={copia}>Copia</button>
      </div>
      <div className="qr-iscrizione">
        {qr && <img src={qr} width={120} height={120} alt="QR del link di iscrizione" />}
        {qr && <a className="bottone contorno piccolo" href={qr} download="qr-iscrizione-soci.png">Scarica il QR</a>}
      </div>
      {msg && <p className="avviso">{msg}</p>}
    </section>
  );
}
