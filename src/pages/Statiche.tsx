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
  return (
    <>
      <Intestazione titolo="Carnevale" />
      <main className="contenuto testo-lungo">
        {p === undefined && <p className="vuoto">Caricamento…</p>}
        {p && <ContenutoPagina p={p} />}
        {p === null && <div className="pannello">
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
