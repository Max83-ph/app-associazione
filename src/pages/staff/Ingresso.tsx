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
import { dataBreve } from '../../lib/format';
import { Icona } from '../../components/Icona';
import type { Evento, Prenotazione } from '../../types';

type Esito =
  | { tipo: 'valido' | 'usato' | 'annullato' | 'altro-evento'; p: Prenotazione }
  | { tipo: 'sconosciuto'; codice: string };

export function Ingresso() {
  const { isOrganizzatore } = useAuth();
  const [eventi, setEventi] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState('');
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [manuale, setManuale] = useState('');
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

  return (
    <div className="schermo-staff">
      <header className="staff-testa">
        <div>
          <div className="staff-etichetta">STAFF · INGRESSO</div>
          <label className="visivamente-nascosto" htmlFor="scegli-evento">Evento</label>
          <select id="scegli-evento" className="staff-evento" value={eventoId} onChange={(e) => { setEventoId(e.target.value); setEsito(null); }}>
            {eventi.length === 0 && <option value="">Nessun evento in programma</option>}
            {eventi.map((e) => <option key={e.id} value={e.id}>{e.titolo} · {dataBreve(e.data)}</option>)}
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

      {esito && <PannelloEsito esito={esito} evento={evento} />}

      {ultimi.length > 0 && (
        <section className="ultime">
          <h2>ULTIMI INGRESSI</h2>
          {ultimi.map((p) => (
            <div key={p.id} className="riga-ultima">
              <span>{p.cognome} {p.nome} · {p.quantita} pers.</span>
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

function PannelloEsito({ esito, evento }: { esito: Esito; evento?: Evento }) {
  if (esito.tipo === 'sconosciuto')
    return (
      <div className="esito esito-ko" role="status">
        <div className="esito-titolo">Biglietto non trovato</div>
        <div>Codice {codiceLeggibile(esito.codice)}</div>
      </div>
    );
  const { p } = esito;
  const classe = esito.tipo === 'valido' ? 'esito esito-ok' : esito.tipo === 'usato' ? 'esito esito-attenzione' : 'esito esito-ko';
  const titolo = {
    valido: 'Valido',
    usato: 'Già usato',
    annullato: 'Annullato',
    'altro-evento': 'Altro evento',
  }[esito.tipo];
  return (
    <div className={classe} role="status">
      <div className="esito-titolo">
        {esito.tipo === 'valido' && <span className="spunta-esito"><Icona nome="ok" size={20} spessore={2.6} /></span>}
        {titolo}
      </div>
      <div className="esito-nome">{p.nome} {p.cognome} · {descriviModalita(p)}</div>
      {esito.tipo === 'altro-evento' && <div>È per “{p.eventoTitolo}”, non per {evento?.titolo ?? 'questo evento'}.</div>}
      {esito.tipo === 'usato' && p.checkInAt && <div>Entrato alle {p.checkInAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>}
      {p.partecipanti.length > 0 && <div>{p.partecipanti.map((b) => `${b.nome} (${b.eta})`).join(', ')}</div>}
      {p.consensi.liberatoriaFoto === false && <div className="etichetta etichetta-giallo">Niente foto</div>}
      {(esito.tipo === 'valido' || esito.tipo === 'usato') && (
        p.pagamento.stato === 'da_pagare' ? (
          <button type="button" className="bottone scuro" onClick={() => segnaPagamento(p.id, true)}>Da pagare in loco · Segna pagato</button>
        ) : (
          <div>Pagamento registrato</div>
        )
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
