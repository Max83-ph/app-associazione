import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { annullaIngresso, ascoltaEvento, ascoltaPrenotazioniEvento, registraIngresso, segnaPagamento } from '../../lib/dati';
import { dataBreve } from '../../lib/format';
import { codiceLeggibile } from '../../lib/codice';
import { descriviModalita, qrLinkDataUrl, scaricaPdfFirmato } from '../../lib/biglietto';
import { Icona } from '../../components/Icona';
import type { Evento, Prenotazione } from '../../types';

export function Iscritti() {
  const { id = '' } = useParams();
  const [ev, setEv] = useState<Evento | null>(null);
  const [lista, setLista] = useState<Prenotazione[] | null>(null);
  const [errore, setErrore] = useState('');
  const [mostraAnnullati, setMostraAnnullati] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => ascoltaEvento(id, setEv, (e) => setErrore(e.message)), [id]);
  useEffect(() => ascoltaPrenotazioniEvento(id, setLista, (e) => setErrore(e.message)), [id]);
  useEffect(() => {
    qrLinkDataUrl(`${window.location.origin}/evento/${id}`).then(setQr);
  }, [id]);

  const attive = useMemo(() => (lista ?? []).filter((p) => p.statoBiglietto !== 'annullato'), [lista]);
  const visibili = mostraAnnullati ? lista ?? [] : attive;
  const tot = (m: (p: Prenotazione) => boolean) => attive.filter(m).reduce((s, p) => s + p.quantita, 0);

  const esportaCsv = () => {
    const righe = [
      ['Codice', 'Cognome', 'Nome', 'Email', 'Modalità', 'Quantità', 'Bambini', 'Liberatoria foto', 'Pagamento', 'Stato'],
      ...(lista ?? []).map((p) => [
        codiceLeggibile(p.id), p.cognome, p.nome, p.email, p.modalita, String(p.quantita),
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
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
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
        <div className="riga-azioni">
          <button type="button" className="bottone contorno piccolo" onClick={esportaCsv} disabled={!lista?.length}>Esporta CSV</button>
          {qr && <a className="bottone contorno piccolo" href={qr} download={`qr-evento-${id}.png`}>QR per la locandina</a>}
        </div>

        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        {lista?.length === 0 && <p className="vuoto">Ancora nessuna prenotazione.</p>}
        <ul className="lista-iscritti">
          {visibili.map((p) => (
            <li key={p.id} className={p.statoBiglietto === 'annullato' ? 'iscritto spento' : 'iscritto'}>
              <div className="iscritto-testa">
                <div>
                  <div className="iscritto-nome">{p.cognome} {p.nome}</div>
                  <div className="iscritto-sotto">{descriviModalita(p)}, codice {codiceLeggibile(p.id)}</div>
                  {p.partecipanti.length > 0 && <div className="iscritto-sotto">{p.partecipanti.map((b) => `${b.nome} (${b.eta})`).join(', ')}</div>}
                </div>
                <div className="etichette">
                  {p.statoBiglietto === 'annullato' && <span className="etichetta etichetta-spento">Annullato</span>}
                  {p.statoBiglietto === 'usato' && <span className="etichetta etichetta-ok">Entrato</span>}
                  {p.consensi.liberatoriaFoto === false && <span className="etichetta etichetta-giallo">Niente foto</span>}
                </div>
              </div>
              {p.statoBiglietto !== 'annullato' && (
                <div className="iscritto-azioni">
                  <label className="spunta"><input type="checkbox" checked={p.pagamento.stato !== 'da_pagare'} onChange={(e) => segnaPagamento(p.id, e.target.checked)} /> Pagato</label>
                  <label className="spunta"><input type="checkbox" checked={p.statoBiglietto === 'usato'} onChange={(e) => (e.target.checked ? registraIngresso(p.id) : annullaIngresso(p.id))} /> Entrato</label>
                  {p.firma && <button type="button" className="link-bottone" onClick={() => scaricaPdfFirmato(p)}>PDF firmato</button>}
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
