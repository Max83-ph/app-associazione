import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ascoltaTuttiGliEventi } from '../../lib/dati';
import { dataBreve, etichettaTipo } from '../../lib/format';
import { qrLinkDataUrl } from '../../lib/biglietto';
import { Icona } from '../../components/Icona';
import type { Evento } from '../../types';

export function AdminEventi() {
  const [eventi, setEventi] = useState<Evento[] | null>(null);
  const [errore, setErrore] = useState('');
  const [mostraPassati, setMostraPassati] = useState(false);

  useEffect(() => ascoltaTuttiGliEventi(setEventi, (e) => setErrore(e.message)), []);

  const soglia = Date.now() - 24 * 3600 * 1000;
  const lista = (eventi ?? []).filter((e) => mostraPassati || e.data.toMillis() > soglia);

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Eventi</h1>
        <Link to="/admin/eventi/nuovo" className="bottone piccolo intestazione-azione">+ Nuovo evento</Link>
      </header>
      <main className="contenuto">
        {errore && <p className="avviso errore">{errore}</p>}
        {eventi === null && !errore && <p className="vuoto">Caricamento…</p>}
        {eventi !== null && lista.length === 0 && <p className="vuoto">Nessun evento. Crea il primo con “Nuovo evento”.</p>}
        <div className="lista-admin">
          {lista.map((ev) => (
            <div key={ev.id} className="riga-admin">
              <div className="riga-admin-icona" style={{ background: ev.colore }}><Icona nome={ev.icona} size={22} /></div>
              <div className="riga-admin-testo">
                <div className="riga-admin-titolo">{ev.titolo}</div>
                <div className="riga-admin-sotto">
                  {dataBreve(ev.data)}</div>
                <div className="riga-admin-sotto">{etichettaTipo[ev.tipo]}, <span className={`stato stato-${ev.stato}`}>{{ bozza: 'bozza', aperto: 'iscrizioni aperte', chiuso: 'iscrizioni chiuse' }[ev.stato]}</span>
                </div>
              </div>
              <div className="riga-admin-azioni">
                <Link to={`/admin/eventi/${ev.id}/iscritti`} className="mini">Iscritti</Link>
                <Link to={`/admin/eventi/${ev.id}`} className="mini">Modifica</Link>
              </div>
            </div>
          ))}
        </div>
        <label className="spunta"><input type="checkbox" checked={mostraPassati} onChange={(e) => setMostraPassati(e.target.checked)} /> Mostra anche gli eventi passati</label>
        <QrHome />
      </main>
    </>
  );
}

function QrHome() {
  const [qr, setQr] = useState('');
  const url = window.location.origin + '/';
  useEffect(() => {
    qrLinkDataUrl(url).then(setQr);
  }, [url]);
  return (
    <section className="pannello qr-home">
      <h2>QR della Home</h2>
      <p className="nota">Da stampare su volantini e in sede: apre l'elenco degli eventi. Punta a <code>{url}</code>.</p>
      {qr && <img src={qr} width={160} height={160} alt="QR della Home" />}
      {qr && <a className="bottone contorno" href={qr} download="qr-home.png">Scarica PNG</a>}
    </section>
  );
}
