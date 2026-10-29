import { useState } from 'react';
import { aggiungiIscrittoManuale } from '../../lib/dati';
import { useAuth } from '../../lib/auth';
import { daPagare, euro } from '../../lib/menu';
import type { Evento, Modalita, Partecipante } from '../../types';

/** Iscrizione presa fuori dall'app (a voce, su carta, WhatsApp): la si inserisce qui, firme e dati mancanti si completano all'ingresso. */
export function AggiungiIscritto({ ev, onChiudi }: { ev: Evento; onChiudi: (msg?: string) => void }) {
  const { utente } = useAuth();
  const pasto = ev.tipo === 'pasto';
  const conBambini = !pasto && ev.pubblico !== 'adulti';
  const [modalita, setModalita] = useState<Modalita>(pasto ? 'tavolo' : 'partecipazione');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [note, setNote] = useState('');
  const [quantita, setQuantita] = useState(1);
  const [bambini, setBambini] = useState<Partecipante[]>([{ nome: '', cognome: '', eta: 6 }]);
  const [cartaceo, setCartaceo] = useState(false);
  const [liberatoria, setLiberatoria] = useState<boolean | null>(null);
  const [pagato, setPagato] = useState(false);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const q = conBambini ? bambini.length : quantita;
  const liberi = modalita === 'asporto' ? Infinity : ev.postiMax - ev.postiOccupati;
  const importo = daPagare({ quantita: q, modalita }, ev)?.importo ?? null;
  const emailOk = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ok = nome.trim() && cognome.trim() && emailOk && q >= 1;

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setInvio(true);
    setErrore('');
    try {
      await aggiungiIscrittoManuale(ev.id, {
        modalita, nome, cognome, email, telefono, note, quantita: q,
        // I nomi dei bambini si possono lasciare vuoti: si scrivono all'ingresso.
        partecipanti: conBambini ? bambini.map((b) => ({ nome: b.nome.trim(), cognome: (b.cognome || cognome).trim(), eta: b.eta })) : [],
        cartaceo,
        liberatoriaFoto: ev.documentiRichiesti.liberatoriaFoto && !pasto ? liberatoria : null,
        pagato,
        importo: pagato ? importo : null,
      }, utente?.email ?? '');
      onChiudi(`${cognome.trim()} ${nome.trim()} aggiunto${cartaceo ? '' : ': firme e dati mancanti si completano all\'ingresso'}.`);
    } catch (err) {
      setErrore(err instanceof Error ? `Non salvato: ${err.message}` : 'Non salvato.');
      setInvio(false);
    }
  };

  const setBambino = (i: number, v: Partial<Partecipante>) => setBambini((l) => l.map((b, k) => (k === i ? { ...b, ...v } : b)));

  return (
    <form className="modulo pannello" onSubmit={salva}>
      <h2>Aggiungi iscritto</h2>
      <p className="nota">Per chi si è iscritto fuori dall'app. All'ingresso lo trovi cercando il nome, senza QR.</p>
      {pasto && (
        <div className="griglia-2">
          <button type="button" className={modalita === 'tavolo' ? 'scelta attiva' : 'scelta'} onClick={() => setModalita('tavolo')}>Al tavolo</button>
          <button type="button" className={modalita === 'asporto' ? 'scelta attiva' : 'scelta'} disabled={!ev.asportoAttivo} onClick={() => setModalita('asporto')}>Asporto</button>
        </div>
      )}
      <div className="griglia-2">
        <label>Nome{conBambini ? ' del genitore' : ''}<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoComplete="off" /></label>
        <label>Cognome<input value={cognome} onChange={(e) => setCognome(e.target.value)} maxLength={60} autoComplete="off" /></label>
      </div>
      <div className="griglia-2">
        <label>Telefono (facoltativo)<input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" maxLength={30} /></label>
        <label>Email (facoltativa)<input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" maxLength={120} aria-invalid={!emailOk} /></label>
      </div>

      {conBambini ? (
        <fieldset>
          <legend>Bambini</legend>
          <span className="nota">I nomi si possono lasciare vuoti e scrivere all'ingresso: conta il numero.</span>
          {bambini.map((b, i) => (
            <div key={i} className="riga-bambino-manuale">
              <input value={b.nome} onChange={(e) => setBambino(i, { nome: e.target.value })} placeholder={`Bambino ${i + 1}: nome`} maxLength={60} aria-label={`Nome bambino ${i + 1}`} />
              <select value={b.eta} onChange={(e) => setBambino(i, { eta: Number(e.target.value) })} aria-label={`Età bambino ${i + 1}`}>
                {Array.from({ length: 16 }, (_, n) => n + 2).map((n) => <option key={n} value={n}>{n} anni</option>)}
              </select>
              {bambini.length > 1 && <button type="button" className="mini" onClick={() => setBambini((l) => l.filter((_, k) => k !== i))}>Togli</button>}
            </div>
          ))}
          {bambini.length < 30 && <button type="button" className="bottone-tratteggiato" onClick={() => setBambini((l) => [...l, { nome: '', cognome: '', eta: 6 }])}>+ Aggiungi un bambino</button>}
        </fieldset>
      ) : (
        <div className="contatore">
          <span>{modalita === 'asporto' ? 'Porzioni' : 'Persone'}</span>
          <div>
            <button type="button" aria-label="Meno" disabled={quantita <= 1} onClick={() => setQuantita((n) => n - 1)}>−</button>
            <output>{quantita}</output>
            <button type="button" aria-label="Più" disabled={quantita >= 30} onClick={() => setQuantita((n) => n + 1)}>+</button>
          </div>
        </div>
      )}
      {q > liberi && <p className="avviso">Attenzione: restano {Math.max(0, liberi)} posti, così si va oltre il massimo ({ev.postiMax}). Si può salvare lo stesso.</p>}

      <label>Note (facoltative)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="es. iscritto da Giulia, allergia…" /></label>

      <label className="spunta"><input type="checkbox" checked={cartaceo} onChange={(e) => setCartaceo(e.target.checked)} /> Informativa{!pasto && ev.documentiRichiesti.liberatoriaFoto ? ' e liberatoria' : ''} già firmate su carta</label>
      {cartaceo && !pasto && ev.documentiRichiesti.liberatoriaFoto && (
        <div className="griglia-2">
          <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(true)}>Foto: acconsente</button>
          <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(false)}>Foto: non acconsente</button>
        </div>
      )}
      {!cartaceo && <p className="nota">Senza spunta resta "Da completare": all'ingresso gli fai leggere l'informativa e firmare sul telefono.</p>}
      <label className="spunta"><input type="checkbox" checked={pagato} onChange={(e) => setPagato(e.target.checked)} /> Ha già pagato{importo ? ` (${euro(importo)})` : ''}</label>

      {errore && <p className="avviso errore">{errore}</p>}
      <div className="riga-azioni">
        <button type="submit" className="bottone" disabled={!ok || invio}>{invio ? 'Salvo…' : 'Aggiungi'}</button>
        <button type="button" className="bottone contorno" onClick={() => onChiudi()}>Annulla</button>
      </div>
    </form>
  );
}
