import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  aggiornaSocioAdmin,
  annoCorrente,
  ascoltaSoci,
  ascoltaSocio,
  creaSocioAdmin,
  eliminaSocio,
  impostaNote,
  impostaStato,
  impostaTessera,
  prossimoNumero,
} from '../../lib/soci';
import { pdfSocio } from '../../lib/esportaSoci';
import { Icona } from '../../components/Icona';
import { ModuloSocio, SOCIO_VUOTO } from '../../components/ModuloSocio';
import { Riepilogo } from '../soci/AreaSoci';
import { ETICHETTE_STATO } from './Soci';
import type { DatiSocio, Socio } from '../../types';

function Testata({ titolo, indietro }: { titolo: string; indietro: string }) {
  return (
    <header className="intestazione compatta">
      <Link to={indietro} className="indietro-chiaro" aria-label="Indietro"><Icona nome="indietro" size={22} spessore={2} /></Link>
      <h1>{titolo}</h1>
    </header>
  );
}

export function NuovoSocio() {
  const navigate = useNavigate();
  return (
    <>
      <Testata titolo="Inserisci un socio" indietro="/admin/soci" />
      <main className="contenuto">
        <p className="nota">Per chi non usa l'app: compila i dati insieme alla persona, poi passale il telefono per la firma. Il socio risulta subito attivo.</p>
        <ModuloSocio
          chi="admin"
          iniziale={SOCIO_VUOTO}
          etichettaInvio="Firma e salva il socio"
          onInvia={async (dati, firma) => {
            const id = await creaSocioAdmin(dati, firma!);
            navigate(`/admin/soci/${id}`, { replace: true });
          }}
        />
      </main>
    </>
  );
}

export function SocioDettaglio() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const anno = annoCorrente();
  const [s, setS] = useState<Socio | null | undefined>(undefined);
  const [tutti, setTutti] = useState<Socio[]>([]);
  const [modifica, setModifica] = useState(false);
  const [numero, setNumero] = useState('');
  const [pagata, setPagata] = useState(false);
  const [note, setNote] = useState('');
  const [salvataTessera, setSalvataTessera] = useState('');
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => ascoltaSocio(id, (x) => {
    setS(x);
    if (x) {
      setNumero(x.tessere?.[anno]?.numero ?? '');
      setPagata(!!x.tessere?.[anno]?.quotaPagata);
      setNote(x.note ?? '');
    }
  }, () => setS(null)), [id, anno]);
  useEffect(() => ascoltaSoci(setTutti, () => undefined), []);

  if (s === undefined) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  if (s === null) return <><Testata titolo="Socio" indietro="/admin/soci" /><main className="contenuto"><p className="vuoto">Socio non trovato.</p></main></>;

  if (modifica) {
    const iniziale: DatiSocio = {
      nome: s.nome, cognome: s.cognome, dataNascita: s.dataNascita, luogoNascita: s.luogoNascita,
      codiceFiscale: s.codiceFiscale, residenza: s.residenza, email: s.email, cellulare: s.cellulare, consensi: s.consensi,
    };
    return (
      <>
        <Testata titolo="Modifica socio" indietro={`/admin/soci/${s.id}`} />
        <main className="contenuto">
          <ModuloSocio
            chi="admin"
            iniziale={iniziale}
            firmaEsistente={s.firma}
            etichettaInvio="Salva le modifiche"
            onInvia={async (dati, firma) => {
              await aggiornaSocioAdmin(s.id, dati, firma);
              setModifica(false);
            }}
          />
          <button type="button" className="bottone contorno" onClick={() => setModifica(false)}>Annulla</button>
        </main>
      </>
    );
  }

  const azione = async (fn: () => Promise<void>) => {
    setErrore('');
    try {
      await fn();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Operazione non riuscita.');
    }
  };

  const salvaTessera = () =>
    azione(async () => {
      await impostaTessera(s.id, anno, { numero, quotaPagata: pagata }, !!s.tessere?.[anno]?.quotaPagata);
      setSalvataTessera('Salvato');
      setTimeout(() => setSalvataTessera(''), 2000);
    });

  const t = s.tessere?.[anno];
  const anniPrecedenti = Object.entries(s.tessere ?? {}).filter(([a]) => a !== anno).sort(([a], [b]) => b.localeCompare(a));

  return (
    <>
      <Testata titolo={`${s.nome} ${s.cognome}`} indietro="/admin/soci" />
      <main className="contenuto">
        <div className="riga-stato">
          <span className={s.stato === 'attivo' ? 'etichetta etichetta-ok' : s.stato === 'in_attesa' ? 'etichetta etichetta-caldo' : 'etichetta etichetta-spento'}>{ETICHETTE_STATO[s.stato]}</span>
          <span className="nota">{s.creatoDa === 'admin' ? 'Inserito da un organizzatore' : 'Iscritto dall\'app'}{s.createdAt ? `, il ${s.createdAt.toDate().toLocaleDateString('it-IT')}` : ''}</span>
        </div>
        {errore && <p className="avviso errore">{errore}</p>}

        {s.stato === 'in_attesa' && (
          <div className="pannello">
            <h2>Richiesta da approvare</h2>
            <p>Controlla i dati qui sotto, poi conferma.</p>
            <div className="griglia-2">
              <button type="button" className="bottone contorno" onClick={() => azione(() => impostaStato(s.id, 'respinto'))}>Respingi</button>
              <button type="button" className="bottone" onClick={() => azione(async () => {
                await impostaStato(s.id, 'attivo');
                if (!t?.numero) setNumero(prossimoNumero(tutti, anno));
              })}>Approva</button>
            </div>
          </div>
        )}

        {s.stato === 'attivo' && (
          <div className="pannello">
            <h2>Tessera {anno}</h2>
            <div className="riga-tessera">
              <label>Numero
                <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" placeholder={prossimoNumero(tutti, anno)} />
              </label>
              {!numero && <button type="button" className="link-bottone" onClick={() => setNumero(prossimoNumero(tutti, anno))}>Usa il prossimo ({prossimoNumero(tutti, anno)})</button>}
            </div>
            <label className="spunta"><input type="checkbox" checked={pagata} onChange={(e) => setPagata(e.target.checked)} /> Quota {anno} pagata</label>
            {t?.quotaPagata && t.pagataIl && <p className="nota">Registrata il {t.pagataIl.toDate().toLocaleDateString('it-IT')}.</p>}
            <button type="button" className="bottone piccolo" onClick={salvaTessera}>{salvataTessera || 'Salva tessera'}</button>
            {anniPrecedenti.length > 0 && (
              <p className="nota">Anni precedenti: {anniPrecedenti.map(([a, x]) => `${a} n. ${x.numero || '-'}${x.quotaPagata ? ' (pagata)' : ''}`).join('; ')}</p>
            )}
          </div>
        )}

        <Riepilogo s={s} />

        {s.firma && (
          <div className="pannello">
            <h2>Firma</h2>
            <img className="firma-img" src={s.firma} alt={`Firma di ${s.nome} ${s.cognome}`} />
            {s.firmatoIl && <p className="nota">Firmato il {s.firmatoIl.toDate().toLocaleString('it-IT')}.</p>}
          </div>
        )}

        <div className="pannello">
          <label>Note interne (le vedono solo gli organizzatori)
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== s.note && azione(() => impostaNote(s.id, note))} />
          </label>
        </div>

        <div className="riga-azioni">
          <button type="button" className="bottone piccolo" onClick={() => pdfSocio(s)}>Scarica PDF firmato</button>
          <button type="button" className="bottone contorno piccolo" onClick={() => setModifica(true)}>Modifica dati</button>
          {s.stato === 'attivo' && <button type="button" className="bottone contorno piccolo" onClick={() => azione(() => impostaStato(s.id, 'sospeso'))}>Sospendi</button>}
          {(s.stato === 'sospeso' || s.stato === 'respinto') && <button type="button" className="bottone contorno piccolo" onClick={() => azione(() => impostaStato(s.id, 'attivo'))}>Riattiva</button>}
        </div>

        {!conferma ? (
          <button type="button" className="link-bottone pericolo-testo" onClick={() => setConferma(true)}>Elimina il socio e i suoi dati</button>
        ) : (
          <div className="pannello">
            <p>Eliminare definitivamente {s.nome} {s.cognome}? Spariscono anche firma e tessere. Non si può annullare.</p>
            <div className="griglia-2">
              <button type="button" className="bottone contorno" onClick={() => setConferma(false)}>No</button>
              <button type="button" className="bottone pericolo" onClick={() => azione(async () => { await eliminaSocio(s.id); navigate('/admin/soci', { replace: true }); })}>Sì, elimina</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
