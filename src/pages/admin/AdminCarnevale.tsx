import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icona } from '../../components/Icona';
import { SceltaProva } from '../../components/SceltaProva';
import { codiceLeggibile } from '../../lib/codice';
import { centesimi, euro } from '../../lib/menu';
import {
  aggiungiGiornata, ascoltaGiornate, ascoltaImpostazioniCarnevale, ascoltaIscrizioniCarnevale, eliminaGiornata, eliminaIscrizioneCarnevale,
  ErroreCarnevale, etaAl, IMPOSTAZIONI_PREDEFINITE, postiGiornata, prenotaProva, prenotatiGiornata, salvaImpostazioniCarnevale, salvaNoteCarnevale, slotGiornata,
} from '../../lib/carnevale';
import { descriviProva, excelCarnevale, pdfIscrizioneCarnevale, zipIscrizioniCarnevale } from '../../lib/esportaCarnevale';
import type { GiornataProve, ImpostazioniCarnevale, IscrizioneCarnevale } from '../../types';

type Scheda = 'prove' | 'iscritti' | 'pagamenti' | 'impostazioni';

/** Gestione → Carnevale: giornate di prova, iscritti, pagamenti, impostazioni di "Sfila con noi". */
export function AdminCarnevale() {
  const [cerca] = useSearchParams();
  const aggiunto = cerca.get('aggiunto');
  const [scheda, setScheda] = useState<Scheda>(aggiunto ? 'iscritti' : 'prove');
  const [imp, setImp] = useState<ImpostazioniCarnevale | null>(null);
  const [giornate, setGiornate] = useState<GiornataProve[]>([]);
  const [lista, setLista] = useState<IscrizioneCarnevale[] | null>(null);
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  useEffect(() => ascoltaGiornate(setGiornate), []);
  useEffect(() => ascoltaIscrizioniCarnevale(setLista, () => setLista([])), []);

  const l = lista ?? [];
  const figuranti = l.reduce((s, i) => s + i.persone.length, 0);
  const conProva = l.filter((i) => i.prova).reduce((s, i) => s + i.persone.length, 0);
  const daFirmare = l.filter((i) => i.daCompletare || !i.firma).length;

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Carnevale</h1>
      </header>
      <main className="contenuto">
        {imp && !imp.aperte && <p className="avviso">Le iscrizioni online sono chiuse: aprile da Impostazioni quando quote e date delle prove sono pronte.</p>}
        {aggiunto && <p className="avviso">Iscrizione {codiceLeggibile(aggiunto)} aggiunta.</p>}
        <div className="cifre-carnevale">
          <div><strong>{figuranti}</strong><span>figuranti</span></div>
          <div><strong>{conProva}</strong><span>con prova</span></div>
          <div className={daFirmare ? 'attenzione' : ''}><strong>{daFirmare}</strong><span>firme mancanti</span></div>
        </div>
        <nav className="schede" aria-label="Sezioni">
          {(['prove', 'iscritti', 'pagamenti', 'impostazioni'] as Scheda[]).map((s) => (
            <button type="button" key={s} className={scheda === s ? 'scheda attiva' : 'scheda'} aria-pressed={scheda === s} onClick={() => setScheda(s)}>
              {{ prove: 'Prove', iscritti: 'Iscritti', pagamenti: 'Pagamenti', impostazioni: 'Impostazioni' }[s]}
            </button>
          ))}
        </nav>
        {scheda === 'prove' && imp && <Prove imp={imp} giornate={giornate} lista={l} />}
        {scheda === 'iscritti' && imp && <Iscritti lista={lista} giornate={giornate} evidenzia={aggiunto} />}
        {scheda === 'pagamenti' && <Pagamenti lista={l} />}
        {scheda === 'impostazioni' && imp && <Impostazioni imp={imp} />}
        <div className="riga-azioni">
          <Link to="/staff/carnevale" className="bottone contorno">Apri la schermata delle prove</Link>
        </div>
      </main>
    </>
  );
}

function Prove({ imp, giornate, lista }: { imp: ImpostazioniCarnevale; giornate: GiornataProve[]; lista: IscrizioneCarnevale[] }) {
  const [giorno, setGiorno] = useState('');
  const [dalle, setDalle] = useState('15:00');
  const [alle, setAlle] = useState('18:00');
  const [aperta, setAperta] = useState<string | null>(null);
  const [errore, setErrore] = useState('');
  const aggiungi = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrore('');
    try { await aggiungiGiornata(giorno, dalle, alle, imp); setGiorno(''); } catch (err) { setErrore(err instanceof Error ? err.message : 'Non salvata.'); }
  };
  const slotPrevisti = giorno && dalle && alle ? slotGiornata({ dalle, alle, slotMinuti: imp.slotMinuti }).length : 0;
  return (
    <section className="modulo">
      {giornate.length === 0 && <p className="vuoto">Nessuna giornata di prova: aggiungi la prima qui sotto.</p>}
      {giornate.map((g) => {
        const occ = prenotatiGiornata(g);
        const tot = postiGiornata(g);
        const qui = lista.filter((i) => i.prova?.giornata === g.id);
        return (
          <div key={g.id} className="giornata-admin">
            <div className="giornata-testa">
              <strong>{g.data.toDate().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              <span className="nota">{g.dalle}–{g.alle}</span>
            </div>
            <div className="barra"><div style={{ width: `${tot ? Math.round((occ / tot) * 100) : 0}%` }} /></div>
            <div className="giornata-testa">
              <span className="nota">{occ} su {tot} posti prenotati · slot di {g.slotMinuti} min da {g.postiSlot}</span>
              <span className="riga-azioni">
                <button type="button" className="link-bottone" onClick={() => setAperta(aperta === g.id ? null : g.id)}>{aperta === g.id ? 'Chiudi agenda' : 'Agenda'}</button>
                {occ === 0 && <button type="button" className="link-bottone" onClick={() => { if (confirm('Eliminare questa giornata?')) eliminaGiornata(g.id); }}>Elimina</button>}
              </span>
            </div>
            {aperta === g.id && (
              <table className="agenda">
                <tbody>
                  {slotGiornata(g).map((ora) => {
                    const chi = qui.filter((i) => i.prova!.ora === ora);
                    return (
                      <tr key={ora}>
                        <td>{ora}</td>
                        <td>{chi.length ? chi.map((i) => `${i.persone[0].cognome} (${i.persone.length})${i.provato ? ' ✓' : ''}`).join(', ') : <span className="nota">libero</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      <form className="giornata-nuova" onSubmit={aggiungi}>
        <strong>+ Aggiungi giornata</strong>
        <div className="griglia-3">
          <label>Data<input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} required /></label>
          <label>Dalle<input type="time" value={dalle} step={300} onChange={(e) => setDalle(e.target.value)} required /></label>
          <label>Alle<input type="time" value={alle} step={300} onChange={(e) => setAlle(e.target.value)} required /></label>
        </div>
        <span className="nota">Slot ogni {imp.slotMinuti} minuti, {imp.postiSlot} persone per slot{slotPrevisti ? ` → ${slotPrevisti} slot, ${slotPrevisti * imp.postiSlot} posti` : ''}.</span>
        {errore && <p className="avviso errore">{errore}</p>}
        <button type="submit" className="bottone" disabled={!giorno}>Aggiungi</button>
      </form>
    </section>
  );
}

function Iscritti({ lista, giornate, evidenzia }: { lista: IscrizioneCarnevale[] | null; giornate: GiornataProve[]; evidenzia: string | null }) {
  const [cerca, setCerca] = useState('');
  const [solo, setSolo] = useState<'tutti' | 'firma' | 'prova'>('tutti');
  const [aperta, setAperta] = useState<string | null>(evidenzia);
  const [lavoro, setLavoro] = useState('');
  const f = cerca.trim().toLowerCase();
  const visibili = useMemo(() => (lista ?? [])
    .filter((i) => solo === 'tutti' || (solo === 'firma' ? i.daCompletare || !i.firma : !i.prova))
    .filter((i) => !f || i.persone.some((p) => `${p.cognome} ${p.nome} ${p.codiceFiscale}`.toLowerCase().includes(f))), [lista, solo, f]);
  const esporta = async (cosa: 'excel' | 'zip') => {
    setLavoro(cosa);
    try { await (cosa === 'excel' ? excelCarnevale(lista ?? []) : zipIscrizioniCarnevale((lista ?? []).filter((i) => i.firma))); } finally { setLavoro(''); }
  };
  return (
    <section className="modulo">
      <div className="riga-azioni">
        <Link to="/carnevale/iscriviti?manuale=1" className="bottone">+ Iscrizione a mano</Link>
        <button type="button" className="bottone contorno piccolo" disabled={!!lavoro || !lista?.length} onClick={() => esporta('excel')}>{lavoro === 'excel' ? 'Preparo…' : 'Excel'}</button>
        <button type="button" className="bottone contorno piccolo" disabled={!!lavoro || !lista?.length} onClick={() => esporta('zip')}>{lavoro === 'zip' ? 'Preparo…' : 'ZIP firme'}</button>
      </div>
      <input className="cerca-iscritti" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per cognome, nome o codice fiscale" aria-label="Cerca" />
      <div className="riga-azioni">
        {(['tutti', 'firma', 'prova'] as const).map((s) => (
          <button type="button" key={s} className={solo === s ? 'scelta attiva piccola' : 'scelta piccola'} onClick={() => setSolo(s)}>
            {{ tutti: 'Tutti', firma: 'Firma mancante', prova: 'Senza prova' }[s]}
          </button>
        ))}
      </div>
      {lista === null && <p className="vuoto">Caricamento…</p>}
      {lista?.length === 0 && <p className="vuoto">Ancora nessun iscritto.</p>}
      {visibili.map((i) => (
        <div key={i.id} className={i.id === evidenzia ? 'iscritto-carnevale evidenziato' : 'iscritto-carnevale'}>
          <button type="button" className="iscritto-carnevale-testa" onClick={() => setAperta(aperta === i.id ? null : i.id)} aria-expanded={aperta === i.id}>
            <span>
              <strong>{i.persone[0].cognome}</strong> {i.persone.map((p) => p.nome).join(', ')}
              <span className="nota"> · {i.persone.length} {i.persone.length === 1 ? 'persona' : 'persone'}</span>
            </span>
            <span className="etichette">
              {(i.daCompletare || !i.firma) && <span className="etichetta etichetta-caldo">Firma</span>}
              {!i.prova && <span className="etichetta etichetta-giallo">No prova</span>}
              {i.provato && <span className="etichetta etichetta-neutro">Provato</span>}
              {i.pagato >= i.totale && i.totale > 0 && <span className="etichetta etichetta-neutro">Pagato</span>}
            </span>
          </button>
          {aperta === i.id && <DettaglioIscrizione i={i} giornate={giornate} />}
        </div>
      ))}
    </section>
  );
}

function DettaglioIscrizione({ i, giornate }: { i: IscrizioneCarnevale; giornate: GiornataProve[] }) {
  const [sposta, setSposta] = useState(false);
  const [prova, setProva] = useState<{ giornata: string; ora: string } | null>(null);
  const [note, setNote] = useState(i.note ?? '');
  const [errore, setErrore] = useState('');
  const salvaProva = async () => {
    if (!prova) return;
    setErrore('');
    try { await prenotaProva(i.id, prova.giornata, prova.ora); setSposta(false); } catch (e) { setErrore(e instanceof ErroreCarnevale ? e.message : 'Non salvato.'); }
  };
  return (
    <div className="dettaglio-carnevale">
      <ul>
        {i.persone.map((p) => (
          <li key={p.codiceFiscale}>{p.nome} {p.cognome} · {p.dataNascita.split('-').reverse().join('/')} ({etaAl(p.dataNascita)}) · {p.luogoNascita} · {p.codiceFiscale} · {p.bambino ? 'bambino' : 'adulto'}{p.taglia ? ` · taglia ${p.taglia}` : ''}</li>
        ))}
      </ul>
      <p className="nota">{i.referente.indirizzo} · {i.referente.cellulare}{i.referente.email ? ` · ${i.referente.email}` : ''}</p>
      <p className="nota">
        Prova: {i.prova ? descriviProva(i) : 'non prenotata'} · Quota {euro(i.totale)}, pagato {euro(i.pagato)} · Foto: {i.consensi.liberatoriaFoto === null ? '?' : i.consensi.liberatoriaFoto ? 'sì' : 'no'}
        {i.consegnato ? ' · costume consegnato' : ''} · {i.manuale ? `inserita a mano${i.inseritaDa ? ` da ${i.inseritaDa}` : ''}` : 'dall\'app'}
      </p>
      <label>Note<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (i.note ?? '') && salvaNoteCarnevale(i.id, note)} /></label>
      {sposta && (
        <>
          <SceltaProva giornate={giornate} persone={i.persone.length} valore={prova} onChange={setProva} ignoraLimite />
          {errore && <p className="avviso errore">{errore}</p>}
          <button type="button" className="bottone piccolo" disabled={!prova} onClick={salvaProva}>Salva orario</button>
        </>
      )}
      <div className="riga-azioni">
        <Link to={`/carnevale/b/${i.id}`} className="link-bottone">Pagina con QR</Link>
        <button type="button" className="link-bottone" onClick={() => pdfIscrizioneCarnevale(i)}>PDF</button>
        <button type="button" className="link-bottone" onClick={() => setSposta(!sposta)}>{i.prova ? 'Sposta prova' : 'Prenota prova'}</button>
        <button type="button" className="link-bottone" onClick={() => { if (confirm(`Eliminare l'iscrizione di ${i.persone.map((p) => p.nome).join(', ')} ${i.persone[0].cognome}?`)) eliminaIscrizioneCarnevale(i.id); }}>Elimina</button>
      </div>
    </div>
  );
}

function Pagamenti({ lista }: { lista: IscrizioneCarnevale[] }) {
  const dovuto = lista.reduce((s, i) => s + i.totale, 0);
  const incassato = lista.reduce((s, i) => s + i.pagato, 0);
  const daIncassare = lista.filter((i) => i.pagato < i.totale);
  return (
    <section className="modulo">
      <div className="riepilogo-quota">
        <div><span>Quote totali</span><strong>{euro(dovuto)}</strong></div>
        <div><span>Incassato</span><strong>{euro(incassato)}</strong></div>
        <div><span>Da incassare</span><strong>{euro(dovuto - incassato)}</strong></div>
      </div>
      <h2 className="titolo-sezione">Chi deve ancora pagare</h2>
      {daIncassare.length === 0 && <p className="vuoto">Nessuno.</p>}
      <table className="agenda">
        <tbody>
          {daIncassare.map((i) => (
            <tr key={i.id}>
              <td>{i.persone[0].cognome} {i.persone[0].nome}{i.persone.length > 1 ? ` +${i.persone.length - 1}` : ''}</td>
              <td>{i.pagato ? `pagato ${euro(i.pagato)}` : 'niente'}</td>
              <td><strong>{euro(i.totale - i.pagato)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Impostazioni({ imp }: { imp: ImpostazioniCarnevale }) {
  const euroTesto = (c: number) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
  const [b, setB] = useState({ ...imp, qa: euroTesto(imp.quotaAdulto), qb: euroTesto(imp.quotaBambino), an: euroTesto(imp.anticipo) });
  const [esito, setEsito] = useState('');
  const [errore, setErrore] = useState('');
  const set = (v: Partial<typeof b>) => { setEsito(''); setB((x) => ({ ...x, ...v })); };
  const qa = centesimi(b.qa || '0');
  const qb = centesimi(b.qb || '0');
  const an = centesimi(b.an || '0');
  const ok = qa !== null && qb !== null && an !== null && b.slotMinuti >= 5 && b.postiSlot >= 1 && b.etaBambino >= 1;
  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setErrore('');
    try {
      const { qa: _a, qb: _b, an: _c, ...resto } = b;
      void _a; void _b; void _c;
      await salvaImpostazioniCarnevale({ ...IMPOSTAZIONI_PREDEFINITE, ...resto, quotaAdulto: qa!, quotaBambino: qb!, anticipo: an! });
      setEsito('Salvato.');
    } catch (err) { setErrore(err instanceof Error ? err.message : 'Non salvato.'); }
  };
  return (
    <form className="modulo" onSubmit={salva}>
      <label className="spunta"><input type="checkbox" checked={b.aperte} onChange={(e) => set({ aperte: e.target.checked })} /> Iscrizioni online aperte ("Sfila con noi" nella pagina Carnevale)</label>
      <fieldset>
        <legend>Quote costume</legend>
        <div className="griglia-3">
          <label>Adulto €<input value={b.qa} inputMode="decimal" onChange={(e) => set({ qa: e.target.value })} aria-invalid={qa === null} /></label>
          <label>Bambino €<input value={b.qb} inputMode="decimal" onChange={(e) => set({ qb: e.target.value })} aria-invalid={qb === null} /></label>
          <label>Anticipo a persona €<input value={b.an} inputMode="decimal" onChange={(e) => set({ an: e.target.value })} aria-invalid={an === null} /></label>
        </div>
        <label>Quota bambino sotto i … anni
          <input type="number" min={1} max={18} value={b.etaBambino} onChange={(e) => set({ etaBambino: Number(e.target.value) })} />
          <span className="nota">Es. 14: fino a 13 anni compiuti si paga la quota bambino. Vale per le nuove iscrizioni.</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Prove costume</legend>
        <div className="griglia-2">
          <label>Minuti per slot<input type="number" min={5} max={120} value={b.slotMinuti} onChange={(e) => set({ slotMinuti: Number(e.target.value) })} /></label>
          <label>Persone per slot<input type="number" min={1} max={50} value={b.postiSlot} onChange={(e) => set({ postiSlot: Number(e.target.value) })} /></label>
        </div>
        <span className="nota">Valgono per le giornate che aggiungi da ora in poi.</span>
        <label>Dove si fanno le prove<input value={b.luogoProve} maxLength={120} onChange={(e) => set({ luogoProve: e.target.value })} placeholder="es. Sede, Via Thaon de Revel 34" /></label>
      </fieldset>
      <label>Date delle sfilate (testo nella pagina)<input value={b.sfilate} maxLength={160} onChange={(e) => set({ sfilate: e.target.value })} /></label>
      {errore && <p className="avviso errore">{errore}</p>}
      {esito && <p className="avviso">{esito}</p>}
      <button type="submit" className="bottone" disabled={!ok}>Salva impostazioni</button>
      <p className="nota">Informativa e liberatoria del Carnevale si modificano da <Link to="/admin/testi">Gestione → Informative e contatti</Link>.</p>
    </form>
  );
}
