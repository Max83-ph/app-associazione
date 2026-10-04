import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { annullaPrenotazione, ascoltaPrenotazione, ErrorePrenotazione } from '../lib/dati';
import { descriviModalita, qrDataUrl, scaricaPdfBiglietto } from '../lib/biglietto';
import { codiceLeggibile, normalizzaCodice } from '../lib/codice';
import { dataBreve } from '../lib/format';
import { Icona } from '../components/Icona';
import type { Prenotazione } from '../types';

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

  useEffect(() => ascoltaPrenotazione(codice, setP, () => setP(null)), [codice]);
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
          </>
        ) : (
          <h1>Il tuo biglietto</h1>
        )}
      </div>

      <section className={annullato ? 'biglietto spento' : 'biglietto'} aria-label="Biglietto">
        <h2>{p.eventoTitolo}</h2>
        <div className="biglietto-data">{dataBreve(p.eventoData)}</div>
        {qr && !annullato && <img className="qr" src={qr} width={220} height={220} alt={`Codice QR del biglietto ${codiceLeggibile(p.id)}`} />}
        <div className="codice">{codiceLeggibile(p.id)}</div>
        {usato && <div className="etichetta etichetta-neutro">Ingresso già registrato</div>}
        <hr />
        <dl className="dettagli">
          <div><dt>Nome</dt><dd>{p.nome} {p.cognome}</dd></div>
          <div><dt>Prenotazione</dt><dd>{descriviModalita(p)}</dd></div>
          <div><dt>Pagamento</dt><dd>{p.pagamento.stato === 'da_pagare' ? 'In loco' : 'Effettuato'}</dd></div>
          {p.consensi.liberatoriaFoto !== null && (
            <div><dt>Foto e video</dt><dd>{p.consensi.liberatoriaFoto ? 'Consentiti' : 'Non consentiti'}</dd></div>
          )}
        </dl>
        {p.partecipanti.length > 0 && (
          <ul className="bambini">
            {p.partecipanti.map((b, i) => <li key={i}>{b.nome} {b.cognome}, {b.eta} anni</li>)}
          </ul>
        )}
      </section>

      {errore && <p className="avviso errore">{errore}</p>}

      {!annullato && (
        <div className="azioni-biglietto">
          <button type="button" className="bottone bianco" onClick={() => scaricaPdfBiglietto(p)}>
            <Icona nome="scarica" size={18} spessore={2} /> Scarica PDF
          </button>
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
    </div>
  );
}
