import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { normalizzaCodice } from '../../lib/codice';
import { euro } from '../../lib/menu';
import { useTesti } from '../../lib/testi';
import {
  annullaUltimoPagamento, ascoltaGiornate, ascoltaImpostazioniCarnevale, ascoltaIscrizioniCarnevale, completaFirmaCarnevale,
  daIncassare, etaAl, IMPOSTAZIONI_PREDEFINITE, registraPagamento, registraProva, segnaConsegna, TAGLIE,
} from '../../lib/carnevale';
import { Firma } from '../../components/Firma';
import { Testo } from '../../components/TestoRicco';
import { Icona } from '../../components/Icona';
import { Scanner } from './Ingresso';
import type { GiornataProve, ImpostazioniCarnevale, IscrizioneCarnevale } from '../../types';

/** Prove costume e consegne: QR o ricerca per cognome, taglie, incassi, firme mancanti. */
export function ProveCarnevale() {
  const { isOrganizzatore } = useAuth();
  const [imp, setImp] = useState<ImpostazioniCarnevale>(IMPOSTAZIONI_PREDEFINITE);
  const [giornate, setGiornate] = useState<GiornataProve[]>([]);
  const [lista, setLista] = useState<IscrizioneCarnevale[]>([]);
  const [giornataId, setGiornataId] = useState('');
  const [selezione, setSelezione] = useState<string | null>(null);
  const [sconosciuto, setSconosciuto] = useState('');
  const [cerca, setCerca] = useState('');
  const [camera, setCamera] = useState(false);
  const [erroreCamera, setErroreCamera] = useState('');
  const ultimo = useRef({ codice: '', t: 0 });
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  useEffect(() => ascoltaIscrizioniCarnevale(setLista), []);
  useEffect(() => ascoltaGiornate((g) => {
    setGiornate(g);
    // Di default la giornata di oggi, altrimenti la prossima.
    const oggi = new Date().toISOString().slice(0, 10);
    setGiornataId((id) => id || (g.find((x) => x.giorno >= oggi) ?? g[g.length - 1])?.id || '');
  }), []);

  const verifica = useCallback((grezzo: string) => {
    const codice = normalizzaCodice(grezzo.split('/').pop() ?? grezzo);
    const ora = Date.now();
    if (!codice || (codice === ultimo.current.codice && ora - ultimo.current.t < 4000)) return;
    ultimo.current = { codice, t: ora };
    if (lista.some((i) => i.id === codice)) { setSelezione(codice); setSconosciuto(''); navigator.vibrate?.(120); setCamera(false); }
    else setSconosciuto(codice);
  }, [lista]);

  const g = giornate.find((x) => x.id === giornataId);
  const delGiorno = lista.filter((i) => i.prova?.giornata === giornataId).sort((a, b) => a.prova!.ora.localeCompare(b.prova!.ora));
  const persGiorno = delGiorno.reduce((s, i) => s + i.persone.length, 0);
  const provati = delGiorno.filter((i) => i.provato).reduce((s, i) => s + i.persone.length, 0);
  const filtro = cerca.trim().toLowerCase();
  const trovati = filtro.length < 2 ? [] : lista.filter((i) => i.persone.some((p) => `${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`.toLowerCase().includes(filtro))).slice(0, 8);
  const scelta = lista.find((i) => i.id === selezione);
  const prossimi = delGiorno.filter((i) => !i.provato && i.id !== selezione).slice(0, 6);

  return (
    <div className="schermo-staff">
      <header className="staff-testa">
        <div>
          <div className="staff-etichetta">Prove costume</div>
          <label className="visivamente-nascosto" htmlFor="giornata">Giornata</label>
          <select id="giornata" className="staff-evento" value={giornataId} onChange={(e) => { setGiornataId(e.target.value); setSelezione(null); }}>
            {giornate.length === 0 && <option value="">Nessuna giornata di prova</option>}
            {giornate.map((x) => <option key={x.id} value={x.id}>{x.data.toDate().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} {x.dalle}–{x.alle}</option>)}
          </select>
        </div>
        <div className="contatore-staff" aria-label="Persone che hanno provato">{provati} / {persGiorno}</div>
      </header>

      {camera ? (
        <Scanner onCodice={verifica} onErrore={(m) => { setErroreCamera(m); setCamera(false); }} />
      ) : (
        <button type="button" className="avvia-camera" onClick={() => { setErroreCamera(''); setCamera(true); }}>
          <Icona nome="qr" size={40} />
          <span>Scansiona il QR</span>
        </button>
      )}
      {erroreCamera && <p className="avviso errore">{erroreCamera}</p>}
      {sconosciuto && <div className="esito esito-ko" role="status"><div className="esito-titolo">Iscrizione non trovata</div><div>Non è un QR di "Sfila con noi".</div></div>}

      <div className="cerca-nome">
        <label className="visivamente-nascosto" htmlFor="cerca-carnevale">Cerca per cognome</label>
        <input id="cerca-carnevale" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Oppure cerca per cognome o nome" autoComplete="off" />
        {filtro.length >= 2 && (
          <div className="risultati-nome">
            {trovati.length === 0 && <div className="riga-ultima">Nessuno con questo nome</div>}
            {trovati.map((i) => (
              <button type="button" key={i.id} className="riga-ultima" onClick={() => { setSelezione(i.id); setCerca(''); setSconosciuto(''); }}>
                <span>{i.persone.map((p) => p.nome).join(', ')} {i.persone[0].cognome}</span>
                <span className="nota">{i.prova ? `${i.prova.data.toDate().toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })} ${i.prova.ora}` : 'senza prova'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {scelta && <PannelloCarnevale key={scelta.id} i={scelta} imp={imp} g={g} onChiudi={() => setSelezione(null)} />}

      {prossimi.length > 0 && (
        <section className="ultime">
          <h2>Prossimi</h2>
          {prossimi.map((i) => (
            <button type="button" key={i.id} className="riga-ultima" onClick={() => setSelezione(i.id)}>
              <span>{i.prova!.ora} · {i.persone[0].cognome} ({i.persone.length})</span>
              {i.daCompletare && <span className="etichetta etichetta-caldo">Da firmare</span>}
            </button>
          ))}
        </section>
      )}

      <div className="staff-piede">
        <Link to="/staff">Ingresso eventi</Link>
        {isOrganizzatore && <Link to="/admin/carnevale">Gestione Carnevale</Link>}
      </div>
    </div>
  );
}

function PannelloCarnevale({ i, imp, g, onChiudi }: { i: IscrizioneCarnevale; imp: ImpostazioniCarnevale; g?: GiornataProve; onChiudi: () => void }) {
  const { utente } = useAuth();
  const testi = useTesti();
  const [taglie, setTaglie] = useState<string[]>(() => i.persone.map((p) => p.taglia ?? ''));
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [liberatoria, setLiberatoria] = useState<boolean | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const d = daIncassare(i, imp);
  const altraGiornata = i.prova && g && i.prova.giornata !== g.id;
  const esegui = async (f: () => Promise<void>) => {
    setLavoro(true);
    setErrore('');
    try { await f(); navigator.vibrate?.(80); } catch (e) { setErrore(e instanceof Error ? `Non salvato: ${e.message}` : 'Non salvato.'); } finally { setLavoro(false); }
  };
  const classe = i.daCompletare ? 'esito esito-attenzione' : 'esito esito-ok';

  return (
    <div className={classe} role="status">
      <div className="esito-titolo">{i.persone.length > 1 ? `Famiglia ${i.persone[0].cognome}` : `${i.persone[0].nome} ${i.persone[0].cognome}`}</div>
      <div className="nota-esito">
        {i.prova ? `Prova ${i.prova.data.toDate().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' })} alle ${i.prova.ora}` : 'Nessuna prova prenotata'}
        {altraGiornata ? ' (è prenotato in un altro giorno)' : ''} · {i.referente.cellulare}
      </div>
      {i.note && <div className="nota-esito">{i.note}</div>}

      <div className="completa-ingresso modulo">
        {i.persone.map((p, k) => (
          <div key={p.codiceFiscale} className="riga-taglia">
            <div className="riga-taglia-nome">
              <strong>{p.nome} {p.cognome}</strong>
              <span className="nota">{etaAl(p.dataNascita)} anni · quota {p.bambino ? 'bambino' : 'adulto'}</span>
            </div>
            <label>Taglia
              <select value={taglie[k]} onChange={(e) => setTaglie((t) => t.map((x, j) => (j === k ? e.target.value : x)))}>
                <option value="">—</option>
                {TAGLIE.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
        ))}
        <button type="button" className="bottone" disabled={lavoro} onClick={() => esegui(() => registraProva(i.id, taglie, i.persone))}>
          {i.provato ? 'Aggiorna taglie' : 'Salva taglie e segna provato'}
        </button>
        {i.provato && <span className="nota">Prova registrata{i.provatoAt ? ` alle ${i.provatoAt.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}.</span>}
      </div>

      <div className="ordine-esito">
        <ul>
          <li><span>Quota costume</span><span>{euro(i.totale)}</span></li>
          <li><span>Già pagato</span><span>{euro(i.pagato)}</span></li>
        </ul>
        <div className="ordine-esito-totale"><span>Da incassare</span><strong>{euro(d.resto)}</strong></div>
      </div>
      {d.resto > 0 && (
        <div className="griglia-2">
          {d.anticipo > 0 && (
            <button type="button" className="bottone scuro" disabled={lavoro} onClick={() => esegui(() => registraPagamento(i, 'anticipo', d.anticipo, utente?.email ?? ''))}>
              Anticipo {euro(d.anticipo)}
            </button>
          )}
          <button type="button" className={d.anticipo > 0 ? 'bottone contorno' : 'bottone scuro'} disabled={lavoro}
            onClick={() => esegui(() => registraPagamento(i, i.pagato > 0 ? 'saldo' : 'tutto', d.resto, utente?.email ?? ''))}>
            {i.pagato > 0 ? `Saldo ${euro(d.resto)}` : `Tutto ${euro(d.resto)}`}
          </button>
        </div>
      )}
      {(i.movimenti?.length ?? 0) > 0 && (
        <div className="nota-esito">
          {i.movimenti.map((m) => `${m.tipo} ${euro(m.importo)} il ${m.at.toDate().toLocaleDateString('it-IT')}`).join(' · ')}
          {' · '}<button type="button" className="link-bottone" disabled={lavoro} onClick={() => { if (confirm('Annullare l\'ultimo incasso?')) esegui(() => annullaUltimoPagamento(i)); }}>annulla l'ultimo</button>
        </div>
      )}

      <label className="spunta">
        <input type="checkbox" checked={i.consegnato} disabled={lavoro} onChange={(e) => esegui(() => segnaConsegna(i.id, e.target.checked))} /> Costume consegnato
      </label>

      {i.daCompletare && (
        <div className="completa-ingresso modulo">
          <h3>Firma mancante</h3>
          <details className="documento"><summary>Informativa privacy (fagliela leggere)</summary><Testo testo={testi.informativaCarnevale} /></details>
          <label className="spunta"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Ha letto l'informativa</label>
          <details className="documento"><summary>Liberatoria foto e video</summary><Testo testo={testi.liberatoriaCarnevale} /></details>
          <div className="griglia-2">
            <button type="button" className={liberatoria === true ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(true)}>Acconsente</button>
            <button type="button" className={liberatoria === false ? 'scelta attiva' : 'scelta'} onClick={() => setLiberatoria(false)}>Non acconsente</button>
          </div>
          <div className="etichetta-campo">Firma di {i.persone[0].nome} {i.persone[0].cognome}</div>
          <Firma onChange={setFirma} />
          <button type="button" className="bottone" disabled={lavoro || !privacy || liberatoria === null || !firma}
            onClick={() => esegui(() => completaFirmaCarnevale(i.id, liberatoria, firma!))}>Salva la firma</button>
        </div>
      )}
      {errore && <p className="avviso errore">{errore}</p>}
      <button type="button" className="link-bottone esito-chiudi" onClick={onChiudi}>Chiudi</button>
    </div>
  );
}
