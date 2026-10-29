import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { annullaPrenotazione, ascoltaEvento, ascoltaPrenotazione, ErrorePrenotazione } from '../lib/dati';
import { descriviModalita, qrDataUrl, scaricaPdfBiglietto } from '../lib/biglietto';
import { daPagare, euro } from '../lib/menu';
import { codiceLeggibile, normalizzaCodice } from '../lib/codice';
import { avvisoArrivo, dataBreve, dove } from '../lib/format';
import { useTesti } from '../lib/testi';
import { inviaBigliettoEmail, useEmailBiglietti, type EsitoEmail } from '../lib/emailBiglietti';
import { Icona } from '../components/Icona';
import type { Evento, Prenotazione } from '../types';

export function Biglietto() {
  const { codice: grezzo = '' } = useParams();
  const codice = normalizzaCodice(grezzo);
  const [cerca] = useSearchParams();
  const nuovo = cerca.get('nuovo') === '1';

  const [p, setP] = useState<Prenotazione | null | undefined>(undefined);
  const [qr, setQr] = useState('');
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState('');
  const [lavoro, setLavoro] = useState(false);

  const { contatti } = useTesti();
  const urlEmail = useEmailBiglietti();
  const [email, setEmail] = useState<'' | 'invio' | EsitoEmail>('');
  const [ev, setEv] = useState<Evento | null>(null);
  useEffect(() => ascoltaPrenotazione(codice, setP, () => setP(null)), [codice]);
  const eventId = p?.eventId;
  // L'evento serve per luogo, indirizzo e orario di arrivo; se non è leggibile il biglietto resta valido.
  useEffect(() => (eventId ? ascoltaEvento(eventId, setEv, () => setEv(null)) : undefined), [eventId]);
  useEffect(() => {
    qrDataUrl(codice).then(setQr);
  }, [codice]);

  if (p === undefined) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (p === null)
    return (
      <main className="contenuto">
        <p className="vuoto">Biglietto non trovato. Controlla il link ricevuto.</p>
        <Link to="/" className="bottone">Vai agli eventi</Link>
      </main>
    );

  const annullato = p.statoBiglietto === 'annullato';
  const usato = p.statoBiglietto === 'usato';
  const futuro = p.eventoData.toDate() > new Date();
  const mandaEmail = async () => {
    setEmail('invio');
    setEmail(await inviaBigliettoEmail(p.id, urlEmail));
  };
  const luogo = ev ? dove(ev, contatti.indirizzo) : null;
  const arrivo = ev ? avvisoArrivo(ev) : '';

  const annulla = async () => {
    setLavoro(true);
    setErrore('');
    try {
      await annullaPrenotazione(p.id);
      setConferma(false);
    } catch (e) {
      setErrore(e instanceof ErrorePrenotazione ? e.message : 'Non è stato possibile annullare. Riprova.');
    } finally {
      setLavoro(false);
    }
  };

  return (
    <div className="schermo-biglietto">
      <div className="esito-biglietto">
        {annullato ? (
          <>
            <h1>Prenotazione annullata</h1>
            <p>I posti sono stati liberati. Grazie per averci avvisato.</p>
          </>
        ) : nuovo ? (
          <>
            <div className="spunta-tonda"><Icona nome="ok" size={28} spessore={2.4} /></div>
            <h1>Sei iscritto!</h1>
            <p>Salva questa pagina o scarica il PDF: il QR è il tuo biglietto.</p>
            {urlEmail && <InvioAutomatico codice={p.id} url={urlEmail} indirizzo={p.email} />}
          </>
        ) : (
          <h1>Il tuo biglietto</h1>
        )}
      </div>

      <section className={annullato ? 'biglietto spento' : 'biglietto'} aria-label="Biglietto">
        <h2>{p.eventoTitolo}</h2>
        <div className="biglietto-data">{dataBreve(p.eventoData)}</div>
        {luogo?.testo && (
          <div className="biglietto-luogo">
            {luogo.mappa ? <a href={luogo.mappa} target="_blank" rel="noopener noreferrer">{luogo.testo}</a> : luogo.testo}
          </div>
        )}
        {qr && !annullato && <img className="qr" src={qr} width={220} height={220} alt={`Codice QR del biglietto ${codiceLeggibile(p.id)}`} />}
        <div className="codice">{codiceLeggibile(p.id)}</div>
        {usato && <div className="etichetta etichetta-neutro">Ingresso già registrato</div>}
        {arrivo && !annullato && <p className="avviso-arrivo">{arrivo}</p>}
        <hr />
        <dl className="dettagli">
          <div><dt>Nome</dt><dd>{p.nome} {p.cognome}</dd></div>
          <div><dt>Prenotazione</dt><dd>{descriviModalita(p)}</dd></div>
          <div><dt>Pagamento</dt><dd>{(() => { const d = daPagare(p, ev); const pagato = p.pagamento.stato !== 'da_pagare'; if (p.ordine?.length) return `${euro(p.totale ?? 0)} ${pagato ? 'pagato' : 'da pagare al ritiro'}`; if (d) return pagato ? `Effettuato (${euro(d.importo)})` : `${euro(d.importo)} da pagare all'ingresso (${d.dettaglio})`; return pagato ? 'Effettuato' : 'In loco'; })()}</dd></div>
          {p.consensi.liberatoriaFoto !== null && (
            <div><dt>Foto e video</dt><dd>{p.consensi.liberatoriaFoto ? 'Consentiti' : 'Non consentiti'}</dd></div>
          )}
        </dl>
        {!!p.ordine?.length && (
          <table className="ordine-biglietto">
            <tbody>
              {p.ordine.map((v) => (
                <tr key={v.id}><td>{v.quantita} ×</td><td>{v.nome}</td><td>{euro(v.prezzo * v.quantita)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td /><td>Totale</td><td>{euro(p.totale ?? 0)}</td></tr></tfoot>
          </table>
        )}
        {p.partecipanti.length > 0 && (
          <ul className="bambini">
            {p.partecipanti.map((b, i) => <li key={i}>{b.nome} {b.cognome}, {b.eta} anni</li>)}
          </ul>
        )}
      </section>

      {errore && <p className="avviso errore">{errore}</p>}
      {email === 'inviata' && <p className="avviso">Inviato a {p.email}. Se non lo trovi entro qualche minuto, guarda nello Spam o in Promozioni.</p>}
      {email === 'limite' && <p className="avviso">Abbiamo già mandato questo biglietto più volte: controlla nello Spam o in Promozioni, oppure scarica il PDF.</p>}
      {email === 'errore' && <p className="avviso errore">Invio non riuscito. Scarica il PDF o salva questa pagina: il QR vale lo stesso.</p>}

      {!annullato && (
        <div className="azioni-biglietto">
          <button type="button" className="bottone bianco" onClick={() => scaricaPdfBiglietto(p, ev)}>
            <Icona nome="scarica" size={18} spessore={2} /> Scarica PDF
          </button>
          {urlEmail && !nuovo && futuro && (
            <button type="button" className="bottone contorno" disabled={email === 'invio' || email === 'inviata'} onClick={mandaEmail}>
              {email === 'invio' ? 'Invio…' : email === 'inviata' ? 'Email inviata' : 'Mandamelo via email'}
            </button>
          )}
          {futuro && !usato && !conferma && (
            <button type="button" className="bottone contorno" onClick={() => setConferma(true)}>Annulla prenotazione</button>
          )}
        </div>
      )}
      {conferma && (
        <div className="conferma">
          <p>Vuoi davvero annullare? I posti torneranno disponibili per altri.</p>
          <div className="griglia-2">
            <button type="button" className="bottone contorno" onClick={() => setConferma(false)} disabled={lavoro}>No, tengo il posto</button>
            <button type="button" className="bottone pericolo" onClick={annulla} disabled={lavoro}>{lavoro ? 'Annullo…' : 'Sì, annulla'}</button>
          </div>
        </div>
      )}
      <Link to="/" className="link-chiaro">Torna agli eventi</Link>
      <Link to="/privacy" className="link-chiaro piccolo">Privacy e cookie</Link>
    </div>
  );
}

/** Subito dopo l'iscrizione: manda il biglietto via email una sola volta (anche se si ricarica la pagina). */
function InvioAutomatico({ codice, url, indirizzo }: { codice: string; url: string; indirizzo: string }) {
  const chiave = `email-biglietto-${codice}`;
  const [gia] = useState(() => {
    try { const g = sessionStorage.getItem(chiave) === '1'; sessionStorage.setItem(chiave, '1'); return g; } catch { return false; }
  });
  const [stato, setStato] = useState<'invio' | EsitoEmail>(gia ? 'inviata' : 'invio');
  useEffect(() => {
    if (!gia) inviaBigliettoEmail(codice, url).then(setStato);
  }, [codice, url, gia]);
  if (stato === 'invio') return <p className="nota-email">Ti stiamo mandando il biglietto via email…</p>;
  if (stato === 'errore') return <p className="nota-email">Non siamo riusciti a mandarti l'email: salva questa pagina o scarica il PDF.</p>;
  return (
    <p className="nota-email">
      Ti abbiamo mandato il biglietto a <strong>{indirizzo}</strong>. Se non lo trovi entro qualche minuto, <strong>guarda nello Spam</strong> o in Promozioni.
    </p>
  );
}
