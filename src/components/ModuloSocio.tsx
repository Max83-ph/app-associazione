import { useState } from 'react';
import { Firma } from './Firma';
import { erroreCF, normalizzaCF } from '../lib/codiceFiscale';
import { NOME_COMITATO } from '../config';
import { useTesti } from '../lib/testi';
import type { DatiSocio } from '../types';

export const SOCIO_VUOTO: DatiSocio = {
  nome: '',
  cognome: '',
  dataNascita: '',
  luogoNascita: '',
  codiceFiscale: '',
  residenza: { indirizzo: '', cap: '', comune: '', provincia: '' },
  email: '',
  cellulare: '',
  consensi: { privacy: false, liberatoriaFoto: false, whatsapp: false, mailingList: false },
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function maggiorenne(data: string): boolean {
  const n = new Date(data + 'T00:00:00');
  if (Number.isNaN(n.getTime())) return false;
  const oggi = new Date();
  const diciotto = new Date(n.getFullYear() + 18, n.getMonth(), n.getDate());
  return diciotto <= oggi;
}

/** Elenco di ciò che manca o non torna, in parole semplici. */
export function problemiSocio(d: DatiSocio): string[] {
  const p: string[] = [];
  if (!d.nome.trim() || !d.cognome.trim()) p.push('nome e cognome');
  if (!d.dataNascita) p.push('la data di nascita');
  else if (!maggiorenne(d.dataNascita)) p.push('la maggiore età (l\'iscrizione è per maggiorenni)');
  if (!d.luogoNascita.trim()) p.push('il luogo di nascita');
  const cf = erroreCF(d.codiceFiscale);
  if (cf) p.push(`un codice fiscale valido (${cf})`);
  if (!d.residenza.indirizzo.trim() || !d.residenza.comune.trim()) p.push('indirizzo e comune di residenza');
  if (!/^\d{5}$/.test(d.residenza.cap.trim())) p.push('un CAP di 5 cifre');
  if (!/^[A-Za-z]{2}$/.test(d.residenza.provincia.trim())) p.push('la sigla della provincia (es. VC)');
  if (!EMAIL.test(d.email.trim())) p.push('un\'email valida');
  if (!/^\+?\d{6,15}$/.test(d.cellulare.replace(/[^\d+]/g, ''))) p.push('un numero di cellulare');
  return p;
}

interface Props {
  iniziale: DatiSocio;
  /** "socio": compila per sé; "admin": l'organizzatore compila per un'altra persona. */
  chi: 'socio' | 'admin';
  /** Firma già presente (modifica di un socio esistente): la nuova firma diventa facoltativa. */
  firmaEsistente?: string | null;
  etichettaInvio: string;
  onInvia: (dati: DatiSocio, firma: string | null) => Promise<void>;
}

export function ModuloSocio({ iniziale, chi, firmaEsistente, etichettaInvio, onInvia }: Props) {
  const testi = useTesti();
  const [d, setD] = useState<DatiSocio>(iniziale);
  const [sceltaFoto, setSceltaFoto] = useState<boolean | null>(firmaEsistente ? iniziale.consensi.liberatoriaFoto : null);
  const [firma, setFirma] = useState<string | null>(null);
  const [rifirma, setRifirma] = useState(!firmaEsistente);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const set = <K extends keyof DatiSocio>(k: K, v: DatiSocio[K]) => setD((x) => ({ ...x, [k]: v }));
  const setRes = (k: keyof DatiSocio['residenza'], v: string) => setD((x) => ({ ...x, residenza: { ...x.residenza, [k]: v } }));
  const setCons = (k: keyof DatiSocio['consensi'], v: boolean) => setD((x) => ({ ...x, consensi: { ...x.consensi, [k]: v } }));

  const tu = chi === 'socio';
  const problemi = problemiSocio(d);
  if (!d.consensi.privacy) problemi.push('la presa visione dell\'informativa');
  if (sceltaFoto === null) problemi.push('la scelta sulla liberatoria foto e video');
  if (rifirma && !firma) problemi.push('la firma');

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problemi.length) return;
    setInvio(true);
    setErrore('');
    try {
      await onInvia({ ...d, consensi: { ...d.consensi, liberatoriaFoto: !!sceltaFoto } }, rifirma ? firma : null);
    } catch (err) {
      const codice = (err as { code?: string }).code;
      setErrore(
        codice === 'permission-denied'
          ? 'Il salvataggio è stato rifiutato: controlla i dati inseriti e riprova.'
          : 'Salvataggio non riuscito. Controlla la connessione e riprova.',
      );
      setInvio(false);
    }
  };

  return (
    <form className="modulo" onSubmit={invia} noValidate>
      <fieldset>
        <legend>{tu ? 'I tuoi dati' : 'Dati del socio'}</legend>
        <div className="griglia-2">
          <label>Nome<input value={d.nome} onChange={(e) => set('nome', e.target.value)} autoComplete={tu ? 'given-name' : 'off'} /></label>
          <label>Cognome<input value={d.cognome} onChange={(e) => set('cognome', e.target.value)} autoComplete={tu ? 'family-name' : 'off'} /></label>
        </div>
        <div className="griglia-2">
          <label>Data di nascita<input type="date" value={d.dataNascita} onChange={(e) => set('dataNascita', e.target.value)} autoComplete={tu ? 'bday' : 'off'} /></label>
          <label>Luogo di nascita<input value={d.luogoNascita} onChange={(e) => set('luogoNascita', e.target.value)} placeholder="Comune" /></label>
        </div>
        <label>Codice fiscale
          <input
            value={d.codiceFiscale}
            onChange={(e) => set('codiceFiscale', normalizzaCF(e.target.value))}
            maxLength={16}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="maiuscolo"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Residenza</legend>
        <label>Indirizzo<input value={d.residenza.indirizzo} onChange={(e) => setRes('indirizzo', e.target.value)} placeholder="Via e numero civico" autoComplete={tu ? 'street-address' : 'off'} /></label>
        <div className="griglia-cap">
          <label>CAP<input value={d.residenza.cap} onChange={(e) => setRes('cap', e.target.value)} inputMode="numeric" maxLength={5} autoComplete={tu ? 'postal-code' : 'off'} /></label>
          <label>Comune<input value={d.residenza.comune} onChange={(e) => setRes('comune', e.target.value)} autoComplete={tu ? 'address-level2' : 'off'} /></label>
          <label>Prov.<input value={d.residenza.provincia} onChange={(e) => setRes('provincia', e.target.value.toUpperCase())} maxLength={2} className="maiuscolo" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contatti</legend>
        <label>Email<input type="email" inputMode="email" value={d.email} onChange={(e) => set('email', e.target.value)} autoComplete={tu ? 'email' : 'off'} /></label>
        <label>Cellulare<input type="tel" inputMode="tel" value={d.cellulare} onChange={(e) => set('cellulare', e.target.value)} autoComplete={tu ? 'tel' : 'off'} placeholder="es. 333 1234567" /></label>
        <label className="spunta">
          <input type="checkbox" checked={d.consensi.whatsapp} onChange={(e) => setCons('whatsapp', e.target.checked)} />
          {tu ? 'Voglio entrare' : 'Vuole entrare'} nel gruppo WhatsApp dei soci
        </label>
        <label className="spunta">
          <input type="checkbox" checked={d.consensi.mailingList} onChange={(e) => setCons('mailingList', e.target.checked)} />
          {tu ? 'Voglio ricevere' : 'Vuole ricevere'} la mailing list del {NOME_COMITATO}
        </label>
      </fieldset>

      <fieldset>
        <legend>Documenti</legend>
        <details className="documento">
          <summary>Leggi l'informativa privacy</summary>
          <p>{testi.informativaSoci}</p>
        </details>
        <label className="spunta">
          <input type="checkbox" checked={d.consensi.privacy} onChange={(e) => setCons('privacy', e.target.checked)} />
          {tu ? 'Ho letto' : 'Ha letto'} l'informativa privacy
        </label>

        <div className="liberatoria">
          <details className="documento">
            <summary>Liberatoria foto e video per tutti gli eventi del Gruppo</summary>
            <p>{testi.liberatoriaSoci}</p>
          </details>
          <div className="griglia-2">
            <button type="button" className={sceltaFoto === true ? 'scelta attiva' : 'scelta'} aria-pressed={sceltaFoto === true} onClick={() => setSceltaFoto(true)}>Acconsento</button>
            <button type="button" className={sceltaFoto === false ? 'scelta attiva' : 'scelta'} aria-pressed={sceltaFoto === false} onClick={() => setSceltaFoto(false)}>Non acconsento</button>
          </div>
          <p className="nota">Facoltativa: l'adesione vale comunque. Si può cambiare idea in qualsiasi momento.</p>
        </div>

        {firmaEsistente && !rifirma ? (
          <div className="firma-esistente">
            <div className="etichetta-campo">Firma raccolta</div>
            <img src={firmaEsistente} alt="Firma del socio" />
            <button type="button" className="link-bottone" onClick={() => setRifirma(true)}>Raccogli una nuova firma</button>
          </div>
        ) : (
          <div>
            <div className="etichetta-campo">{tu ? 'Firma con il dito' : 'Firma del socio (fagli firmare sul tuo telefono)'}</div>
            <Firma onChange={setFirma} />
          </div>
        )}
      </fieldset>

      {errore && <p className="avviso errore">{errore}</p>}
      {problemi.length > 0 && <p className="nota">Per continuare manca: {problemi.join(', ')}.</p>}
      <button type="submit" className="bottone" disabled={invio || problemi.length > 0}>
        {invio ? 'Salvataggio…' : etichettaInvio}
      </button>
    </form>
  );
}
