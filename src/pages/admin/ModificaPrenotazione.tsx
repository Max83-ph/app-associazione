import { useState } from 'react';
import { ErrorePrenotazione, modificaPrenotazione } from '../../lib/dati';
import { daPagare, etaMaxBambini, euro, haQuotaBambino } from '../../lib/menu';
import type { Evento, Prenotazione } from '../../types';

/** Correzione di una prenotazione da parte dell'organizzatore (online o inserita a mano). */
export function ModificaPrenotazione({ p, ev, onChiudi }: { p: Prenotazione; ev: Evento; onChiudi: (msg?: string) => void }) {
  const pasto = ev.tipo === 'pasto';
  const conOrdine = !!p.ordine?.length;
  const conPartecipanti = p.partecipanti.length > 0;
  const distinzione = p.modalita === 'tavolo' && haQuotaBambino(ev);
  const [nome, setNome] = useState(p.nome);
  const [cognome, setCognome] = useState(p.cognome);
  const [email, setEmail] = useState(p.email);
  const [telefono, setTelefono] = useState(p.telefono ?? '');
  const [note, setNote] = useState(p.note ?? '');
  const [adulti, setAdulti] = useState(distinzione ? p.quantita - (p.bambini ?? 0) : p.quantita);
  const [bambini, setBambini] = useState(p.bambini ?? 0);
  const [allergie, setAllergie] = useState(p.allergie ?? '');
  const [consenso, setConsenso] = useState(!!p.consensoAllergie);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const q = conOrdine || conPartecipanti ? p.quantita : distinzione ? adulti + bambini : adulti;
  const liberi = p.modalita === 'asporto' ? Infinity : ev.postiMax - ev.postiOccupati + p.quantita;
  const nuovo = daPagare({ quantita: q, modalita: p.modalita, bambini: distinzione ? bambini : undefined, ordine: p.ordine, totale: p.totale }, ev);
  const emailOk = !email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const allergieNuove = allergie.trim() !== (p.allergie ?? '').trim();
  const ok = nome.trim() && cognome.trim() && emailOk && q >= 1 && (!allergie.trim() || consenso || !allergieNuove);

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setInvio(true);
    setErrore('');
    try {
      await modificaPrenotazione(p.id, {
        nome, cognome, email, telefono, note, quantita: q,
        bambini: distinzione ? bambini : p.bambini,
        allergie: pasto ? allergie : (p.allergie ?? ''),
      });
      onChiudi(`Prenotazione di ${cognome.trim()} ${nome.trim()} aggiornata.`);
    } catch (err) {
      setErrore(err instanceof ErrorePrenotazione || err instanceof Error ? `Non salvata: ${err.message}` : 'Non salvata.');
      setInvio(false);
    }
  };

  const contatore = (etichetta: React.ReactNode, v: number, set: (n: number) => void, min: number) => (
    <div className="contatore">
      <span>{etichetta}</span>
      <div>
        <button type="button" aria-label="Meno" disabled={v <= min} onClick={() => set(v - 1)}>−</button>
        <output>{v}</output>
        <button type="button" aria-label="Più" disabled={q >= 60} onClick={() => set(v + 1)}>+</button>
      </div>
    </div>
  );

  return (
    <form className="modulo pannello modifica-prenotazione" onSubmit={salva}>
      <div className="griglia-2">
        <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} /></label>
        <label>Cognome<input value={cognome} onChange={(e) => setCognome(e.target.value)} maxLength={60} /></label>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" maxLength={120} aria-invalid={!emailOk} /></label>
        <label>Telefono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" maxLength={30} /></label>
      </div>
      {conOrdine ? (
        <p className="nota">Ordine d'asporto dal menù: i piatti non si modificano da qui.</p>
      ) : conPartecipanti ? (
        <p className="nota">{p.partecipanti.length} partecipanti con nome: il numero non si modifica da qui.</p>
      ) : distinzione ? (
        <div className="adulti-bambini">
          {contatore('Adulti', adulti, setAdulti, 0)}
          {contatore(<>Bambini <span className="nota">fino a {etaMaxBambini(ev)} anni</span></>, bambini, setBambini, 0)}
        </div>
      ) : (
        contatore(p.modalita === 'asporto' ? 'Porzioni' : 'Persone', adulti, setAdulti, 1)
      )}
      <p className="nota">
        Da {p.quantita} a {q} {p.modalita === 'asporto' ? 'porzioni' : 'posti'}
        {nuovo ? ` · da incassare ${nuovo.dettaglio} = ${euro(nuovo.importo)}` : ''}
        {p.pagamento.stato !== 'da_pagare' && p.pagamento.importo ? ` (già pagati ${euro(p.pagamento.importo)})` : ''}
      </p>
      {q > liberi && <p className="avviso">Così si va oltre i posti dell'evento ({ev.postiMax}): da qui si può, chi prenota online invece no.</p>}
      {pasto && (
        <>
          <label>Intolleranze o allergie
            <textarea className="campo-allergie" value={allergie} maxLength={500} rows={2} onChange={(e) => setAllergie(e.target.value)} placeholder="es. Marco: celiaco" />
          </label>
          {allergie.trim() && allergieNuove && (
            <label className="spunta"><input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} /> L'iscritto ha dato il consenso (a voce o su carta) all'uso solo per preparare i pasti</label>
          )}
        </>
      )}
      <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="es. tavolo vicino alla famiglia Rossi" /></label>
      {errore && <p className="avviso errore">{errore}</p>}
      <div className="riga-azioni">
        <button type="submit" className="bottone" disabled={!ok || invio}>{invio ? 'Salvo…' : 'Salva modifiche'}</button>
        <button type="button" className="bottone contorno" onClick={() => onChiudi()}>Annulla</button>
      </div>
    </form>
  );
}
