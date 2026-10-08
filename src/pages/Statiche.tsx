import { Intestazione } from '../components/Layout';
import { useTesti } from '../lib/testi';

export function Info() {
  const { chiSiamo } = useTesti();
  return (
    <>
      <Intestazione titolo="Chi siamo" />
      <main className="contenuto testo-lungo">
        <p className="testo-a-capo">{chiSiamo}</p>
        <h2 className="titolo-sezione">Contatti</h2>
        <Contatti />
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
  return (
    <>
      <Intestazione titolo="Carnevale" />
      <main className="contenuto testo-lungo">
        <div className="pannello">
          <h2>In arrivo</h2>
          <p>
            Qui le famiglie potranno iscrivere i figuranti alla sfilata, firmare i documenti e prenotare la prova abito,
            tutto dal telefono.
          </p>
        </div>
      </main>
    </>
  );
}
