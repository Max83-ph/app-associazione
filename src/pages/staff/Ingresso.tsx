import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../lib/auth';
import {
  ascoltaEventiPubblici,
  ascoltaPrenotazioniEvento,
  leggiPrenotazione,
  registraIngresso,
  segnaPagamento,
} from '../../lib/dati';
import { codiceLeggibile, normalizzaCodice } from '../../lib/codice';
import { descriviModalita } from '../../lib/biglietto';
import { daPagare, euro, totaleConMenu } from '../../lib/menu';
import { dataBreve } from '../../lib/format';
import { Icona } from '../../components/Icona';
import type { Evento, Prenotazione } from '../../types';
import { CompletaIscrizione } from './CompletaIscrizione';

type Esito =
  | { tipo: 'valido' | 'usato' | 'annullato' | 'altro-evento' | 'trovato'; p: Prenotazione }
  | { tipo: 'sconosciuto'; codice: string };

export function Ingresso() {
  const { isOrganizzatore } = useAuth();
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState('');
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [manuale, setManuale] = useState('');
  const [cerca, setCerca] = useState('');
  const [camera, setCamera] = useState(false);
  const [erroreCamera, setErroreCamera] = useState('');
  const ultimo = useRef<{ codice: string; t: number }>({ codice: '', t: 0 });

  useEffect(
    () =>
      ascoltaEventiPubblici((lista) => {
        const prossimi = lista.filter((e) => e.data.toMillis() > Date.now() - 12 * 3600 * 1000);
        setEventi(prossimi);
        setEventoId((id) => id || prossimi[0]?.id || '');
      }, () => undefined),
    [],
  );
  useEffect(() => (eventoId ? ascoltaPrenotazioniEvento(eventoId, setPrenotazioni, () => undefined) : undefined), [eventoId]);

  const verifica = useCallback(
    async (grezzo: string) => {
      const codice = normalizzaCodice(grezzo);
      const ora = Date.now();
      if (!codice || (codice === ultimo.current.codice && ora - ultimo.current.t < 4000)) return;
      ultimo.current = { codice, t: ora };
      const p = await leggiPrenotazione(codice);
      if (!p) return setEsito({ tipo: 'sconosciuto', codice });
      if (p.eventId !== eventoId) return setEsito({ tipo: 'altro-evento', p });
      if (p.statoBiglietto !== 'valido') return setEsito({ tipo: p.statoBiglietto, p });
      // Iscrizione inserita a mano con firme mancanti: prima si completa, poi entra.
      if (p.daCompletare) return setEsito({ tipo: 'trovato', p });
      await registraIngresso(p.id);
      navigator.vibrate?.(120);
      setEsito({ tipo: 'valido', p });
    },
    [eventoId],
  );

  const attive = prenotazioni.filter((p) => p.statoBiglietto !== 'annullato' && p.modalita !== 'asporto');
  const entrati = attive.filter((p) => p.statoBiglietto === 'usato').reduce((s, p) => s + p.quantita, 0);
  const attesi = attive.reduce((s, p) => s + p.quantita, 0);
  const ultimi = prenotazioni
    .filter((p) => p.checkInAt)
    .sort((a, b) => b.checkInAt!.toMillis() - a.checkInAt!.toMillis())
    .slice(0, 5);
  const evento = eventi.find((e) => e.id === eventoId);
  const filtro = cerca.trim().toLowerCase();
  const trovati = filtro.length < 2 ? [] : prenotazioni
    .filter((p) => p.statoBiglietto !== 'annullato')
    .filter((p) => `${p.cognome} ${p.nome} ${p.nome} ${p.cognome} ${p.partecipanti.map((b) => `${b.nome} ${b.cognome}`).join(' ')}`.toLowerCase().includes(filtro))
    .slice(0, 8);
  const scegli = (p: Prenotazione) => {
    setCerca('');
    setEsito(p.statoBiglietto === 'usato' ? { tipo: 'usato', p } : { tipo: 'trovato', p });
  };
  // Il pannello mostra sempre i dati aggiornati (dopo pagamento, firme, ingresso).
  const esitoVivo: Esito | null = esito && esito.tipo !== 'sconosciuto'
    ? { ...esito, p: prenotazioni.find((x) => x.id === esito.p.id) ?? esito.p }
    : esito;

  return (
    <div className="schermo-staff">
      <header className="staff-testa">
        <div>
          <div className="staff-etichetta">Ingresso staff</div>
          <label className="visivamente-nascosto" htmlFor="scegli-evento">Evento</label>
          <select id="scegli-evento" className="staff-evento" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setEsito(null); }}>
            {eventi.length === 0 && <option value="">Nessun evento in programma</option>}
            {eventi.map((e) => <option key={e.id} value={e.id}>{e.titolo}, {dataBreve(e.data)}</option>)}
          </select>
        </div>
        <div className="contatore-staff" aria-label="Persone entrate">{entrati} / {attesi}</div>
      </header>

      {camera ? (
        <Scanner onCodice={verifica} onErrore={(m) => { setErroreCamera(m); setCamera(false); }} />
      ) : (
        <button type="button" className="avvia-camera" onClick={() => { setErroreCamera(''); setCamera(true); }} disabled={!eventoId}>
          <Icona nome="qr" size={40} />
          <span>Avvia la scansione</span>
        </button>
      )}
      {erroreCamera && <p className="avviso errore">{erroreCamera}</p>}

      <form className="codice-manuale" onSubmit={(e) => { e.preventDefault(); ultimo.current.codice = ''; verifica(manuale); setManuale(''); }}>
        <label className="visivamente-nascosto" htmlFor="codice">Codice del biglietto</label>
        <input id="codice" value={manuale} onChange={(e) => setManuale(e.target.value)} placeholder="Oppure scrivi il codice" autoCapitalize="characters" autoComplete="off" />
        <button type="submit" disabled={!manuale.trim() || !eventoId}>Verifica</button>
      </form>

      <div className="cerca-nome">
        <label className="visivamente-nascosto" htmlFor="cerca-nome">Cerca per nome</label>
        <input id="cerca-nome" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Oppure cerca per cognome o nome" autoComplete="off" disabled={!eventoId} />
        {filtro.length >= 2 && (
          <div className="risultati-nome">
            {trovati.length === 0 && <div className="riga-ultima">Nessuno con questo nome</div>}
            {trovati.map((p) => (
              <button type="button" key={p.id} className="riga-ultima" onClick={() => scegli(p)}>
                <span>{p.cognome} {p.nome}{p.partecipanti.length ? ` (${p.partecipanti.map((b) => b.nome).filter(Boolean).join(', ') || `${p.quantita} bambini`})` : `, ${p.quantita} pers.`}</span>
                {p.statoBiglietto === 'usato' ? <span className="etichetta etichetta-neutro">Entrato</span> : p.daCompletare ? <span className="etichetta etichetta-caldo">Da completare</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {esitoVivo && <PannelloEsito esito={esitoVivo} evento={evento} onChiudi={() => setEsito(null)} />}

      {ultimi.length > 0 && (
        <section className="ultime">
          <h2>Ultimi ingressi</h2>
          {ultimi.map((p) => (
            <div key={p.id} className="riga-ultima">
              <span>{p.cognome} {p.nome}, {p.quantita} pers.</span>
              {p.consensi.liberatoriaFoto === false && <span className="etichetta etichetta-giallo">Niente foto</span>}
            </div>
          ))}
        </section>
      )}

      <div className="staff-piede">
        {isOrganizzatore && <Link to="/admin">Gestione</Link>}
        <button type="button" className="link-bottone chiaro" onClick={() => signOut(auth)}>Esci</button>
      </div>
    </div>
  );
}

function PannelloEsito({ esito, evento, onChiudi }: { esito: Esito; evento?: Evento; onChiudi: () => void }) {
  if (esito.tipo === 'sconosciuto')
    return (
      <div className="esito esito-ko" role="status">
        <div className="esito-titolo">Biglietto non trovato</div>
        <div>Codice {codiceLeggibile(esito.codice)}</div>
      </div>
    );
  const { p } = esito;
  const quota = daPagare(p, evento);
  const classe = esito.tipo === 'valido' || (esito.tipo === 'trovato' && !p.daCompletare) ? 'esito esito-ok' : esito.tipo === 'trovato' ? 'esito esito-attenzione' : esito.tipo === 'usato' ? 'esito esito-attenzione' : 'esito esito-ko';
  const titolo = {
    valido: 'Valido',
    usato: 'Già usato',
    annullato: 'Annullato',
    'altro-evento': 'Altro evento',
    trovato: p.daCompletare ? 'Da completare' : p.statoBiglietto === 'usato' ? 'Entrato' : 'Iscritto',
  }[esito.tipo];
  return (
    <div className={classe} role="status">
      <div className="esito-titolo">
        {esito.tipo === 'valido' && <span className="spunta-esito"><Icona nome="ok" size={20} spessore={2.6} /></span>}
        {titolo}
      </div>
      <div className="esito-nome">{p.nome} {p.cognome}, {descriviModalita(p)}</div>
      {esito.tipo === 'altro-evento' && <div>È per “{p.eventoTitolo}”, non per {evento?.titolo ?? 'questo evento'}.</div>}
      {esito.tipo === 'usato' && p.checkInAt && <div>Entrato alle {p.checkInAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>}
      {p.partecipanti.some((b) => b.nome) && <div>{p.partecipanti.filter((b) => b.nome).map((b) => `${b.nome} (${b.eta})`).join(', ')}</div>}
      {(p.telefono || p.note) && <div className="nota-esito">{[p.telefono, p.note].filter(Boolean).join(' · ')}</div>}
      {p.consensi.liberatoriaFoto === false && <div className="etichetta etichetta-giallo">Niente foto</div>}
      {!!p.ordine?.length && <OrdineEsito p={p} evento={evento} />}
      {!p.ordine?.length && quota && p.pagamento.stato === 'da_pagare' && esito.tipo !== 'annullato' && esito.tipo !== 'altro-evento' && (
        <div className="ordine-esito">
          <div className="ordine-esito-totale"><span>Da incassare ({quota.dettaglio})</span><strong>{euro(quota.importo)}</strong></div>
        </div>
      )}
      {(esito.tipo === 'valido' || esito.tipo === 'usato' || esito.tipo === 'trovato') && (
        p.pagamento.stato === 'da_pagare' ? (
          <button type="button" className="bottone scuro" onClick={() => segnaPagamento(p.id, true, quota?.importo)}>
            {quota ? `Incassati ${euro(quota.importo)}: segna pagato` : 'Da pagare in loco: segna pagato'}
          </button>
        ) : (
          <div>Pagamento registrato{p.pagamento.importo ? ` (${euro(p.pagamento.importo)})` : ''}</div>
        )
      )}
      {(esito.tipo === 'valido' || esito.tipo === 'usato' || esito.tipo === 'trovato') && p.daCompletare && (
        <CompletaIscrizione key={p.id} p={p} evento={evento} onFatto={() => undefined} />
      )}
      {esito.tipo === 'trovato' && !p.daCompletare && p.statoBiglietto === 'valido' && (
        <button type="button" className="bottone" onClick={() => { registraIngresso(p.id); navigator.vibrate?.(120); }}>Fai entrare</button>
      )}
      <button type="button" className="link-bottone esito-chiudi" onClick={onChiudi}>Chiudi</button>
    </div>
  );
}

/** Ordine d'asporto: piatti, quantità e cifra da incassare. */
function OrdineEsito({ p, evento }: { p: Prenotazione; evento?: Evento }) {
  const ricalcolato = totaleConMenu(p, evento?.menuAsporto);
  return (
    <div className="ordine-esito">
      <ul>
        {p.ordine!.map((v) => <li key={v.id}><span>{v.quantita} × {v.nome}</span><span>{euro(v.prezzo * v.quantita)}</span></li>)}
      </ul>
      <div className="ordine-esito-totale">
        <span>{p.pagamento.stato === 'da_pagare' ? 'Da incassare' : 'Totale'}</span>
        <strong>{euro(p.totale ?? 0)}</strong>
      </div>
      {ricalcolato !== null && ricalcolato !== p.totale && (
        <div className="nota">Attenzione: con i prezzi attuali del menù farebbe {euro(ricalcolato)} (prezzi cambiati dopo la prenotazione).</div>
      )}
    </div>
  );
}

function Scanner({ onCodice, onErrore }: { onCodice: (c: string) => void; onErrore: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCodice);
  const err = useRef(onErrore);
  useEffect(() => {
    cb.current = onCodice;
    err.current = onErrore;
  });

  useEffect(() => {
    const scanner = new QrScanner(video.current!, (r) => cb.current(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      maxScansPerSecond: 5,
    });
    scanner.start().catch(() => err.current('Impossibile usare la fotocamera: controlla i permessi del browser. Puoi sempre scrivere il codice a mano.'));
    return () => scanner.destroy();
  }, []);

  return (
    <div className="scanner">
      <video ref={video} muted playsInline />
    </div>
  );
}
