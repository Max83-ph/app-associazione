import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { annullaIngresso, ascoltaEvento, ascoltaPrenotazioniEvento, eliminaIscrittoManuale, registraIngresso, segnaPagamento } from '../../lib/dati';
import { AggiungiIscritto } from './AggiungiIscritto';
import { dataBreve } from '../../lib/format';
import { codiceLeggibile } from '../../lib/codice';
import { descriviModalita, qrLinkDataUrl, scaricaPdfFirmato } from '../../lib/biglietto';
import { Icona } from '../../components/Icona';
import { daPagare, euro, righeOrdine, riepilogoCucina } from '../../lib/menu';
import type { Evento, Prenotazione } from '../../types';

export function Iscritti() {
  const { id = '' } = useParams();
  const [ev, setEv] = useState<Evento | null>(null);
  const [lista, setLista] = useState<Prenotazione[] | null>(null);
  const [errore, setErrore] = useState('');
  const [mostraAnnullati, setMostraAnnullati] = useState(false);
  const [qr, setQr] = useState('');
  const [aggiungi, setAggiungi] = useState(false);
  const [msg, setMsg] = useState('');
  const [cerca, setCerca] = useState('');

  useEffect(() => ascoltaEvento(id, setEv, (e) => setErrore(e.message)), [id]);
  useEffect(() => ascoltaPrenotazioniEvento(id, setLista, (e) => setErrore(e.message)), [id]);
  useEffect(() => {
    qrLinkDataUrl(`${window.location.origin}/evento/${id}`).then(setQr);
  }, [id]);

  const attive = useMemo(() => (lista ?? []).filter((p) => p.statoBiglietto !== 'annullato'), [lista]);
  const filtro = cerca.trim().toLowerCase();
  const visibili = (mostraAnnullati ? lista ?? [] : attive).filter((p) => !filtro || `${p.cognome} ${p.nome} ${p.partecipanti.map((b) => b.nome).join(' ')}`.toLowerCase().includes(filtro));
  const daCompletare = attive.filter((p) => p.daCompletare).length;
  const tot = (m: (p: Prenotazione) => boolean) => attive.filter(m).reduce((s, p) => s + p.quantita, 0);
  const cucina = useMemo(() => riepilogoCucina(attive), [attive]);
  const conOrdine = attive.filter((p) => p.ordine?.length);
  const incassoPrevisto = conOrdine.reduce((s, p) => s + (p.totale ?? 0), 0);
  const importi = attive.map((p) => ({ p, d: daPagare(p, ev) })).filter((x) => x.d && !x.p.ordine?.length);
  const quotePreviste = importi.reduce((s, x) => s + x.d!.importo, 0);
  const quoteIncassate = importi.filter((x) => x.p.pagamento.stato !== 'da_pagare').reduce((s, x) => s + x.d!.importo, 0);
  const incassato = conOrdine.filter((p) => p.pagamento.stato !== 'da_pagare').reduce((s, p) => s + (p.totale ?? 0), 0);

  const esportaCsv = () => {
    const righe = [
      ['Codice', 'Cognome', 'Nome', 'Email', 'Telefono', 'Note', 'Modalità', 'Quantità', 'Ordine', 'Totale €', 'Bambini', 'Liberatoria foto', 'Pagamento', 'Stato'],
      ...(lista ?? []).map((p) => [
        codiceLeggibile(p.id), p.cognome, p.nome, p.email, p.telefono ?? '', p.note ?? '', p.modalita, String(p.quantita),
        p.ordine?.length ? righeOrdine(p.ordine).join('; ') : '', p.ordine?.length ? ((p.totale ?? 0) / 100).toFixed(2).replace('.', ',') : '',
        p.partecipanti.map((b) => `${b.nome} ${b.cognome} (${b.eta})`).join('; '),
        p.consensi.liberatoriaFoto === null ? '' : p.consensi.liberatoriaFoto ? 'sì' : 'no',
        p.pagamento.stato, p.statoBiglietto,
      ]),
    ];
    const csv = '﻿' + righe.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `iscritti-${ev?.titolo.replace(/\W+/g, '-').toLowerCase() ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin/eventi" className="indietro-chiaro" aria-label="Torna agli eventi"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <div>
          <h1>Iscritti</h1>
          {ev && <div className="sottotitolo">{ev.titolo}, {dataBreve(ev.data)}</div>}
        </div>
      </header>
      <main className="contenuto">
        {errore && <p className="avviso errore">{errore}</p>}
        {ev && (
          <div className="riepilogo">
            <div><strong>{tot((p) => p.modalita !== 'asporto')}</strong><span>/{ev.postiMax} posti</span></div>
            {ev.tipo === 'pasto' && <div><strong>{tot((p) => p.modalita === 'asporto')}</strong><span>asporto</span></div>}
            <div><strong>{tot((p) => p.statoBiglietto === 'usato')}</strong><span>entrati</span></div>
            <div><strong>{attive.filter((p) => p.pagamento.stato === 'da_pagare').length}</strong><span>da pagare</span></div>
          </div>
        )}
        {cucina.length > 0 && (
          <details className="riepilogo-cucina" open>
            <summary>Asporto: riepilogo per la cucina</summary>
            <table>
              <thead><tr><th>Piatto</th><th>Porzioni</th><th>Importo</th></tr></thead>
              <tbody>{cucina.map((c) => <tr key={c.nome}><td>{c.nome}</td><td>{c.quantita}</td><td>{euro(c.incasso)}</td></tr>)}</tbody>
              <tfoot><tr><td>Totale ({conOrdine.length} ordini)</td><td /><td>{euro(incassoPrevisto)}</td></tr></tfoot>
            </table>
            <p className="nota">Già incassati {euro(incassato)}, da incassare {euro(incassoPrevisto - incassato)}. Gli ordini annullati non sono contati.</p>
          </details>
        )}
        {importi.length > 0 && (
          <p className="nota">Quote all'ingresso: previste {euro(quotePreviste)}, già incassate {euro(quoteIncassate)}, da incassare {euro(quotePreviste - quoteIncassate)}.</p>
        )}
        {msg && <p className="avviso">{msg}</p>}
        {ev && (aggiungi ? (
          <AggiungiIscritto ev={ev} onChiudi={(m) => { setAggiungi(false); if (m) setMsg(m); }} />
        ) : (
          <button type="button" className="bottone" onClick={() => { setMsg(''); setAggiungi(true); }}>+ Aggiungi iscritto</button>
        ))}
        {daCompletare > 0 && <p className="nota">{daCompletare} {daCompletare === 1 ? 'iscrizione' : 'iscrizioni'} da completare all'ingresso (firme e dati): in Ingresso cerca il nome.</p>}
        <div className="riga-azioni">
          <button type="button" className="bottone contorno piccolo" onClick={esportaCsv} disabled={!lista?.length}>Esporta CSV</button>
          {qr && <a className="bottone contorno piccolo" href={qr} download={`qr-evento-${id}.png`}>QR per la locandina</a>}
        </div>

        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">Ancora nessuna prenotazione.</p>}
        {(lista?.length ?? 0) > 8 && <input className="cerca-iscritti" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per cognome o nome" aria-label="Cerca iscritto" />}
        <ul className="lista-iscritti">
          {visibili.map((p) => (
            <li key={p.id} className={p.statoBiglietto === 'annullato' ? 'iscritto spento' : 'iscritto'}>
              <div className="iscritto-testa">
                <div>
                  <div className="iscritto-nome">{p.cognome} {p.nome}</div>
                  <div className="iscritto-sotto">{descriviModalita(p)}, codice {codiceLeggibile(p.id)}</div>
                  {(p.telefono || p.note) && <div className="iscritto-sotto">{[p.telefono, p.note].filter(Boolean).join(' · ')}</div>}
                  {!!p.ordine?.length && <div className="iscritto-sotto">{righeOrdine(p.ordine).join(', ')}</div>}
                  {p.partecipanti.length > 0 && <div className="iscritto-sotto">{p.partecipanti.map((b) => `${b.nome} (${b.eta})`).join(', ')}</div>}
                </div>
                <div className="etichette">
                  {p.statoBiglietto === 'annullato' && <span className="etichetta etichetta-spento">Annullato</span>}
                  {p.manuale && <span className="etichetta etichetta-neutro">Inserito a mano</span>}
                  {p.daCompletare && <span className="etichetta etichetta-caldo">Da completare</span>}
                  {p.statoBiglietto === 'usato' && <span className="etichetta etichetta-ok">Entrato</span>}
                  {p.consensi.liberatoriaFoto === false && <span className="etichetta etichetta-giallo">Niente foto</span>}
                </div>
              </div>
              {p.statoBiglietto !== 'annullato' && (
                <div className="iscritto-azioni">
                  <label className="spunta"><input type="checkbox" checked={p.pagamento.stato !== 'da_pagare'} onChange={(e) => segnaPagamento(p.id, e.target.checked, daPagare(p, ev)?.importo)} /> Pagato{daPagare(p, ev) ? ` ${euro(daPagare(p, ev)!.importo)}` : ''}</label>
                  <label className="spunta"><input type="checkbox" checked={p.statoBiglietto === 'usato'} onChange={(e) => (e.target.checked ? registraIngresso(p.id) : annullaIngresso(p.id))} /> Entrato</label>
                  {p.firma && <button type="button" className="link-bottone" onClick={() => scaricaPdfFirmato(p)}>PDF firmato</button>}
                  {p.manuale && <Link className="link-bottone" to={`/biglietto/${p.id}`}>Biglietto</Link>}
                  {p.manuale && (
                    <button type="button" className="link-bottone" onClick={() => { if (confirm(`Togliere ${p.cognome} ${p.nome}? I posti tornano liberi.`)) eliminaIscrittoManuale(p.id).catch((e) => setErrore(e.message)); }}>Togli</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {(lista ?? []).some((p) => p.statoBiglietto === 'annullato') && (
          <label className="spunta"><input type="checkbox" checked={mostraAnnullati} onChange={(e) => setMostraAnnullati(e.target.checked)} /> Mostra anche gli annullati</label>
        )}
      </main>
    </>
  );
}
