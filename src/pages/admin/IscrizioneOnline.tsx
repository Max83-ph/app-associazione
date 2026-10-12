import { useEffect, useState } from 'react';
import {
  ascoltaImpostazioniIscrizione,
  ascoltaModoIscrizione,
  normalizzaCodiceIscrizione,
  salvaImpostazioniIscrizione,
  type ModoIscrizione,
} from '../../lib/soci';
import { qrLinkDataUrl } from '../../lib/biglietto';

const MODI: { id: ModoIscrizione; titolo: string; spiegazione: string }[] = [
  { id: 'aperte', titolo: 'Aperte a tutti', spiegazione: 'Chiunque apre l\'app trova "Diventa socio" nella scheda Soci e può inviare la richiesta.' },
  { id: 'codice', titolo: 'Solo con codice', spiegazione: 'Il modulo non compare nell\'app: serve il link che condividete voi e il codice. Senza codice la richiesta viene rifiutata.' },
  { id: 'chiuse', titolo: 'Chiuse', spiegazione: 'Nessuno può inviare richieste, nemmeno con il link.' },
];

/** Riquadro in Gestione → Soci: chi può iscriversi, codice, link e QR. */
export function IscrizioneOnline() {
  const [modo, setModo] = useState<ModoIscrizione | null>(null);
  const [codiceSalvato, setCodiceSalvato] = useState<string | null | undefined>(undefined);
  const [scelta, setScelta] = useState<ModoIscrizione | null>(null);
  const [codice, setCodice] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [msg, setMsg] = useState('');
  const [qr, setQr] = useState('');
  const link = `${window.location.origin}/soci/iscrizione`;

  useEffect(() => ascoltaModoIscrizione(setModo), []);
  useEffect(
    () =>
      ascoltaImpostazioniIscrizione(
        (i) => { setCodiceSalvato(i?.codice ?? ''); setCodice(i?.codice ?? ''); },
        () => setCodiceSalvato(null),
      ),
    [],
  );
  useEffect(() => { qrLinkDataUrl(link).then(setQr); }, [link]);

  if (!modo || codiceSalvato === undefined) return null;
  const sel = scelta ?? modo;
  const pulito = normalizzaCodiceIscrizione(codice);
  const codiceOk = pulito.length >= 4 && pulito.length <= 30;
  const cambiato = sel !== modo || (sel === 'codice' && pulito !== (codiceSalvato ?? ''));
  const puoSalvare = cambiato && (sel !== 'codice' || codiceOk);

  const salva = async () => {
    setMsg('');
    setSalvo(true);
    try {
      await salvaImpostazioniIscrizione({ codice: sel === 'codice' ? pulito : (codiceSalvato ?? ''), modo: sel }, codiceSalvato ?? null);
      setScelta(null);
      setMsg({ aperte: 'Fatto: le iscrizioni sono aperte a tutti.', codice: `Fatto: ci si iscrive solo con il codice ${pulito}.`, chiuse: 'Fatto: le iscrizioni sono chiuse.' }[sel]);
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

  return (
    <section className="pannello">
      <h2>Iscrizione online</h2>
      <div className="riga-stato">
        <span className={modo === 'chiuse' ? 'etichetta etichetta-spento' : 'etichetta etichetta-ok'}>
          Adesso: {MODI.find((m) => m.id === modo)!.titolo.toLowerCase()}
        </span>
      </div>
      <div className="etichetta-campo">Chi può iscriversi</div>
      <div className="griglia-3">
        {MODI.map((m) => (
          <button key={m.id} type="button" className={sel === m.id ? 'scelta attiva' : 'scelta'} aria-pressed={sel === m.id} onClick={() => { setScelta(m.id); setMsg(''); }}>
            {m.titolo}
          </button>
        ))}
      </div>
      <p className="nota">{MODI.find((m) => m.id === sel)!.spiegazione}</p>

      {sel === 'codice' && (
        <label>Codice di iscrizione
          <input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="es. CAPPU2026" maxLength={30} autoCapitalize="characters" autoComplete="off" spellCheck={false} className="maiuscolo" />
          <span className="nota">Da 4 a 30 caratteri: lettere, numeri e trattino. Cambiandolo, quello vecchio smette subito di funzionare.</span>
        </label>
      )}
      <button type="button" className="bottone piccolo" disabled={salvo || !puoSalvare} onClick={salva}>{salvo ? 'Salvo…' : 'Salva'}</button>

      {sel !== 'chiuse' && (
        <>
          <div className="etichetta-campo">Link da condividere</div>
          <div className="link-iscrizione">
            <code>{link}</code>
            <button type="button" className="mini" onClick={copia}>Copia</button>
          </div>
          <div className="qr-iscrizione">
            {qr && <img src={qr} width={120} height={120} alt="QR del link di iscrizione" />}
            {qr && <a className="bottone contorno piccolo" href={qr} download="qr-iscrizione-soci.png">Scarica il QR</a>}
          </div>
          {sel === 'codice' && <p className="nota">Il link con il codice già inserito: <code>{link}?codice={pulito || 'CODICE'}</code></p>}
        </>
      )}
      {msg && <p className="avviso">{msg}</p>}
    </section>
  );
}
