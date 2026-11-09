import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { qrDataUrl } from '../../lib/biglietto';
import { codiceLeggibile, normalizzaCodice } from '../../lib/codice';
import { euro } from '../../lib/menu';
import { useTesti } from '../../lib/testi';
import {
  ascoltaGiornate, ascoltaImpostazioniCarnevale, ascoltaIscrizioneCarnevale, daIncassare, ErroreCarnevale, etaAl, prenotaProva,
} from '../../lib/carnevale';
import { descriviProva, icsProva, pdfIscrizioneCarnevale } from '../../lib/esportaCarnevale';
import { SceltaProva } from '../../components/SceltaProva';
import { Icona } from '../../components/Icona';
import type { GiornataProve, ImpostazioniCarnevale, IscrizioneCarnevale } from '../../types';

/** Pagina personale dell'iscrizione: QR per la prova, figuranti, quota, prenotazione della prova se manca. */
export function BigliettoCarnevale() {
  const { codice: grezzo = '' } = useParams();
  const codice = normalizzaCodice(grezzo);
  const [cerca] = useSearchParams();
  const nuovo = cerca.get('nuovo') === '1';
  const { contatti } = useTesti();
  const [i, setI] = useState<IscrizioneCarnevale | null | undefined>(undefined);
  const [imp, setImp] = useState<ImpostazioniCarnevale | null>(null);
  const [giornate, setGiornate] = useState<GiornataProve[]>([]);
  const [qr, setQr] = useState('');
  const [prova, setProva] = useState<{ giornata: string; ora: string } | null>(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  useEffect(() => ascoltaIscrizioneCarnevale(codice, setI, () => setI(null)), [codice]);
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  const senzaProva = i ? !i.prova : false;
  useEffect(() => (senzaProva ? ascoltaGiornate(setGiornate) : undefined), [senzaProva]);
  useEffect(() => { qrDataUrl(codice).then(setQr); }, [codice]);

  if (i === undefined) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (i === null)
    return (
      <main className="contenuto">
        <p className="vuoto">Iscrizione non trovata. Controlla il link.</p>
        <Link to="/carnevale" className="bottone">Vai al Carnevale</Link>
      </main>
    );

  const luogo = imp?.luogoProve || contatti.indirizzo;
  const d = imp ? daIncassare(i, imp) : { resto: 0, anticipo: 0 };
  const prenota = async () => {
    if (!prova) return;
    setLavoro(true);
    setErrore('');
    try {
      await prenotaProva(i.id, prova.giornata, prova.ora);
    } catch (e) {
      setErrore(e instanceof ErroreCarnevale ? e.message : 'Prenotazione non riuscita. Riprova.');
    } finally {
      setLavoro(false);
    }
  };

  return (
    <div className="schermo-biglietto">
      <div className="esito-biglietto">
        {nuovo ? (
          <>
            <div className="spunta-tonda"><Icona nome="ok" size={28} spessore={2.4} /></div>
            <h1>{i.persone.length > 1 ? 'Siete iscritti!' : 'Sei iscritto!'}</h1>
            <p>Salva questa pagina (aggiungila ai preferiti): il QR serve alla prova costume e alla consegna.</p>
          </>
        ) : <h1>Sfila con noi</h1>}
      </div>

      <section className="biglietto" aria-label="Iscrizione">
        <h2>{i.prova ? 'Prova costume' : 'Iscrizione Carnevale'}</h2>
        {i.prova && <div className="biglietto-data">{descriviProva(i)}</div>}
        {i.prova && luogo && <div className="biglietto-luogo">{luogo}</div>}
        {qr && <img className="qr" src={qr} width={220} height={220} alt={`Codice QR dell'iscrizione ${codiceLeggibile(i.id)}`} />}
        <div className="codice">{codiceLeggibile(i.id)}</div>
        {i.provato && <div className="etichetta etichetta-neutro">Prova fatta</div>}
        {i.consegnato && <div className="etichetta etichetta-neutro">Costume consegnato</div>}
        <hr />
        <ul className="bambini">
          {i.persone.map((p) => <li key={p.codiceFiscale}>{p.nome} {p.cognome}{etaAl(p.dataNascita) < 18 ? `, ${etaAl(p.dataNascita)} anni` : ''}{p.taglia ? ` · taglia ${p.taglia}` : ''}</li>)}
        </ul>
        <dl className="dettagli">
          <div><dt>Quota costume</dt><dd>{euro(i.totale)}</dd></div>
          <div><dt>Pagato</dt><dd>{euro(i.pagato)}</dd></div>
          {d.resto > 0 && <div><dt>{i.pagato === 0 && d.anticipo ? 'Alla prova' : 'Da pagare'}</dt><dd>{i.pagato === 0 && d.anticipo ? `anticipo ${euro(d.anticipo)} (o tutto ${euro(d.resto)})` : `${euro(d.resto)} alla consegna`}</dd></div>}
          <div><dt>Foto e video</dt><dd>{i.consensi.liberatoriaFoto === null ? 'Da firmare alla prova' : i.consensi.liberatoriaFoto ? 'Consentiti' : 'Non consentiti'}</dd></div>
        </dl>
      </section>

      {!i.prova && (
        <section className="pannello prenota-dopo">
          <h2>Prenota la prova costume</h2>
          <SceltaProva giornate={giornate} persone={i.persone.length} valore={prova} onChange={setProva} />
          {errore && <p className="avviso errore">{errore}</p>}
          {giornate.length > 0 && <button type="button" className="bottone" disabled={!prova || lavoro} onClick={prenota}>{lavoro ? 'Prenoto…' : 'Prenota'}</button>}
        </section>
      )}

      <div className="azioni-biglietto">
        <button type="button" className="bottone bianco" onClick={() => pdfIscrizioneCarnevale(i)}>
          <Icona nome="scarica" size={18} spessore={2} /> PDF dei documenti
        </button>
        {i.prova && !i.provato && (
          <button type="button" className="bottone contorno" onClick={() => icsProva(i, luogo, imp?.slotMinuti ?? 10)}>Aggiungi al calendario</button>
        )}
      </div>
      {i.prova && !i.provato && <p className="nota-email">Per cambiare orario scrivici{contatti.whatsapp ? ' su WhatsApp' : ''}{contatti.telefono ? ` (${contatti.telefono})` : ''}.</p>}
      <Link to="/carnevale" className="link-chiaro">Torna al Carnevale</Link>
      <Link to="/privacy" className="link-chiaro piccolo">Privacy e cookie</Link>
    </div>
  );
}
