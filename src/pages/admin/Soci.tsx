import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { annoCorrente, ascoltaSoci } from '../../lib/soci';
import { excelSoci, pdfTuttiSoci } from '../../lib/esportaSoci';
import { Icona } from '../../components/Icona';
import { IscrizioneOnline } from './IscrizioneOnline';
import type { Socio, StatoSocio } from '../../types';

type Filtro = 'in_attesa' | 'attivo' | 'tutti';

export const ETICHETTE_STATO: Record<StatoSocio, string> = {
  in_attesa: 'Da approvare',
  attivo: 'Attivo',
  respinto: 'Respinto',
  sospeso: 'Sospeso',
};

export function Soci() {
  const [lista, setLista] = useState<Socio[] | null>(null);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('attivo');
  const [cerca, setCerca] = useState('');
  const [esporto, setEsporto] = useState('');
  const anno = annoCorrente();

  useEffect(() => ascoltaSoci(setLista, (e) => setErrore(e.message)), []);

  const tutti = useMemo(() => lista ?? [], [lista]);
  const inAttesa = tutti.filter((s) => s.stato === 'in_attesa');
  const attivi = tutti.filter((s) => s.stato === 'attivo');
  const pagati = attivi.filter((s) => s.tessere?.[anno]?.quotaPagata).length;

  // Codici fiscali presenti più di una volta: probabile doppione.
  const doppi = useMemo(() => {
    const visti = new Map<string, number>();
    tutti.forEach((s) => visti.set(s.codiceFiscale, (visti.get(s.codiceFiscale) ?? 0) + 1));
    return new Set([...visti].filter(([, n]) => n > 1).map(([cf]) => cf));
  }, [tutti]);

  const q = cerca.trim().toLowerCase();
  const visibili = tutti
    .filter((s) => filtro === 'tutti' || s.stato === filtro)
    .filter((s) => !q || `${s.nome} ${s.cognome} ${s.codiceFiscale} ${s.email} ${s.tessere?.[anno]?.numero ?? ''}`.toLowerCase().includes(q));

  const esporta = async (tipo: 'excel' | 'pdf') => {
    setEsporto(tipo);
    setErrore('');
    try {
      if (tipo === 'excel') await excelSoci(tutti, anno);
      else await pdfTuttiSoci(visibili.filter((s) => s.firma));
    } catch (e) {
      setErrore(`Download non riuscito: ${e instanceof Error ? e.message : 'errore imprevisto'}.`);
    } finally {
      setEsporto('');
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Soci</h1>
      </header>
      <main className="contenuto">
        {errore && <p className="avviso errore">{errore}</p>}
        <div className="riepilogo">
          <div><strong>{attivi.length}</strong><span>soci attivi</span></div>
          <div><strong>{pagati}</strong><span>quote {anno} pagate</span></div>
          <div><strong>{inAttesa.length}</strong><span>da approvare</span></div>
        </div>
        <div className="riga-azioni">
          <Link to="/admin/soci/nuovo" className="bottone piccolo">+ Inserisci un socio</Link>
          <button type="button" className="bottone contorno piccolo" onClick={() => esporta('excel')} disabled={!tutti.length || !!esporto}>
            {esporto === 'excel' ? 'Preparo…' : 'Scarica Excel'}
          </button>
          <button type="button" className="bottone contorno piccolo" onClick={() => esporta('pdf')} disabled={!visibili.length || !!esporto}>
            {esporto === 'pdf' ? 'Preparo…' : 'PDF firmati'}
          </button>
        </div>
        <p className="nota">L'Excel contiene tutti i soci, più due fogli pronti: chi vuole il gruppo WhatsApp e chi la mailing list. Il PDF raccoglie i moduli firmati dei soci mostrati qui sotto.</p>

        <IscrizioneOnline />

        <div className="filtri-chiari" role="group" aria-label="Filtra i soci">
          {([['attivo', `Attivi (${attivi.length})`], ['in_attesa', `Da approvare (${inAttesa.length})`], ['tutti', 'Tutti']] as [Filtro, string][]).map(([f, t]) => (
            <button key={f} type="button" className={filtro === f ? 'filtro attivo' : 'filtro'} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{t}</button>
          ))}
        </div>
        <label className="visivamente-nascosto" htmlFor="cerca-socio">Cerca</label>
        <input id="cerca-socio" type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome, codice fiscale, email o tessera" />

        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista !== null && visibili.length === 0 && (
          <p className="vuoto">{filtro === 'in_attesa' ? 'Nessuna richiesta da approvare.' : 'Nessun socio trovato.'}</p>
        )}
        <ul className="lista-iscritti">
          {visibili.map((s) => {
            const t = s.tessere?.[anno];
            return (
              <li key={s.id}>
                <Link to={`/admin/soci/${s.id}`} className="iscritto iscritto-link">
                  <div className="iscritto-testa">
                    <div>
                      <div className="iscritto-nome">{s.cognome} {s.nome}</div>
                      <div className="iscritto-sotto mono">{s.codiceFiscale}</div>
                    </div>
                    <div className="etichette">
                      {s.stato !== 'attivo' && <span className={s.stato === 'in_attesa' ? 'etichetta etichetta-caldo' : 'etichetta etichetta-spento'}>{ETICHETTE_STATO[s.stato]}</span>}
                      {s.stato === 'attivo' && (
                        <span className={t?.quotaPagata ? 'etichetta etichetta-ok' : 'etichetta etichetta-spento'}>
                          {t?.numero ? `n. ${t.numero}` : 'Senza tessera'}{t?.quotaPagata ? ', pagata' : ''}
                        </span>
                      )}
                      {doppi.has(s.codiceFiscale) && <span className="etichetta etichetta-giallo">Doppione?</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
