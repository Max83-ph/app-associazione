import { useState } from 'react';
import { completaIscrizione } from '../../lib/dati';
import { useTesti } from '../../lib/testi';
import { Firma } from '../../components/Firma';
import { Testo } from '../../components/TestoRicco';
import type { Evento, Partecipante, Prenotazione } from '../../types';

/** All'ingresso: chi si è iscritto fuori dall'app completa dati, presa visione, liberatoria e firma sul telefono dello staff. */
export function CompletaIscrizione({ p, evento, onFatto }: { p: Prenotazione; evento?: Evento; onFatto: () => void }) {
  const testi = useTesti();
  const pasto = evento?.tipo === 'pasto' || p.modalita === 'tavolo' || p.modalita === 'asporto';
  const conBambini = !pasto && evento?.pubblico !== 'adulti';
  const chiedeLiberatoria = !pasto && !!evento?.documentiRichiesti.liberatoriaFoto;
  const serveFirma = !pasto && !!evento && (evento.documentiRichiesti.privacy || evento.documentiRichiesti.liberatoriaFoto);

  const [nome, setNome] = useState(p.nome);
  const [cognome, setCognome] = useState(p.cognome);
  const [email, setEmail] = useState(p.email);
  const [bambini, setBambini] = useState<Partecipante[]>(() =>
    conBambini
      ? Array.from({ length: p.quantita }, (_, i) => p.partecipanti[i] ?? { nome: '', cognome: p.cognome, eta: 6 }).map((b) => ({ ...b, cognome: b.cognome || p.cognome }))
      : p.partecipanti,
  );
  const [privacy, setPrivacy] = useState(false);
  const [liberatoria, setLiberatoria] = useState<boolean | null>(p.consensi.liberatoriaFoto);
  const [firma, setFirma] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const manca: string[] = [];
  if (!nome.trim() || !cognome.trim()) manca.push('nome e cognome');
  if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) manca.push('un\'email valida (o lasciala vuota)');
  if (conBambini && bambini.some((b) => !b.nome.trim() || !b.cognome.trim())) manca.push('nome e cognome dei bambini');
  if (!privacy) manca.push('la presa visione dell\'informativa');
  if (chiedeLiberatoria && liberatoria === null) manca.push('la scelta sulle foto');
  if (serveFirma && !firma) manca.push('la firma');

  const setBambino = (i: number, v: Partial<Partecipante>) => setBambini((l) => l.map((b, k) => (k === i ? { ...b, ...v } : b)));

  const salva = async (entra: boolean) => {
    setInvio(true);
    setErrore('');
    try {
      await completaIscrizione(p.id, {
        nome, cognome, email,
        partecipanti: bambini.map((b) => ({ nome: b.nome.trim(), cognome: b.cognome.trim(), eta: b.eta })),
        liberatoriaFoto: chiedeLiberatoria ? liberatoria : null,
        firma: serveFirma ? firma : null,
        entra,
      });
      navigator.vibrate?.(120);
      onFatto();
    } catch (e) {
      setErrore(e instanceof Error ? `Non salvato: ${e.message}` : 'Non salvato.');
      setInvio(false);
    }
  };

  return (
    <div className="completa-ingresso modulo">
      <h3>Completa l'iscrizione</h3>
      <div className="griglia-2">
        <label>Nome{conBambini ? ' genitore' : ''}<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} /></label>
        <label>Cognome<input value={cognome} onChange={(e) => setCognome(e.target.value)} maxLength={60} /></label>
      </div>
      <label>Email (facoltativa, per mandare il biglietto)<input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" maxLength={120} /></label>
      {conBambini && bambini.map((b, i) => (
        <div key={i} className="riga-bambino-manuale">
          <input value={b.nome} onChange={(e) => setBambino(i, { nome: e.target.value })} placeholder={`Bambino ${i + 1}: nome`} maxLength={60} aria-label={`Nome bambino ${i + 1}`} />
          <input value={b.cognome} onChange={(e) => setBambino(i, { cognome: e.target.value })} placeholder="cognome" maxLength={60} aria-label={`Cognome bambino ${i + 1}`} />
          <select value={b.eta} onChange={(e) => setBambino(i, { eta: Number(e.target.value) })} aria-label={`Età bambino ${i + 1}`}>
            {Array.from({ length: 16 }, (_, n) => n + 2).map((n) => <option key={n} value={n}>{n} anni</option>)}
          </select>
        </div>
      ))}
      <details className="documento">
        <summary>Informativa privacy (fagliela leggere)</summary>
        <Testo testo={testi.informativaPrivacy} />
      </details>
      <label className="spunta"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Ha letto l'informativa privacy</label>
      {chiedeLiberatoria && (
        <>
          <details className="documento">
            <summary>Liberatoria foto e video</summary>
            <Testo testo={testi.liberatoriaFoto} />
          </details>
          <div className="griglia-2">
            <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(true)}>Acconsente</button>
            <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(false)}>Non acconsente</button>
          </div>
        </>
      )}
      {serveFirma && (
        <div>
          <div className="etichetta-campo">{conBambini ? 'Firma del genitore' : 'Firma'} (con il dito)</div>
          <Firma onChange={setFirma} />
        </div>
      )}
      {manca.length > 0 && <p className="nota">Manca: {manca.join(', ')}.</p>}
      {errore && <p className="avviso errore">{errore}</p>}
      <button type="button" className="bottone" disabled={invio || manca.length > 0} onClick={() => salva(p.statoBiglietto === 'valido')}>
        {invio ? 'Salvo…' : p.statoBiglietto === 'valido' ? 'Salva e fai entrare' : 'Salva'}
      </button>
    </div>
  );
}
