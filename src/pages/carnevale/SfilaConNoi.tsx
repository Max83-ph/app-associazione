import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Intestazione } from '../../components/Layout';
import { Firma } from '../../components/Firma';
import { Testo } from '../../components/TestoRicco';
import { SceltaProva } from '../../components/SceltaProva';
import { useAuth } from '../../lib/auth';
import { useTesti } from '../../lib/testi';
import { erroreCF, normalizzaCF } from '../../lib/codiceFiscale';
import { euro } from '../../lib/menu';
import {
  ascoltaGiornate, ascoltaImpostazioniCarnevale, creaIscrizioneCarnevale, ErroreCarnevale, etaAl, IMPOSTAZIONI_PREDEFINITE, isBambino, quoteIscrizione,
} from '../../lib/carnevale';
import type { FiguranteCarnevale, GiornataProve, ImpostazioniCarnevale } from '../../types';

const VUOTA: FiguranteCarnevale = { nome: '', cognome: '', dataNascita: '', luogoNascita: '', codiceFiscale: '', bambino: false };

/** "Sfila con noi": iscrizione della famiglia alle sfilate, firme e prova costume. */
export function SfilaConNoi() {
  const { isOrganizzatore, utente } = useAuth();
  const [cerca] = useSearchParams();
  const manuale = isOrganizzatore && cerca.get('manuale') === '1';
  const navigate = useNavigate();
  const testi = useTesti();
  const [imp, setImp] = useState<ImpostazioniCarnevale | null>(null);
  const [giornate, setGiornate] = useState<GiornataProve[]>([]);
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  useEffect(() => ascoltaGiornate(setGiornate), []);

  const [passo, setPasso] = useState(1);
  const [persone, setPersone] = useState<FiguranteCarnevale[]>([]);
  const [bozza, setBozza] = useState<FiguranteCarnevale>(VUOTA);
  const [modifica, setModifica] = useState<number | null>(null);
  const [referente, setReferente] = useState({ indirizzo: '', cellulare: '', email: '' });
  const [privacy, setPrivacy] = useState(false);
  const [liberatoria, setLiberatoria] = useState<boolean | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [prova, setProva] = useState<{ giornata: string; ora: string } | null>(null);
  const [note, setNote] = useState('');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const i = imp ?? IMPOSTAZIONI_PREDEFINITE;
  if (imp === null) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (!imp.aperte && !manuale)
    return (
      <>
        <Intestazione titolo="Sfila con noi" />
        <main className="contenuto">
          <div className="pannello"><h2>Iscrizioni non ancora aperte</h2><p>Torna a trovarci presto, oppure scrivici per avere informazioni.</p></div>
          <Link to="/carnevale" className="bottone contorno">Torna al Carnevale</Link>
        </main>
      </>
    );

  const conRefer = persone.length === 0 && modifica === null;
  const problemiBozza: string[] = [];
  if (!bozza.nome.trim() || !bozza.cognome.trim()) problemiBozza.push('nome e cognome');
  const eta = bozza.dataNascita ? etaAl(bozza.dataNascita) : NaN;
  if (!bozza.dataNascita || Number.isNaN(eta) || eta < 0 || eta > 110) problemiBozza.push('la data di nascita');
  if (!bozza.luogoNascita.trim()) problemiBozza.push('il luogo di nascita');
  const errCf = bozza.codiceFiscale ? erroreCF(bozza.codiceFiscale) : 'manca';
  if (errCf) problemiBozza.push(`il codice fiscale (${errCf})`);
  if (persone.some((p, k) => k !== modifica && p.codiceFiscale === normalizzaCF(bozza.codiceFiscale))) problemiBozza.push('un codice fiscale diverso (questa persona è già in lista)');
  if ((conRefer || modifica === 0) && eta < 18) problemiBozza.push('un referente maggiorenne (il genitore si iscrive per primo)');

  const salvaBozza = () => {
    const p = { ...bozza, codiceFiscale: normalizzaCF(bozza.codiceFiscale), bambino: isBambino(bozza.dataNascita, i) };
    setPersone((l) => (modifica === null ? [...l, p] : l.map((x, k) => (k === modifica ? p : x))));
    setBozza({ ...VUOTA, cognome: persone[0]?.cognome ?? bozza.cognome });
    setModifica(null);
  };

  const q = quoteIscrizione(persone, i);
  const minori = persone.some((p) => etaAl(p.dataNascita) < 18);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(referente.email.trim());
  const problemi2: string[] = [];
  if (!referente.indirizzo.trim()) problemi2.push('l\'indirizzo');
  if (referente.cellulare.replace(/\D/g, '').length < 8) problemi2.push('il cellulare');
  if (!emailOk && !(manuale && !referente.email.trim())) problemi2.push('un\'email valida');
  if (!manuale || firma) {
    if (!privacy) problemi2.push('la presa visione dell\'informativa');
    if (liberatoria === null) problemi2.push('la scelta sulle foto');
    if (!firma) problemi2.push('la firma');
  }

  const invia = async () => {
    setInvio(true);
    setErrore('');
    try {
      const codice = await creaIscrizioneCarnevale({
        persone,
        referente,
        liberatoriaFoto: firma ? liberatoria : null,
        firma,
        prova,
        manuale: manuale ? { note, autore: utente?.email ?? '' } : undefined,
      }, i);
      navigate(manuale ? `/admin/carnevale?aggiunto=${codice}` : `/carnevale/b/${codice}?nuovo=1`);
    } catch (e) {
      setErrore(e instanceof ErroreCarnevale ? e.message : 'Iscrizione non riuscita. Controlla la connessione e riprova.');
      setInvio(false);
    }
  };

  return (
    <>
      <Intestazione titolo={manuale ? 'Iscrizione a mano' : 'Sfila con noi'}>
        <div className="passi-iscrizione" aria-label={`Passo ${passo} di 3`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= passo ? 'passo fatto' : 'passo'} />)}
        </div>
      </Intestazione>
      <main className="contenuto">
        {passo === 1 && (
          <div className="modulo">
            <h2 className="titolo-sezione">Chi sfila?</h2>
            {persone.map((p, k) => (
              <div key={p.codiceFiscale} className="figurante">
                <div className="figurante-testa">
                  <strong>{p.nome} {p.cognome}</strong>
                  <span className={etaAl(p.dataNascita) < 18 ? 'etichetta etichetta-caldo' : 'etichetta etichetta-neutro'}>
                    {k === 0 ? 'Referente' : etaAl(p.dataNascita) < 18 ? `Minorenne · ${etaAl(p.dataNascita)} anni` : 'Adulto'}
                  </span>
                </div>
                <span className="nota">{p.codiceFiscale} · quota {p.bambino ? 'bambino' : 'adulto'}</span>
                <div className="riga-azioni">
                  <button type="button" className="link-bottone" onClick={() => { setBozza(p); setModifica(k); }}>Modifica</button>
                  {(k > 0 || persone.length === 1) && <button type="button" className="link-bottone" onClick={() => setPersone((l) => l.filter((_, x) => x !== k))}>Togli</button>}
                </div>
              </div>
            ))}
            {(persone.length < 12 || modifica !== null) && (
              <fieldset className="figurante-nuovo">
                <legend>{modifica !== null ? 'Modifica persona' : conRefer ? (manuale ? 'Referente (maggiorenne)' : 'Tu (referente, maggiorenne)') : 'Aggiungi un familiare'}</legend>
                <div className="griglia-2">
                  <label>Nome<input value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} maxLength={60} autoComplete="off" /></label>
                  <label>Cognome<input value={bozza.cognome} onChange={(e) => setBozza({ ...bozza, cognome: e.target.value })} maxLength={60} autoComplete="off" /></label>
                  <label>Data di nascita<input type="date" value={bozza.dataNascita} onChange={(e) => setBozza({ ...bozza, dataNascita: e.target.value })} /></label>
                  <label>Luogo di nascita<input value={bozza.luogoNascita} onChange={(e) => setBozza({ ...bozza, luogoNascita: e.target.value })} maxLength={80} /></label>
                </div>
                <label>Codice fiscale<input value={bozza.codiceFiscale} onChange={(e) => setBozza({ ...bozza, codiceFiscale: e.target.value.toUpperCase() })} maxLength={16} autoCapitalize="characters" autoComplete="off" /></label>
                {problemiBozza.length > 0 && (bozza.nome || bozza.codiceFiscale) && <p className="nota">Manca: {problemiBozza.join(', ')}.</p>}
                <div className="riga-azioni">
                  <button type="button" className="bottone contorno" disabled={problemiBozza.length > 0} onClick={salvaBozza}>{modifica !== null ? 'Salva' : 'Aggiungi alla lista'}</button>
                  {modifica !== null && <button type="button" className="link-bottone" onClick={() => { setModifica(null); setBozza(VUOTA); }}>Annulla</button>}
                </div>
              </fieldset>
            )}
            {persone.length > 0 && (
              <p className="nota">Quota costume: {q.numAdulti} adult{q.numAdulti === 1 ? 'o' : 'i'} × {euro(i.quotaAdulto)}{q.numBambini ? ` + ${q.numBambini} bambin${q.numBambini === 1 ? 'o' : 'i'} × ${euro(i.quotaBambino)}` : ''} = <strong>{euro(q.totale)}</strong>.</p>
            )}
            <button type="button" className="bottone" disabled={persone.length === 0 || modifica !== null} onClick={() => setPasso(2)}>
              Avanti{persone.length ? `: ${persone.length} ${persone.length === 1 ? 'persona' : 'persone'}` : ''}
            </button>
          </div>
        )}

        {passo === 2 && (
          <div className="modulo">
            <h2 className="titolo-sezione">Contatti di {persone[0].nome}</h2>
            <label>Indirizzo<input value={referente.indirizzo} onChange={(e) => setReferente({ ...referente, indirizzo: e.target.value })} maxLength={160} placeholder="Via, numero, CAP, comune" autoComplete="street-address" /></label>
            <div className="griglia-2">
              <label>Cellulare<input value={referente.cellulare} onChange={(e) => setReferente({ ...referente, cellulare: e.target.value })} inputMode="tel" maxLength={30} autoComplete="tel" /></label>
              <label>Email{manuale ? ' (facoltativa)' : ''}<input value={referente.email} onChange={(e) => setReferente({ ...referente, email: e.target.value })} inputMode="email" maxLength={120} autoComplete="email" /></label>
            </div>
            <fieldset>
              <legend>Documenti</legend>
              <details className="documento"><summary>Leggi l'informativa privacy</summary><Testo testo={testi.informativaCarnevale} /></details>
              <label className="spunta"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Ho letto l'informativa{persone.length > 1 ? ', anche per le altre persone iscritte' : ''}</label>
              <div className="liberatoria">
                <details className="documento"><summary>Liberatoria foto e video</summary><Testo testo={testi.liberatoriaCarnevale} /></details>
                <div className="griglia-2">
                  <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} aria-pressed={liberatoria === true} onClick={() => setLiberatoria(true)}>Acconsento</button>
                  <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} aria-pressed={liberatoria === false} onClick={() => setLiberatoria(false)}>Non acconsento</button>
                </div>
                <p className="nota">Facoltativa: l'iscrizione vale comunque.</p>
              </div>
              <div>
                <div className="etichetta-campo">Firma di {persone[0].nome} {persone[0].cognome}{minori ? ' (anche per i minori, come genitore)' : ''}</div>
                <Firma onChange={setFirma} />
                {manuale && <p className="nota">Se non può firmare adesso, lascia vuoto: firmerà alla prova costume.</p>}
              </div>
            </fieldset>
            {manuale && <label>Note (facoltative)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="es. prenotato su WhatsApp" /></label>}
            {problemi2.length > 0 && <p className="nota">Per continuare manca: {problemi2.join(', ')}.</p>}
            <div className="riga-azioni">
              <button type="button" className="bottone contorno" onClick={() => setPasso(1)}>Indietro</button>
              <button type="button" className="bottone" disabled={problemi2.length > 0} onClick={() => setPasso(3)}>Avanti: prova costume</button>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="modulo">
            <h2 className="titolo-sezione">Prova costume</h2>
            <p className="nota">
              Venite {persone.length > 1 ? `tutti e ${persone.length} insieme` : ''}: le taglie si provano lì, il costume vale per tutte e due le sfilate.
              {i.luogoProve ? ` Dove: ${i.luogoProve}.` : ''}
            </p>
            <SceltaProva giornate={giornate} persone={persone.length} valore={prova} onChange={setProva} ignoraLimite={manuale} />
            <div className="riepilogo-quota">
              <div><span>Quota costume</span><strong>{euro(q.totale)}</strong></div>
              {i.anticipo > 0 && <div><span>Alla prova: anticipo ({persone.length} × {euro(i.anticipo)})</span><strong>{euro(Math.min(q.totale, q.anticipo))}</strong></div>}
              <p className="nota">Il saldo si paga alla consegna del costume. Puoi anche pagare tutto subito alla prova.</p>
            </div>
            {errore && <p className="avviso errore">{errore}</p>}
            <div className="riga-azioni">
              <button type="button" className="bottone contorno" onClick={() => setPasso(2)} disabled={invio}>Indietro</button>
              <button type="button" className="bottone" onClick={invia} disabled={invio}>
                {invio ? 'Invio…' : prova ? 'Conferma iscrizione e prova' : 'Iscriviti, prova più tardi'}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
