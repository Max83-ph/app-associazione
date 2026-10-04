import { Intestazione } from '../components/Layout';
import { CONTATTI, NOME_ASSOCIAZIONE } from '../config';

export function ChiSiamo() {
  return (
    <>
      <Intestazione titolo="Chi siamo" />
      <main className="contenuto testo-lungo">
        <p>
          <strong>{NOME_ASSOCIAZIONE}</strong> è un'associazione di volontari che organizza feste, pranzi, laboratori per
          bambini e la sfilata di Carnevale.
        </p>
        <p>[Qui la storia dell'associazione, chi la porta avanti e come partecipare. Testo da scrivere insieme al direttivo.]</p>
        <p className="nota">Nella versione completa questa pagina si modifica dal pannello organizzatori, con testo e foto.</p>
      </main>
    </>
  );
}

export function Contatti() {
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
    <>
      <Intestazione titolo="Contatti" />
      <main className="contenuto">
        <ul className="lista-contatti">
          {voci.map((v) => (
            <li key={v.nome}>
              <span className="contatto-nome">{v.nome}</span>
              {v.href ? <a href={v.href} target={v.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{v.valore}</a> : <span>{v.valore}</span>}
            </li>
          ))}
        </ul>
      </main>
    </>
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
