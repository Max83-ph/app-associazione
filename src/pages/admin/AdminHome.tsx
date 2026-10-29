import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../lib/auth';
import { ascoltaTuttiGliEventi } from '../../lib/dati';
import { ascoltaSoci } from '../../lib/soci';
import { contaDaPulire, MESI_CONSERVAZIONE } from '../../lib/pulizia';
import { dataBreve } from '../../lib/format';
import { NOME_ASSOCIAZIONE } from '../../config';
import { Icona, type NomeIcona } from '../../components/Icona';
import type { Evento, Socio } from '../../types';

interface Voce {
  a: string;
  icona: NomeIcona;
  titolo: string;
  sotto: string;
  badge?: string;
}

/** Pagina iniziale della Gestione: le funzioni divise per argomento. */
export function AdminHome() {
  const { utente } = useAuth();
  const [eventi, setEventi] = useState<Evento[] | null>(null);
  const [soci, setSoci] = useState<Socio[] | null>(null);
  useEffect(() => ascoltaTuttiGliEventi(setEventi, () => setEventi([])), []);
  useEffect(() => ascoltaSoci(setSoci, () => setSoci([])), []);
  // Controllo automatico: prenotazioni oltre il periodo di conservazione, da far approvare.
  const [daPulire, setDaPulire] = useState(0);
  const numEventi = eventi?.length ?? 0;
  useEffect(() => {
    if (!eventi?.length) return;
    let vivo = true;
    contaDaPulire(eventi).then((n) => vivo && setDaPulire(n)).catch(() => undefined);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numEventi]);

  // eslint-disable-next-line react-hooks/purity
  const adesso = Date.now();
  const prossimi = (eventi ?? []).filter((e) => e.data.toMillis() > adesso - 6 * 3600 * 1000).sort((a, b) => a.data.toMillis() - b.data.toMillis());
  const prossimo = prossimi[0];
  const daApprovare = (soci ?? []).filter((s) => s.stato === 'in_attesa').length;
  const attivi = (soci ?? []).filter((s) => s.stato === 'attivo').length;

  const gruppi: { titolo: string; voci: Voce[] }[] = [
    {
      titolo: 'Eventi',
      voci: [
        { a: '/admin/eventi', icona: 'calendario', titolo: 'Eventi e iscritti', sotto: eventi ? `${prossimi.length} in programma` : 'Elenco, modifica, iscritti' },
        { a: '/admin/eventi/nuovo', icona: 'aggiungi', titolo: 'Nuovo evento', sotto: 'Pranzo, laboratorio, festa' },
        { a: '/staff', icona: 'scansiona', titolo: 'Ingresso', sotto: 'Scansiona i biglietti' },
      ],
    },
    {
      titolo: 'Soci',
      voci: [
        { a: '/admin/soci', icona: 'utenti', titolo: 'Soci', sotto: soci ? `${attivi} attivi` : 'Elenco, tessere, iscrizioni', badge: daApprovare ? `${daApprovare} da approvare` : undefined },
        { a: '/admin/soci/nuovo', icona: 'socioAggiungi', titolo: 'Nuovo socio', sotto: 'Inserisci a mano' },
        { a: '/admin/soci/importa', icona: 'carica', titolo: 'Importa da Excel', sotto: 'Tanti soci in una volta' },
      ],
    },
    {
      titolo: 'Comunicazioni',
      voci: [
        { a: '/admin/bacheca', icona: 'megafono', titolo: 'Bacheca soci', sotto: 'Avvisi per i soci attivi' },
        { a: '/admin/comunicazioni', icona: 'link', titolo: 'Comunicazioni con link', sotto: 'Avvisi per chi ha il link' },
        { a: '/admin/documenti', icona: 'firma', titolo: 'Documenti da firmare', sotto: 'Firma in app dei soci' },
      ],
    },
    {
      titolo: 'Sito e contenuti',
      voci: [
        { a: '/admin/pagine', icona: 'pagina', titolo: 'Pagine', sotto: 'Home, Carnevale, Chi siamo…' },
        { a: '/admin/archivio', icona: 'cartella', titolo: 'Archivio soci', sotto: 'Statuto, verbali, moduli' },
        { a: '/admin/testi', icona: 'testo', titolo: 'Informative e contatti', sotto: 'Privacy, liberatorie, contatti' },
      ],
    },
    {
      titolo: 'Impostazioni',
      voci: [
        { a: '/admin/utenti', icona: 'modifica', titolo: 'Staff e organizzatori', sotto: 'Chi può gestire l\'app' },
        { a: '/admin/privacy', icona: 'lucchetto', titolo: 'Privacy e pulizia dati', sotto: 'Cancella le vecchie prenotazioni' },
      ],
    },
  ];

  return (
    <>
      <header className="intestazione">
        <div className="intestazione-riga">
          <span className="marchio"><span className="nastro" aria-hidden="true" />{NOME_ASSOCIAZIONE}</span>
          <button type="button" className="link-accesso" onClick={() => signOut(auth)}>Esci</button>
        </div>
        <h1>Gestione</h1>
        {utente?.email && <p className="nota">Accesso come {utente.email}</p>}
      </header>
      <main className="contenuto">
        {(prossimo || daApprovare > 0 || daPulire > 0) && (
          <div className="cruscotto">
            {prossimo && (
              <Link to={`/admin/eventi/${prossimo.id}/iscritti`} className="cruscotto-voce">
                <span className="cruscotto-etichetta">Prossimo evento</span>
                <strong>{prossimo.titolo}</strong>
                <span>{dataBreve(prossimo.data)} · {prossimo.postiOccupati}/{prossimo.postiMax} posti</span>
              </Link>
            )}
            {daApprovare > 0 && (
              <Link to="/admin/soci" className="cruscotto-voce attenzione">
                <span className="cruscotto-etichetta">Da fare</span>
                <strong>{daApprovare} {daApprovare === 1 ? 'richiesta' : 'richieste'} di iscrizione</strong>
                <span>Da approvare o respingere</span>
              </Link>
            )}
            {daPulire > 0 && (
              <Link to="/admin/privacy" className="cruscotto-voce attenzione">
                <span className="cruscotto-etichetta">Privacy</span>
                <strong>Pulizia dati da approvare</strong>
                <span>{daPulire} prenotazioni di eventi conclusi da oltre {MESI_CONSERVAZIONE} mesi</span>
              </Link>
            )}
          </div>
        )}
        {gruppi.map((g) => (
          <section key={g.titolo} className="gruppo-gestione">
            <h2 className="titolo-sezione">{g.titolo}</h2>
            <div className="griglia-gestione">
              {g.voci.map((v) => (
                <Link key={v.a} to={v.a} className="voce-gestione">
                  <span className="voce-icona"><Icona nome={v.icona} size={22} /></span>
                  <span className="voce-testo">
                    <span className="voce-titolo">{v.titolo}</span>
                    <span className="voce-sotto">{v.sotto}</span>
                    {v.badge && <span className="etichetta etichetta-caldo voce-badge">{v.badge}</span>}
                  </span>
                  <span className="voce-freccia"><Icona nome="freccia" size={18} /></span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
