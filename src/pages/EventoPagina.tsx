import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { ascoltaEvento, creaPrenotazione, ErrorePrenotazione } from '../lib/dati';
import { asportoDisponibile, dataBreve, etichettaPubblico, iscrizioniAperte } from '../lib/format';
import type { Evento, Modalita, Partecipante } from '../types';
import { Copertina, scurisci } from '../components/CardEvento';
import { Icona } from '../components/Icona';
import { Firma } from '../components/Firma';
import { INFORMATIVA_PRIVACY, LIBERATORIA_FOTO } from '../config';

export function EventoPagina() {
  const { id = '' } = useParams();
  const [ev, setEv] = useState<Evento | null | undefined>(undefined);
  const [errore, setErrore] = useState('');

  useEffect(() => ascoltaEvento(id, setEv, () => setEv(null)), [id]);

  if (ev === undefined) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (ev === null)
    return (
      <main className="contenuto">
        <p className="vuoto">Evento non trovato.</p>
        <Link to="/" className="bottone">Torna agli eventi</Link>
      </main>
    );

  const aperte = iscrizioniAperte(ev);
  return (
    <div className="pagina-evento">
      <div className="testata-evento">
        <Copertina ev={ev} altezza={ev.locandina ? 220 : 160} />
        <Link to="/" className="indietro" aria-label="Torna agli eventi"><Icona nome="indietro" size={22} spessore={2} /></Link>
      </div>
      <main className="contenuto">
        <div>
          <div className="card-data" style={{ color: scurisci(ev.colore) }}>
            {dataBreve(ev.data)}{ev.luogo ? ` · ${ev.luogo}` : ''}
          </div>
          <h1 className="titolo-evento">{ev.titolo}</h1>
          <div className="meta">
            {ev.tipo !== 'pasto' && <span>{etichettaPubblico[ev.pubblico]}</span>}
            {ev.prezzo && <span>{ev.prezzo}</span>}
          </div>
        </div>
        {ev.descrizione && <p className="descrizione">{ev.descrizione}</p>}
        {errore && <p className="avviso errore">{errore}</p>}
        {aperte ? (
          <ModuloIscrizione ev={ev} onErrore={setErrore} />
        ) : (
          <p className="avviso">Le iscrizioni a questo evento sono chiuse.</p>
        )}
      </main>
    </div>
  );
}

function ModuloIscrizione({ ev, onErrore }: { ev: Evento; onErrore: (m: string) => void }) {
  const navigate = useNavigate();
  const pasto = ev.tipo === 'pasto';
  const conBambini = !pasto && ev.pubblico !== 'adulti';
  const serveFirma = !pasto && (ev.documentiRichiesti.privacy || ev.documentiRichiesti.liberatoriaFoto);

  const postiLiberi = Math.max(0, ev.postiMax - ev.postiOccupati);
  const porzioniLibere = asportoDisponibile(ev);
  const asportoPossibile = pasto && ev.asportoAttivo && porzioniLibere > 0;

  const [modalita, setModalita] = useState<Modalita>(pasto ? (postiLiberi > 0 ? 'tavolo' : 'asporto') : 'partecipazione');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [quantita, setQuantita] = useState(1);
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([{ nome: '', cognome: '', eta: 6 }]);
  const [privacy, setPrivacy] = useState(false);
  const [liberatoria, setLiberatoria] = useState<boolean | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);

  const massimo = modalita === 'asporto' ? Math.min(10, porzioniLibere) : Math.min(10, postiLiberi);
  const tavoloEsaurito = pasto && postiLiberi === 0;

  if (!pasto && postiLiberi === 0) return <p className="avviso">Posti esauriti.</p>;
  if (pasto && tavoloEsaurito && !asportoPossibile) return <p className="avviso">Posti esauriti.</p>;

  const q = conBambini ? partecipanti.length : quantita;
  const problemi: string[] = [];
  if (!nome.trim() || !cognome.trim()) problemi.push('nome e cognome');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) problemi.push('un\'email valida');
  if (conBambini && partecipanti.some((p) => !p.nome.trim() || !p.cognome.trim())) problemi.push('nome e cognome di ogni bambino');
  if (!privacy) problemi.push('la presa visione dell\'informativa');
  if (ev.documentiRichiesti.liberatoriaFoto && !pasto && liberatoria === null) problemi.push('la scelta sulla liberatoria foto');
  if (serveFirma && !firma) problemi.push('la firma');
  if (q > massimo) problemi.push(`al massimo ${massimo} ${modalita === 'asporto' ? 'porzioni' : 'posti'}`);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problemi.length) return;
    setInvio(true);
    onErrore('');
    try {
      const codice = await creaPrenotazione(ev.id, {
        modalita,
        nome,
        cognome,
        email,
        quantita: q,
        partecipanti: conBambini
          ? partecipanti.map((p) => ({ nome: p.nome.trim(), cognome: p.cognome.trim(), eta: p.eta }))
          : [],
        liberatoriaFoto: !pasto && ev.documentiRichiesti.liberatoriaFoto ? liberatoria : null,
        firma: serveFirma ? firma : null,
      });
      navigate(`/biglietto/${codice}?nuovo=1`);
    } catch (err) {
      if (err instanceof ErrorePrenotazione) onErrore(err.message);
      else if (err instanceof FirebaseError && err.code === 'permission-denied')
        onErrore('Non è stato possibile completare la prenotazione: i posti potrebbero essere appena finiti. Ricarica la pagina e riprova.');
      else onErrore('Qualcosa è andato storto. Controlla la connessione e riprova.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setInvio(false);
    }
  };

  const aggiornaBambino = (i: number, campo: keyof Partecipante, valore: string) =>
    setPartecipanti((lista) =>
      lista.map((p, j) => (j === i ? { ...p, [campo]: campo === 'eta' ? Number(valore) : valore } : p)),
    );

  return (
    <form className="modulo" onSubmit={invia} noValidate>
      {pasto && (
        <fieldset className="scelta-modalita">
          <legend>Come vuoi partecipare?</legend>
          <div className="griglia-2">
            <button
              type="button"
              className={modalita === 'tavolo' ? 'opzione attiva' : 'opzione'}
              aria-pressed={modalita === 'tavolo'}
              disabled={tavoloEsaurito}
              onClick={() => setModalita('tavolo')}
            >
              <Icona nome="pasto" size={30} />
              <span className="opzione-titolo">Al tavolo</span>
              <span className="opzione-sotto">{tavoloEsaurito ? 'Esaurito' : `${postiLiberi} posti liberi`}</span>
            </button>
            <button
              type="button"
              className={modalita === 'asporto' ? 'opzione attiva' : 'opzione'}
              aria-pressed={modalita === 'asporto'}
              disabled={!asportoPossibile}
              onClick={() => setModalita('asporto')}
            >
              <Icona nome="asporto" size={30} />
              <span className="opzione-titolo">Asporto</span>
              <span className="opzione-sotto">
                {!ev.asportoAttivo ? 'Non previsto' : porzioniLibere === Infinity ? 'Ritiro in sede' : porzioniLibere > 0 ? `${porzioniLibere} porzioni` : 'Esaurito'}
              </span>
            </button>
          </div>
        </fieldset>
      )}

      {conBambini && (
        <fieldset>
          <legend>Bambini che partecipano</legend>
          {partecipanti.map((p, i) => (
            <div className="bambino" key={i}>
              <div className="griglia-2">
                <label>Nome<input value={p.nome} onChange={(e) => aggiornaBambino(i, 'nome', e.target.value)} autoComplete="off" /></label>
                <label>Cognome<input value={p.cognome} onChange={(e) => aggiornaBambino(i, 'cognome', e.target.value)} autoComplete="off" /></label>
              </div>
              <div className="riga-bambino">
                <label className="eta">Età
                  <select value={p.eta} onChange={(e) => aggiornaBambino(i, 'eta', e.target.value)}>
                    {Array.from({ length: 16 }, (_, n) => n + 2).map((n) => <option key={n} value={n}>{n} anni</option>)}
                  </select>
                </label>
                {partecipanti.length > 1 && (
                  <button type="button" className="link-bottone" onClick={() => setPartecipanti((l) => l.filter((_, j) => j !== i))}>Rimuovi</button>
                )}
              </div>
            </div>
          ))}
          {partecipanti.length < massimo && (
            <button type="button" className="bottone-tratteggiato" onClick={() => setPartecipanti((l) => [...l, { nome: '', cognome: l[0]?.cognome ?? '', eta: 6 }])}>
              + Aggiungi un bambino
            </button>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>{conBambini ? 'Dati del genitore' : 'I tuoi dati'}</legend>
        <div className="griglia-2">
          <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" /></label>
          <label>Cognome<input value={cognome} onChange={(e) => setCognome(e.target.value)} autoComplete="family-name" /></label>
        </div>
        <label>Email<input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        {!conBambini && (
          <div className="contatore">
            <span>{modalita === 'asporto' ? 'Porzioni' : 'Persone'}</span>
            <div>
              <button type="button" aria-label="Meno" disabled={quantita <= 1} onClick={() => setQuantita((n) => n - 1)}>−</button>
              <output aria-live="polite">{quantita}</output>
              <button type="button" aria-label="Più" disabled={quantita >= massimo} onClick={() => setQuantita((n) => n + 1)}>+</button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Documenti</legend>
        <details className="documento">
          <summary>Leggi l'informativa privacy</summary>
          <p>{INFORMATIVA_PRIVACY}</p>
        </details>
        <label className="spunta">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          Ho letto l'informativa privacy
        </label>

        {!pasto && ev.documentiRichiesti.liberatoriaFoto && (
          <div className="liberatoria">
            <details className="documento">
              <summary>Liberatoria foto e video</summary>
              <p>{LIBERATORIA_FOTO}</p>
            </details>
            <div className="griglia-2">
              <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} aria-pressed={liberatoria === true} onClick={() => setLiberatoria(true)}>Acconsento</button>
              <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} aria-pressed={liberatoria === false} onClick={() => setLiberatoria(false)}>Non acconsento</button>
            </div>
            <p className="nota">Facoltativa: l'iscrizione vale comunque.</p>
          </div>
        )}

        {serveFirma && (
          <div>
            <div className="etichetta-campo">{conBambini ? 'Firma del genitore' : 'Firma'}</div>
            <Firma onChange={setFirma} />
          </div>
        )}
      </fieldset>

      {problemi.length > 0 && <p className="nota">Per continuare manca: {problemi.join(', ')}.</p>}
      <button type="submit" className="bottone" disabled={invio || problemi.length > 0}>
        {invio ? 'Prenotazione in corso…' : serveFirma ? 'Firma e iscriviti' : ev.prezzo ? 'Prenota · paghi in loco' : 'Prenota'}
      </button>
    </form>
  );
}
