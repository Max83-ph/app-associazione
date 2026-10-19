import { useEffect, useState } from 'react';
import codiceScript from '../../../strumenti/email-biglietti.gs?raw';
import { ascoltaConfigEmail, inviaBigliettoEmail, salvaConfigEmail, URL_SCRIPT_VALIDO } from '../../lib/emailBiglietti';
import { normalizzaCodice } from '../../lib/codice';

/** Riquadro in Gestione → Informative e contatti: attiva l'invio dei biglietti via email. */
export function EmailBiglietti() {
  const [attuale, setAttuale] = useState<string | null | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [prova, setProva] = useState('');
  const [lavoro, setLavoro] = useState(false);

  useEffect(() => ascoltaConfigEmail((u) => { setAttuale(u); setUrl(u ?? ''); }), []);
  if (attuale === undefined) return null;
  const valido = URL_SCRIPT_VALIDO.test(url.trim());

  const salva = async (nuovo: string) => {
    setMsg('');
    try {
      await salvaConfigEmail(nuovo);
      setMsg(nuovo ? 'Salvato: da ora i biglietti partono anche via email.' : 'Invio email disattivato.');
    } catch (e) {
      setMsg(`Salvataggio non riuscito: ${e instanceof Error ? e.message : 'errore'}`);
    }
  };

  const copia = async () => {
    try { await navigator.clipboard.writeText(codiceScript); setMsg('Codice dello script copiato.'); } catch { setMsg('Copia non riuscita: seleziona il testo a mano.'); }
  };

  const manda = async () => {
    setLavoro(true);
    setMsg('');
    const esito = await inviaBigliettoEmail(normalizzaCodice(prova), url.trim());
    setMsg({ inviata: 'Email inviata all\'indirizzo della prenotazione: controlla (anche nello Spam).', limite: 'Questo biglietto è già stato inviato 3 volte: prova con un altro.', errore: 'Invio non riuscito: controlla il codice del biglietto e che lo script sia pubblicato come "Chiunque".' }[esito]);
    setLavoro(false);
  };

  return (
    <section className="pannello">
      <h2>Email dei biglietti</h2>
      <span className={attuale ? 'etichetta etichetta-ok' : 'etichetta etichetta-spento'} style={{ width: 'fit-content' }}>
        {attuale ? 'Attivo: il biglietto parte anche via email' : 'Non attivo'}
      </span>
      <p className="nota">
        Il biglietto viene spedito dalla casella Gmail del comitato tramite un piccolo script Google, gratis (fino a circa 100 email al giorno).
        Chi si iscrive vede l'avviso di controllare lo Spam se l'email non arriva.
      </p>
      <details className="documento">
        <summary>Come attivarlo (una volta sola, 5 minuti, dal computer)</summary>
        <ol className="passi">
          <li>Entra in Google con l'account del comitato (es. comitato.cappuccini@gmail.com) e apri <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com → Nuovo progetto</a>.</li>
          <li>Cancella il testo che c'è, poi <button type="button" className="mini" onClick={copia}>copia il codice dello script</button> e incollalo. Salva (icona del dischetto) e chiamalo "Email biglietti".</li>
          <li>In alto scegli la funzione <strong>prova</strong> e premi <strong>Esegui</strong>. Google chiede i permessi: Consenti (se compare "app non verificata": Avanzate → Vai a Email biglietti). Ti arriva un'email di prova.</li>
          <li>Premi <strong>Esegui il deployment → Nuovo deployment</strong>, tipo <strong>App web</strong>. "Esegui come": <strong>Me</strong>; "Chi ha accesso": <strong>Chiunque</strong>. Conferma.</li>
          <li>Copia l'<strong>URL dell'app web</strong> (finisce con <code>/exec</code>), incollalo qui sotto e premi Salva.</li>
        </ol>
      </details>
      <label>URL dello script
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" spellCheck={false} />
        {url && !valido && <span className="nota">Deve iniziare con https://script.google.com/macros/s/ e finire con /exec.</span>}
      </label>
      <div className="riga-azioni">
        <button type="button" className="bottone piccolo" disabled={!valido || url.trim() === attuale} onClick={() => salva(url.trim())}>Salva</button>
        {attuale && <button type="button" className="bottone contorno piccolo" onClick={() => { setUrl(''); salva(''); }}>Disattiva</button>}
      </div>
      {valido && (
        <div className="riga-codice">
          <input value={prova} onChange={(e) => setProva(e.target.value.toUpperCase())} placeholder="Codice di un biglietto di prova" className="maiuscolo" />
          <button type="button" className="mini" disabled={lavoro || normalizzaCodice(prova).length < 10} onClick={manda}>{lavoro ? 'Invio…' : 'Prova'}</button>
        </div>
      )}
      {msg && <p className="avviso">{msg}</p>}
    </section>
  );
}
