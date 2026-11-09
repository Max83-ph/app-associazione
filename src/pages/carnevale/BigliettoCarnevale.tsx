import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { qrDataUrl } from '../../lib/biglietto';
import { codiceLeggibile, normalizzaCodice } from '../../lib/codice';
import { euro } from '../../lib/menu';
import { useTesti } from '../../lib/testi';
import {
  ascoltaGiornate, ascoltaImpostazioniCarnevale, ascoltaIscrizioneCarnevale, daIncassare, ErroreCarnevale, etaAl, modificaIscrizioneCarnevale, prenotaProva,
} from '../../lib/carnevale';
import { erroreCF, normalizzaCF } from '../../lib/codiceFiscale';
import { inviaBigliettoEmail, useEmailBiglietti, type EsitoEmail } from '../../lib/emailBiglietti';
import { descriviProva, icsProva, pdfIscrizioneCarnevale } from '../../lib/esportaCarnevale';
import { SceltaProva } from '../../components/SceltaProva';
import { Icona } from '../../components/Icona';
import type { FiguranteCarnevale, GiornataProve, ImpostazioniCarnevale, IscrizioneCarnevale } from '../../types';

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
  const [cambia, setCambia] = useState(false);
  const [modifica, setModifica] = useState(false);
  const [esito, setEsito] = useState('');
  const urlEmail = useEmailBiglietti();
  const [email, setEmail] = useState<'' | 'invio' | EsitoEmail>('');
  useEffect(() => ascoltaIscrizioneCarnevale(codice, setI, () => setI(null)), [codice]);
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  useEffect(() => ascoltaGiornate(setGiornate), []);
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
  const d = imp ? daIncassare(i, imp) : { resto: null, anticipo: 0 };
  const prenota = async () => {
    if (!prova) return;
    setLavoro(true);
    setErrore('');
    try {
      const cambio = !!i.prova;
      await prenotaProva(i.id, prova.giornata, prova.ora);
      setCambia(false);
      setProva(null);
      setEsito(cambio ? 'Orario cambiato.' : 'Prova prenotata.');
      if (urlEmail && i.referente.email) inviaBigliettoEmail(i.id, urlEmail, 'carnevale', 'prova').then(setEmail);
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
            {urlEmail && i.referente.email && <InvioAutomatico codice={i.id} url={urlEmail} indirizzo={i.referente.email} />}
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
          <div><dt>Quota costume</dt><dd>{d.resto === null ? `alla prova, in base alla taglia${imp ? ` (${euro(imp.quotaAdulto)} · bimbo ${euro(imp.quotaBambino)})` : ''}` : euro(i.totale)}</dd></div>
          {i.pagato > 0 && <div><dt>Pagato</dt><dd>{euro(i.pagato)}</dd></div>}
          {d.resto === null && d.anticipo > 0 && <div><dt>Alla prova</dt><dd>anticipo {euro(d.anticipo)} (o tutto)</dd></div>}
          {d.resto !== null && d.resto > 0 && <div><dt>{i.pagato === 0 && d.anticipo ? 'Da pagare' : 'Saldo'}</dt><dd>{i.pagato === 0 && d.anticipo ? `anticipo ${euro(d.anticipo)} (o tutto ${euro(d.resto)})` : `${euro(d.resto)} alla consegna`}</dd></div>}
          <div><dt>Foto e video</dt><dd>{i.consensi.liberatoriaFoto === null ? 'Da firmare alla prova' : i.consensi.liberatoriaFoto ? 'Consentiti' : 'Non consentiti'}</dd></div>
        </dl>
      </section>

      {esito && <p className="avviso">{esito}</p>}
      {email === 'inviata' && <p className="avviso">Email inviata a {i.referente.email}: se non la trovi guarda nello Spam o in Promozioni.</p>}
      {email === 'limite' && <p className="avviso">Ti abbiamo già scritto più volte: guarda nello Spam o salva questa pagina.</p>}
      {(!i.prova || cambia) && (
        <section className="pannello prenota-dopo">
          <h2>{i.prova ? 'Cambia orario della prova' : 'Prenota la prova costume'}</h2>
          <SceltaProva giornate={giornate} persone={i.persone.length} valore={prova} onChange={setProva} />
          {errore && <p className="avviso errore">{errore}</p>}
          <div className="riga-azioni">
            {giornate.length > 0 && <button type="button" className="bottone" disabled={!prova || lavoro} onClick={prenota}>{lavoro ? 'Salvo…' : i.prova ? 'Conferma il nuovo orario' : 'Prenota'}</button>}
            {cambia && <button type="button" className="bottone contorno" onClick={() => { setCambia(false); setProva(null); }}>Annulla</button>}
          </div>
        </section>
      )}
      {modifica && (
        <ModificaDati i={i} onFatto={(ok) => {
          setModifica(false);
          if (ok) { setEsito('Dati aggiornati.'); if (urlEmail && i.referente.email) inviaBigliettoEmail(i.id, urlEmail, 'carnevale', 'dati').then(setEmail); }
        }} />
      )}

      <div className="azioni-biglietto">
        <button type="button" className="bottone bianco" onClick={() => pdfIscrizioneCarnevale(i)}>
          <Icona nome="scarica" size={18} spessore={2} /> PDF dei documenti
        </button>
        {i.prova && !i.provato && (
          <button type="button" className="bottone contorno" onClick={() => icsProva(i, luogo, imp?.slotMinuti ?? 10)}>Aggiungi al calendario</button>
        )}
        {i.prova && !i.provato && !cambia && <button type="button" className="bottone contorno" onClick={() => { setCambia(true); setEsito(''); }}>Cambia orario</button>}
        {!modifica && <button type="button" className="bottone contorno" onClick={() => { setModifica(true); setEsito(''); }}>Modifica i dati</button>}
        {urlEmail && i.referente.email && (
          <button type="button" className="bottone contorno" disabled={email === 'invio' || email === 'inviata'}
            onClick={async () => { setEmail('invio'); setEmail(await inviaBigliettoEmail(i.id, urlEmail, 'carnevale', 'nuova')); }}>
            {email === 'invio' ? 'Invio…' : 'Mandamelo via email'}
          </button>
        )}
      </div>
      <p className="nota-email">Per aggiungere o togliere una persona scrivici{contatti.whatsapp ? ' su WhatsApp' : ''}{contatti.telefono ? ` (${contatti.telefono})` : ''}.</p>
      <Link to="/carnevale" className="link-chiaro">Torna al Carnevale</Link>
      <Link to="/privacy" className="link-chiaro piccolo">Privacy e cookie</Link>
    </div>
  );
}

/** Subito dopo l'iscrizione: conferma via email, una volta sola anche se si ricarica la pagina. */
function InvioAutomatico({ codice, url, indirizzo }: { codice: string; url: string; indirizzo: string }) {
  const chiave = `email-carnevale-${codice}`;
  const [gia] = useState(() => {
    try { const g = sessionStorage.getItem(chiave) === '1'; sessionStorage.setItem(chiave, '1'); return g; } catch { return false; }
  });
  const [stato, setStato] = useState<'invio' | EsitoEmail>(gia ? 'inviata' : 'invio');
  useEffect(() => {
    if (!gia) inviaBigliettoEmail(codice, url, 'carnevale', 'nuova').then(setStato);
  }, [codice, url, gia]);
  if (stato === 'invio') return <p className="nota-email">Ti stiamo mandando la conferma via email…</p>;
  if (stato === 'errore') return <p className="nota-email">Non siamo riusciti a mandarti l'email: salva questa pagina.</p>;
  return <p className="nota-email">Ti abbiamo mandato la conferma a <strong>{indirizzo}</strong>. Se non la trovi, <strong>guarda nello Spam</strong> o in Promozioni.</p>;
}

/** Correzione dei dati: stesse persone (per aggiungerne o toglierne si scrive al gruppo). */
function ModificaDati({ i, onFatto }: { i: IscrizioneCarnevale; onFatto: (ok: boolean) => void }) {
  const [persone, setPersone] = useState<FiguranteCarnevale[]>(i.persone.map((p) => ({ ...p })));
  const [referente, setReferente] = useState({ ...i.referente });
  const [liberatoria, setLiberatoria] = useState<boolean | null>(i.consensi.liberatoriaFoto);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const set = (k: number, v: Partial<FiguranteCarnevale>) => setPersone((l) => l.map((p, j) => (j === k ? { ...p, ...v } : p)));
  const problemi: string[] = [];
  persone.forEach((p, k) => {
    const chi = p.nome || `persona ${k + 1}`;
    if (!p.nome.trim() || !p.cognome.trim()) problemi.push(`nome e cognome di ${chi}`);
    const eta = etaAl(p.dataNascita);
    if (Number.isNaN(eta) || eta < 0 || eta > 110) problemi.push(`la data di nascita di ${chi}`);
    if (!p.luogoNascita.trim()) problemi.push(`il luogo di nascita di ${chi}`);
    const e = erroreCF(p.codiceFiscale);
    if (e) problemi.push(`il codice fiscale di ${chi} (${e})`);
  });
  if (etaAl(persone[0].dataNascita) < 18) problemi.push('un referente maggiorenne');
  if (new Set(persone.map((p) => normalizzaCF(p.codiceFiscale))).size < persone.length) problemi.push('codici fiscali diversi');
  if (!referente.indirizzo.trim()) problemi.push('l\'indirizzo');
  if (referente.cellulare.replace(/\D/g, '').length < 8) problemi.push('il cellulare');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(referente.email.trim())) problemi.push('un\'email valida');

  const salva = async () => {
    setLavoro(true);
    setErrore('');
    try {
      await modificaIscrizioneCarnevale(i, persone, referente, liberatoria);
      onFatto(true);
    } catch (e) {
      setErrore(e instanceof ErroreCarnevale ? e.message : 'Modifica non riuscita. Riprova.');
      setLavoro(false);
    }
  };

  return (
    <section className="pannello prenota-dopo modulo">
      <h2>Modifica i dati</h2>
      {persone.map((p, k) => (
        <fieldset key={k}>
          <legend>{k === 0 ? 'Referente' : `Persona ${k + 1}`}</legend>
          <div className="griglia-2">
            <label>Nome<input value={p.nome} maxLength={60} onChange={(e) => set(k, { nome: e.target.value })} /></label>
            <label>Cognome<input value={p.cognome} maxLength={60} onChange={(e) => set(k, { cognome: e.target.value })} /></label>
            <label>Data di nascita<input type="date" value={p.dataNascita} onChange={(e) => set(k, { dataNascita: e.target.value })} /></label>
            <label>Luogo di nascita<input value={p.luogoNascita} maxLength={80} onChange={(e) => set(k, { luogoNascita: e.target.value })} /></label>
          </div>
          <label>Codice fiscale<input value={p.codiceFiscale} maxLength={16} onChange={(e) => set(k, { codiceFiscale: e.target.value.toUpperCase() })} /></label>
        </fieldset>
      ))}
      <fieldset>
        <legend>Contatti</legend>
        <label>Indirizzo<input value={referente.indirizzo} maxLength={160} onChange={(e) => setReferente({ ...referente, indirizzo: e.target.value })} /></label>
        <div className="griglia-2">
          <label>Cellulare<input value={referente.cellulare} inputMode="tel" maxLength={30} onChange={(e) => setReferente({ ...referente, cellulare: e.target.value })} /></label>
          <label>Email<input value={referente.email} inputMode="email" maxLength={120} onChange={(e) => setReferente({ ...referente, email: e.target.value })} /></label>
        </div>
      </fieldset>
      {i.consensi.privacy && (
        <fieldset>
          <legend>Foto e video</legend>
          <div className="griglia-2">
            <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(true)}>Acconsento</button>
            <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(false)}>Non acconsento</button>
          </div>
        </fieldset>
      )}
      {problemi.length > 0 && <p className="nota">Manca: {problemi.join(', ')}.</p>}
      {errore && <p className="avviso errore">{errore}</p>}
      <div className="riga-azioni">
        <button type="button" className="bottone" disabled={lavoro || problemi.length > 0} onClick={salva}>{lavoro ? 'Salvo…' : 'Salva le modifiche'}</button>
        <button type="button" className="bottone contorno" disabled={lavoro} onClick={() => onFatto(false)}>Annulla</button>
      </div>
    </section>
  );
}
