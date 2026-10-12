import { useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Testo formattato scritto in Markdown semplice (**grassetto**, elenchi, link, titoli).
// I testi scritti prima, senza formattazione, si leggono uguale: ogni a capo resta un a capo.
marked.setOptions({ breaks: true, gfm: true });

DOMPurify.addHook('afterSanitizeAttributes', (n) => {
  if (n.tagName === 'A') {
    n.setAttribute('target', '_blank');
    n.setAttribute('rel', 'noopener noreferrer');
  }
});

const PERMESSI = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'hr', 'code'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
};

export function aHtml(testo: string): string {
  // "# Titolo" diventa un h2: la pagina ha già il suo h1.
  const md = testo.replace(/^(#{1,3}) /gm, (_, h: string) => '#'.repeat(h.length + 1) + ' ');
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, PERMESSI);
}

export function Testo({ testo, className }: { testo: string; className?: string }) {
  const html = useMemo(() => aHtml(testo ?? ''), [testo]);
  if (!testo?.trim()) return null;
  return <div className={`testo-ricco ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

type Azione = { etichetta: string; titolo: string; prima: string; dopo?: string; riga?: boolean; segnaposto: string };

const AZIONI: Azione[] = [
  { etichetta: 'G', titolo: 'Grassetto', prima: '**', dopo: '**', segnaposto: 'testo' },
  { etichetta: 'C', titolo: 'Corsivo', prima: '_', dopo: '_', segnaposto: 'testo' },
  { etichetta: 'Titolo', titolo: 'Titolo di sezione', prima: '## ', riga: true, segnaposto: 'Titolo' },
  { etichetta: '• Elenco', titolo: 'Elenco puntato', prima: '- ', riga: true, segnaposto: 'voce' },
  { etichetta: '1. Elenco', titolo: 'Elenco numerato', prima: '1. ', riga: true, segnaposto: 'voce' },
  { etichetta: 'Link', titolo: 'Link', prima: '[', dopo: '](https://)', segnaposto: 'testo del link' },
];

/** Area di testo con pulsanti di formattazione e anteprima. */
export function EditorTesto({
  valore,
  onChange,
  righe = 8,
  max = 20000,
  etichetta,
}: {
  valore: string;
  onChange: (v: string) => void;
  righe?: number;
  max?: number;
  etichetta: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [anteprima, setAnteprima] = useState(false);

  const applica = (a: Azione) => {
    const t = area.current;
    if (!t) return;
    const { selectionStart: s, selectionEnd: e } = t;
    const scelto = valore.slice(s, e) || a.segnaposto;
    let nuovo: string;
    let inizio: number;
    if (a.riga) {
      const righeSel = scelto.split('\n').map((r, i) => (a.prima === '1. ' ? `${i + 1}. ` : a.prima) + r.replace(/^(#+ |- |\d+\. )/, ''));
      const aCapo = s > 0 && valore[s - 1] !== '\n' ? '\n' : '';
      const ins = aCapo + righeSel.join('\n');
      nuovo = valore.slice(0, s) + ins + valore.slice(e);
      inizio = s + ins.length;
      onChange(nuovo);
      requestAnimationFrame(() => { t.focus(); t.setSelectionRange(inizio, inizio); });
      return;
    }
    nuovo = valore.slice(0, s) + a.prima + scelto + (a.dopo ?? '') + valore.slice(e);
    inizio = s + a.prima.length;
    onChange(nuovo);
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(inizio, inizio + scelto.length); });
  };

  return (
    <div className="editor-testo">
      <div className="editor-barra" role="toolbar" aria-label={`Formattazione: ${etichetta}`}>
        {AZIONI.map((a) => (
          <button key={a.titolo} type="button" className={`editor-bottone ${a.etichetta.length === 1 ? 'b-' + a.etichetta : ''}`} title={a.titolo} aria-label={a.titolo} disabled={anteprima} onClick={() => applica(a)}>
            {a.etichetta}
          </button>
        ))}
        <span className="editor-spazio" />
        <button type="button" className={anteprima ? 'editor-bottone attivo' : 'editor-bottone'} aria-pressed={anteprima} onClick={() => setAnteprima(!anteprima)}>
          {anteprima ? 'Modifica' : 'Anteprima'}
        </button>
      </div>
      {anteprima ? (
        <div className="editor-anteprima">{valore.trim() ? <Testo testo={valore} /> : <p className="nota">Niente da mostrare.</p>}</div>
      ) : (
        <textarea ref={area} rows={righe} value={valore} maxLength={max} onChange={(e) => onChange(e.target.value)} aria-label={etichetta} />
      )}
    </div>
  );
}
