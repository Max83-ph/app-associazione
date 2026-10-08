import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../../firebase';
import { useAuth } from '../../lib/auth';
import {
  aggiornaMieiDati,
  annoCorrente,
  ascoltaAvvisi,
  ascoltaMioSocio,
  inviaRichiesta,
} from '../../lib/soci';
import { pdfSocio } from '../../lib/esportaSoci';
import { DocumentiSoci, useDocumentiSocio } from './Documenti';
import { Intestazione } from '../../components/Layout';
import { ModuloSocio, SOCIO_VUOTO } from '../../components/ModuloSocio';
import { NOME_COMITATO } from '../../config';
import type { Avviso, ConsensiSocio, Residenza, Socio } from '../../types';

const MESSAGGI: Record<string, string> = {
  'auth/invalid-credential': 'Email o password non corrette.',
  'auth/email-already-in-use': 'Esiste già un account con questa email: accedi.',
  'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
  'auth/invalid-email': 'Email non valida.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
};
const msg = (e: unknown) => (e instanceof FirebaseError ? MESSAGGI[e.code] ?? e.message : 'Errore imprevisto.');

export function AreaSoci() {
  const { utente, caricamento } = useAuth();
  const [socio, setSocio] = useState<Socio | null | undefined>(undefined);

  useEffect(() => {
    if (!utente) return;
    return ascoltaMioSocio(utente.uid, setSocio, () => setSocio(null));
  }, [utente]);

  if (caricamento || (utente && socio === undefined)) {
    return <><Intestazione titolo="Area soci" /><main className="contenuto"><p className="vuoto">Caricamento…</p></main></>;
  }
  if (!utente) return <><Intestazione titolo="Area soci" /><Benvenuto soloAccesso /></>;

  if (!socio) {
    return (
      <>
        <Intestazione titolo="Area soci" />
        <main className="contenuto">
          <div className="pannello">
            <h2>Nessuna iscrizione</h2>
            <p>Questo account non risulta iscritto come socio.</p>
            <Link to="/soci/iscrizione" className="bottone">Diventa socio</Link>
          </div>
          <Esci />
        </main>
      </>
    );
  }

  if (socio.stato !== 'attivo') {
    const testi = {
      in_attesa: ['Richiesta inviata', 'Gli organizzatori la stanno verificando. Quando sarai confermato vedrai qui la bacheca dei soci.'],
      respinto: ['Richiesta non accettata', 'Per informazioni scrivi agli organizzatori dalla pagina Info.'],
      sospeso: ['Iscrizione sospesa', 'Per informazioni scrivi agli organizzatori dalla pagina Info.'],
    } as const;
    const [titolo, testo] = testi[socio.stato];
    return (
      <>
        <Intestazione titolo="Area soci" />
        <main className="contenuto">
          <div className="pannello">
            <h2>{titolo}</h2>
            <p>{testo}</p>
          </div>
          <Riepilogo s={socio} />
          <Esci />
        </main>
      </>
    );
  }

  return <AreaAttivo socio={socio} uid={utente.uid} />;
}

/** Iscrizione soci aperta: /soci/iscrizione (senza codice, la richiesta resta in attesa di approvazione). */
export function Iscrizione() {
  const { utente, caricamento } = useAuth();
  const [socio, setSocio] = useState<Socio | null | undefined>(undefined);
  const [inviata, setInviata] = useState(false);

  useEffect(() => {
    if (!utente) return;
    return ascoltaMioSocio(utente.uid, setSocio, () => setSocio(null));
  }, [utente]);

  if (caricamento || (utente && socio === undefined)) {
    return <><Intestazione titolo="Diventa socio" /><main className="contenuto"><p className="vuoto">Caricamento…</p></main></>;
  }
  if (inviata || (utente && socio)) return <Navigate to="/soci" replace />;

  if (!utente) {
    return (
      <>
        <Intestazione titolo="Diventa socio" />
        <p className="intro passo">Per iscriverti crea prima il tuo account: ti servirà per entrare nell'Area soci. Sei già socio? <Link to="/soci">Accedi</Link>.</p>
        <Benvenuto />
      </>
    );
  }

  return (
    <>
      <Intestazione titolo="Diventa socio" />
      <main className="contenuto">
        <p className="intro">Compila i tuoi dati e firma con il dito. La richiesta arriva agli organizzatori, che la confermano.</p>
        <p className="nota">Prima di firmare puoi leggere l'<a href={PDF_INFORMATIVA} target="_blank" rel="noopener">informativa privacy completa (PDF)</a>.</p>
        <ModuloSocio
          chi="socio"
          iniziale={{ ...SOCIO_VUOTO, email: utente.email ?? '' }}
          etichettaInvio="Firma e invia la richiesta"
          onInvia={async (dati, firma) => {
            await inviaRichiesta(utente.uid, dati, firma!);
            setInviata(true);
          }}
        />
        <Esci />
      </main>
    </>
  );
}

function Benvenuto({ soloAccesso = false }: { soloAccesso?: boolean }) {
  const [modo, setModo] = useState<'registrati' | 'accedi'>(soloAccesso ? 'accedi' : 'registrati');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [info, setInfo] = useState('');
  const [invio, setInvio] = useState(false);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');
    setInvio(true);
    try {
      if (modo === 'registrati') await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setErrore(msg(err));
    } finally {
      setInvio(false);
    }
  };

  const recupera = async () => {
    setErrore('');
    if (!email.trim()) return setErrore('Scrivi prima la tua email.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Ti abbiamo inviato un\'email per reimpostare la password.');
    } catch (err) {
      setErrore(msg(err));
    }
  };

  return (
    <main className="contenuto">
      {soloAccesso && (
        <div className="pannello">
          <h2>Entra nell'Area soci</h2>
          <p>Qui trovi la tua tessera, la bacheca con news e avvisi riservati ai soci e i tuoi dati.</p>
        </div>
      )}
      <form className="modulo pannello" onSubmit={invia}>
        {!soloAccesso && (
          <div className="griglia-2">
            <button type="button" className={modo === 'registrati' ? 'scelta attiva' : 'scelta'} aria-pressed={modo === 'registrati'} onClick={() => setModo('registrati')}>Prima volta</button>
            <button type="button" className={modo === 'accedi' ? 'scelta attiva' : 'scelta'} aria-pressed={modo === 'accedi'} onClick={() => setModo('accedi')}>Ho già un account</button>
          </div>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'} required minLength={6} />
          {modo === 'registrati' && <span className="nota">Almeno 6 caratteri.</span>}
        </label>
        {errore && <p className="avviso errore">{errore}</p>}
        {info && <p className="avviso">{info}</p>}
        <button type="submit" className="bottone" disabled={invio}>{modo === 'registrati' ? 'Crea account e continua' : 'Accedi'}</button>
        {modo === 'accedi' && <button type="button" className="link-bottone" onClick={recupera}>Password dimenticata?</button>}
      </form>
      {soloAccesso && (
        <p className="nota">Vuoi diventare socio? <Link to="/soci/iscrizione">Compila la richiesta di iscrizione</Link>.</p>
      )}
    </main>
  );
}

function AreaAttivo({ socio, uid }: { socio: Socio; uid: string }) {
  const [scheda, setScheda] = useState<'bacheca' | 'dati' | 'documenti'>('bacheca');
  const documenti = useDocumentiSocio(uid);
  const anno = annoCorrente();
  const t = socio.tessere?.[anno];

  return (
    <>
      <Intestazione titolo={`Ciao ${socio.nome}`}>
        <div className="tessera">
          <div>
            <div className="tessera-anno">Socio {anno}</div>
            <div className="tessera-nome">{socio.nome} {socio.cognome}</div>
          </div>
          <div className="tessera-stato">
            {t?.numero ? <span>Tessera n. {t.numero}</span> : <span>Tessera da assegnare</span>}
            <span className={t?.quotaPagata ? 'quota ok' : 'quota'}>{t?.quotaPagata ? 'Quota pagata' : 'Quota da pagare'}</span>
          </div>
        </div>
        <div className="filtri" role="tablist">
          <button type="button" role="tab" aria-selected={scheda === 'bacheca'} className={scheda === 'bacheca' ? 'filtro attivo' : 'filtro'} onClick={() => setScheda('bacheca')}>Bacheca</button>
          <button type="button" role="tab" aria-selected={scheda === 'dati'} className={scheda === 'dati' ? 'filtro attivo' : 'filtro'} onClick={() => setScheda('dati')}>I miei dati</button>
          <button type="button" role="tab" aria-selected={scheda === 'documenti'} className={scheda === 'documenti' ? 'filtro attivo' : 'filtro'} onClick={() => setScheda('documenti')}>Documenti{documenti.daFirmare > 0 ? ` (${documenti.daFirmare} da firmare)` : ''}</button>
        </div>
      </Intestazione>
      <main className="contenuto">
        {scheda === 'bacheca' && <Bacheca />}
        {scheda === 'dati' && <MieiDati socio={socio} />}
        {scheda === 'documenti' && <DocumentiSoci socio={socio} uid={uid} stato={documenti} />}
      </main>
    </>
  );
}

const PDF_INFORMATIVA = '/documenti/informativa-privacy-soci.pdf';

function Bacheca() {
  const [lista, setLista] = useState<Avviso[] | null>(null);
  const [errore, setErrore] = useState('');
  useEffect(() => ascoltaAvvisi(setLista, (e) => setErrore(e.message)), []);

  if (errore) return <p className="avviso errore">Impossibile caricare la bacheca: {errore}</p>;
  if (!lista) return <p className="vuoto">Caricamento…</p>;
  if (!lista.length) return <p className="vuoto">Ancora nessun avviso. Le novità per i soci compariranno qui.</p>;
  return (
    <div className="lista-avvisi">
      {lista.map((a) => (
        <article key={a.id} className={a.inEvidenza ? 'avviso-card evidenza' : 'avviso-card'}>
          <div className="avviso-data">
            {a.inEvidenza && <span className="etichetta etichetta-caldo">In evidenza</span>}
            {a.createdAt?.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h2>{a.titolo}</h2>
          <p>{a.testo}</p>
        </article>
      ))}
    </div>
  );
}

function MieiDati({ socio }: { socio: Socio }) {
  const [modifica, setModifica] = useState(false);
  const [res, setRes] = useState<Residenza>(socio.residenza);
  const [email, setEmail] = useState(socio.email);
  const [cell, setCell] = useState(socio.cellulare);
  const [cons, setCons] = useState<ConsensiSocio>(socio.consensi);
  const [errore, setErrore] = useState('');
  const [salvo, setSalvo] = useState(false);

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');
    setSalvo(true);
    try {
      await aggiornaMieiDati(socio.id, { residenza: { ...res, provincia: res.provincia.toUpperCase() }, email, cellulare: cell, consensi: cons });
      setModifica(false);
    } catch {
      setErrore('Salvataggio non riuscito: controlla CAP (5 cifre), provincia (2 lettere), email e cellulare.');
    } finally {
      setSalvo(false);
    }
  };

  if (!modifica) {
    return (
      <>
        <Riepilogo s={socio} />
        <div className="riga-azioni">
          <button type="button" className="bottone piccolo" onClick={() => setModifica(true)}>Modifica contatti e preferenze</button>
          <button type="button" className="bottone contorno piccolo" onClick={() => pdfSocio(socio)}>Scarica i documenti firmati</button>
        </div>
        <p className="nota">Per correggere nome, data di nascita o codice fiscale scrivi agli organizzatori.</p>
        <Esci />
      </>
    );
  }

  return (
    <form className="modulo" onSubmit={salva}>
      <fieldset>
        <legend>Residenza</legend>
        <label>Indirizzo<input value={res.indirizzo} onChange={(e) => setRes({ ...res, indirizzo: e.target.value })} /></label>
        <div className="griglia-cap">
          <label>CAP<input value={res.cap} onChange={(e) => setRes({ ...res, cap: e.target.value })} inputMode="numeric" maxLength={5} /></label>
          <label>Comune<input value={res.comune} onChange={(e) => setRes({ ...res, comune: e.target.value })} /></label>
          <label>Prov.<input value={res.provincia} onChange={(e) => setRes({ ...res, provincia: e.target.value.toUpperCase() })} maxLength={2} className="maiuscolo" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Contatti e preferenze</legend>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Cellulare<input type="tel" value={cell} onChange={(e) => setCell(e.target.value)} /></label>
        <label className="spunta"><input type="checkbox" checked={cons.whatsapp} onChange={(e) => setCons({ ...cons, whatsapp: e.target.checked })} /> Gruppo WhatsApp dei soci</label>
        <label className="spunta"><input type="checkbox" checked={cons.mailingList} onChange={(e) => setCons({ ...cons, mailingList: e.target.checked })} /> Mailing list del {NOME_COMITATO}</label>
        <label className="spunta"><input type="checkbox" checked={cons.liberatoriaFoto} onChange={(e) => setCons({ ...cons, liberatoriaFoto: e.target.checked })} /> Acconsento a foto e video agli eventi del Gruppo</label>
      </fieldset>
      {errore && <p className="avviso errore">{errore}</p>}
      <div className="griglia-2">
        <button type="button" className="bottone contorno" onClick={() => setModifica(false)}>Annulla</button>
        <button type="submit" className="bottone" disabled={salvo}>{salvo ? 'Salvo…' : 'Salva'}</button>
      </div>
    </form>
  );
}

export function Riepilogo({ s }: { s: Socio }) {
  const r = s.residenza;
  return (
    <dl className="scheda-dati">
      <div><dt>Nome</dt><dd>{s.nome} {s.cognome}</dd></div>
      <div><dt>Nascita</dt><dd>{s.luogoNascita}, {s.dataNascita.split('-').reverse().join('/')}</dd></div>
      <div><dt>Codice fiscale</dt><dd className="mono">{s.codiceFiscale}</dd></div>
      <div><dt>Residenza</dt><dd>{r.indirizzo}, {r.cap} {r.comune} ({r.provincia})</dd></div>
      <div><dt>Email</dt><dd>{s.email}</dd></div>
      <div><dt>Cellulare</dt><dd>{s.cellulare}</dd></div>
      <div><dt>Foto e video</dt><dd>{s.consensi.liberatoriaFoto ? 'Acconsento' : 'Non acconsento'}</dd></div>
      <div><dt>WhatsApp soci</dt><dd>{s.consensi.whatsapp ? 'Sì' : 'No'}</dd></div>
      <div><dt>Mailing list</dt><dd>{s.consensi.mailingList ? 'Sì' : 'No'}</dd></div>
    </dl>
  );
}

function Esci() {
  return <button type="button" className="link-bottone" onClick={() => signOut(auth)}>Esci dall'account</button>;
}
