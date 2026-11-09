import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ascoltaImpostazioniCarnevale } from '../lib/carnevale';
import { euro } from '../lib/menu';
import type { ImpostazioniCarnevale } from '../types';
import { Intestazione } from '../components/Layout';
import { useTesti } from '../lib/testi';
import { Testo } from '../components/TestoRicco';
import { ContenutoPagina, ElencoPagine, usePagina, usePagineLibere } from './Pagine';
import { InserisciCodice } from './Comunicazioni';

export function Info() {
  const { chiSiamo } = useTesti();
  const info = usePagina('info');
  const altre = usePagineLibere('pubblica');
  return (
    <>
      <Intestazione titolo="Chi siamo" />
      <main className="contenuto testo-lungo">
        {info ? <ContenutoPagina p={info} /> : info === null && <Testo testo={chiSiamo} />}
        <h2 className="titolo-sezione">Contatti</h2>
        <Contatti />
        <ElencoPagine lista={altre} titolo="Altre pagine" />
        <InserisciCodice />
      </main>
    </>
  );
}

function Contatti() {
  const CONTATTI = useTesti().contatti;
  const voci = [
    { nome: 'Email', valore: CONTATTI.email, href: CONTATTI.email.includes('@') ? `mailto:${CONTATTI.email}` : '' },
    { nome: 'Telefono', valore: CONTATTI.telefono, href: /\d/.test(CONTATTI.telefono) ? `tel:${CONTATTI.telefono.replace(/\s/g, '')}` : '' },
    { nome: 'WhatsApp', valore: CONTATTI.whatsapp ? 'Scrivici su WhatsApp' : '', href: CONTATTI.whatsapp },
    { nome: 'Instagram', valore: CONTATTI.instagram, href: CONTATTI.instagram },
    { nome: 'Facebook', valore: CONTATTI.facebook, href: CONTATTI.facebook },
    {
      nome: 'Sede',
      valore: CONTATTI.indirizzo,
      href: CONTATTI.indirizzo.startsWith('[') ? '' : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTATTI.indirizzo)}`,
    },
  ].filter((v) => v.valore);

  return (
        <ul className="lista-contatti">
          {voci.map((v) => (
            <li key={v.nome}>
              <span className="contatto-nome">{v.nome}</span>
              {v.href ? <a href={v.href} target={v.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{v.valore}</a> : <span>{v.valore}</span>}
            </li>
          ))}
        </ul>
  );
}

export function Carnevale() {
  const p = usePagina('carnevale');
  const [imp, setImp] = useState<ImpostazioniCarnevale | null>(null);
  useEffect(() => ascoltaImpostazioniCarnevale(setImp), []);
  return (
    <>
      <Intestazione titolo="Carnevale" />
      <main className="contenuto testo-lungo">
        {imp?.aperte && (
          <section className="sfila-box">
            <span className="sfila-sopra">Sfilate di Carnevale</span>
            <h2>Sfila con noi</h2>
            {imp.sfilate && <p>{imp.sfilate}</p>}
            <p className="sfila-quota">
              Quota costume {euro(imp.quotaAdulto)} adulti, {euro(imp.quotaBambino)} bambini (fino a {imp.etaBambino - 1} anni).
              {imp.anticipo > 0 && ` Anticipo ${euro(imp.anticipo)} a persona alla prova, saldo alla consegna; puoi anche pagare tutto subito.`}
            </p>
            <Link to="/carnevale/iscriviti" className="bottone">Sfila con noi</Link>
            <span className="nota">Iscrivi te e la tua famiglia, firma dal telefono e scegli quando venire a provare il costume.</span>
          </section>
        )}
        {p === undefined && <p className="vuoto">Caricamento…</p>}
        {p && <ContenutoPagina p={p} />}
        {p === null && !imp?.aperte && <div className="pannello">
          <h2>In arrivo</h2>
          <p>
            Qui le famiglie potranno iscrivere i figuranti alla sfilata, firmare i documenti e prenotare la prova abito,
            tutto dal telefono.
          </p>
        </div>}
      </main>
    </>
  );
}

export function Privacy() {
  const { privacySito } = useTesti();
  return (
    <>
      <Intestazione titolo="Privacy e cookie" />
      <main className="contenuto testo-lungo">
        <Testo testo={privacySito} />
        <p className="nota">Le informative complete per chi prenota un evento e per i soci sono mostrate nei rispettivi moduli di iscrizione.</p>
      </main>
    </>
  );
}
