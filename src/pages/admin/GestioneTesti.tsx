import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { salvaTesti, TESTI_PREDEFINITI, useTesti, type Contatti, type Testi } from '../../lib/testi';
import { Icona } from '../../components/Icona';

type CampoTesto = Exclude<keyof Testi, 'contatti'>;

const TESTI: { chiave: CampoTesto; titolo: string; dove: string }[] = [
  { chiave: 'chiSiamo', titolo: 'Chi siamo', dove: 'Pagina Info, in alto.' },
  { chiave: 'informativaSoci', titolo: 'Informativa privacy soci', dove: 'Modulo di iscrizione soci e PDF della domanda firmata.' },
  { chiave: 'liberatoriaSoci', titolo: 'Liberatoria foto e video soci', dove: 'Modulo di iscrizione soci e PDF della domanda firmata.' },
  { chiave: 'informativaPrivacy', titolo: 'Informativa privacy eventi', dove: 'Iscrizione agli eventi e PDF dei laboratori firmati.' },
  { chiave: 'liberatoriaFoto', titolo: 'Liberatoria foto e video eventi', dove: 'Iscrizione ai laboratori e agli eventi a tema.' },
];

const CONTATTI: { chiave: keyof Contatti; etichetta: string; aiuto?: string }[] = [
  { chiave: 'email', etichetta: 'Email' },
  { chiave: 'telefono', etichetta: 'Telefono' },
  { chiave: 'indirizzo', etichetta: 'Indirizzo della sede' },
  { chiave: 'whatsapp', etichetta: 'Link WhatsApp', aiuto: 'es. https://wa.me/39333… (vuoto = non mostrato)' },
  { chiave: 'instagram', etichetta: 'Link Instagram', aiuto: 'vuoto = non mostrato' },
  { chiave: 'facebook', etichetta: 'Link Facebook', aiuto: 'vuoto = non mostrato' },
];

export function GestioneTesti() {
  const { utente } = useAuth();
  const attuali = useTesti();
  const [bozza, setBozza] = useState<Testi>(attuali);
  const [toccato, setToccato] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [esito, setEsito] = useState('');
  const [errore, setErrore] = useState('');

  // Finché non si modifica nulla, la bozza segue i testi salvati (arrivano dopo il caricamento).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!toccato) setBozza(attuali); }, [attuali, toccato]);

  const setTesto = (k: CampoTesto, v: string) => { setToccato(true); setEsito(''); setBozza((b) => ({ ...b, [k]: v })); };
  const setContatto = (k: keyof Contatti, v: string) => { setToccato(true); setEsito(''); setBozza((b) => ({ ...b, contatti: { ...b.contatti, [k]: v } })); };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvo(true);
    setErrore('');
    try {
      await salvaTesti(bozza, utente?.email ?? '');
      setToccato(false);
      setEsito('Salvato: i nuovi testi sono già visibili nell\'app.');
    } catch (err) {
      setErrore(err instanceof Error ? `Salvataggio non riuscito: ${err.message}` : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  };

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Testi e contatti</h1>
      </header>
      <main className="contenuto">
        <p className="nota">
          Le modifiche valgono subito per le nuove iscrizioni. Le firme già raccolte restano valide; i PDF che scarichi dopo
          una modifica riportano il testo nuovo, quindi cambia informative e liberatorie solo quando serve davvero.
        </p>
        <form className="modulo" onSubmit={salva}>
          {TESTI.map((t) => (
            <fieldset key={t.chiave}>
              <legend>{t.titolo}</legend>
              <span className="nota">{t.dove}</span>
              <textarea
                rows={t.chiave === 'chiSiamo' ? 6 : 9}
                value={bozza[t.chiave]}
                maxLength={20000}
                onChange={(e) => setTesto(t.chiave, e.target.value)}
                aria-label={t.titolo}
              />
              {bozza[t.chiave] !== TESTI_PREDEFINITI[t.chiave] && (
                <button type="button" className="link-bottone" onClick={() => setTesto(t.chiave, TESTI_PREDEFINITI[t.chiave])}>
                  Ripristina il testo iniziale
                </button>
              )}
            </fieldset>
          ))}
          <fieldset>
            <legend>Contatti (pagina Info)</legend>
            {CONTATTI.map((c) => (
              <label key={c.chiave}>{c.etichetta}
                <input value={bozza.contatti[c.chiave]} maxLength={300} onChange={(e) => setContatto(c.chiave, e.target.value)} />
                {c.aiuto && <span className="nota">{c.aiuto}</span>}
              </label>
            ))}
          </fieldset>
          {errore && <p className="avviso errore">{errore}</p>}
          {esito && <p className="avviso">{esito}</p>}
          <button type="submit" className="bottone" disabled={salvo || !toccato}>{salvo ? 'Salvo…' : 'Salva i testi'}</button>
        </form>
      </main>
    </>
  );
}
