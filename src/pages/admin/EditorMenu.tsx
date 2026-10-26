import { useState } from 'react';
import { CATEGORIE_MENU, centesimi, euro } from '../../lib/menu';
import type { VoceMenu } from '../../types';

const nuovoId = () => Math.random().toString(36).slice(2, 10);
const BEVANDE = new Set(['Bevande']);

/** Menù d'asporto: piatti con categoria e prezzo, in ordine, con "finito" per chiudere un piatto. */
export function EditorMenu({ valore, onChange }: { valore: VoceMenu[]; onChange: (v: VoceMenu[]) => void }) {
  const [prezzi, setPrezzi] = useState<Record<string, string>>({});
  const set = (i: number, v: Partial<VoceMenu>) => onChange(valore.map((x, k) => (k === i ? { ...x, ...v } : x)));
  const sposta = (i: number, d: -1 | 1) => {
    const l = [...valore];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    onChange(l);
  };
  const aggiungi = () => {
    const ultima = valore[valore.length - 1]?.categoria ?? 'Primi';
    onChange([...valore, { id: nuovoId(), nome: '', categoria: ultima, prezzo: 0, porzione: !BEVANDE.has(ultima), disponibile: true }]);
  };

  return (
    <div className="editor-menu">
      {valore.length === 0 && <p className="nota">Nessun piatto: chi sceglie l'asporto indica solo il numero di porzioni. Aggiungi i piatti per far ordinare dal menù con i prezzi.</p>}
      {valore.map((v, i) => {
        const testoPrezzo = prezzi[v.id] ?? (v.prezzo ? (v.prezzo / 100).toFixed(2).replace('.', ',') : '');
        const prezzoOk = centesimi(testoPrezzo) !== null;
        return (
          <div key={v.id} className={v.disponibile === false ? 'voce-menu finita' : 'voce-menu'}>
            <div className="voce-menu-riga">
              <label className="voce-nome">Piatto
                <input value={v.nome} maxLength={80} onChange={(e) => set(i, { nome: e.target.value })} placeholder="es. Agnolotti al sugo d'arrosto" />
              </label>
              <label className="voce-prezzo">Prezzo €
                <input value={testoPrezzo} inputMode="decimal" placeholder="8,00" aria-invalid={!prezzoOk}
                  onChange={(e) => { setPrezzi((p) => ({ ...p, [v.id]: e.target.value })); const c = centesimi(e.target.value); if (c !== null) set(i, { prezzo: c }); }} />
              </label>
            </div>
            <div className="voce-menu-riga">
              <label className="voce-categoria">Categoria
                <select value={v.categoria} onChange={(e) => set(i, { categoria: e.target.value, porzione: !BEVANDE.has(e.target.value) })}>
                  {CATEGORIE_MENU.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="voce-nome">Descrizione (facoltativa)
                <input value={v.descrizione ?? ''} maxLength={160} onChange={(e) => set(i, { descrizione: e.target.value })} placeholder="es. con ragù di carne, contiene glutine" />
              </label>
            </div>
            <div className="voce-menu-azioni">
              <label className="spunta"><input type="checkbox" checked={v.porzione !== false} onChange={(e) => set(i, { porzione: e.target.checked })} /> Conta come porzione</label>
              <label className="spunta"><input type="checkbox" checked={v.disponibile === false} onChange={(e) => set(i, { disponibile: !e.target.checked })} /> Finito</label>
              <span className="voce-spazio" />
              <button type="button" className="mini" disabled={i === 0} onClick={() => sposta(i, -1)} aria-label={`Sposta su ${v.nome}`}>↑</button>
              <button type="button" className="mini" disabled={i === valore.length - 1} onClick={() => sposta(i, 1)} aria-label={`Sposta giù ${v.nome}`}>↓</button>
              <button type="button" className="mini" onClick={() => onChange(valore.filter((_, k) => k !== i))}>Togli</button>
            </div>
            {!prezzoOk && <span className="nota errore-testo">Prezzo non valido: scrivi ad esempio 8 oppure 8,50.</span>}
          </div>
        );
      })}
      <button type="button" className="bottone contorno piccolo" onClick={aggiungi}>+ Aggiungi piatto</button>
      {valore.length > 0 && (
        <p className="nota">
          {valore.length} voci. "Conta come porzione" vale per il limite di porzioni del giorno dell'evento (togli la spunta per bevande e simili).
          "Finito" nasconde il piatto a chi prenota da quel momento. Es. prezzi: {valore.slice(0, 2).map((v) => `${v.nome || 'piatto'} ${euro(v.prezzo)}`).join(', ')}.
        </p>
      )}
    </div>
  );
}
