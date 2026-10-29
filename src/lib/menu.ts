// Menù d'asporto con prezzi: ogni persona ordina solo quello che vuole e paga il totale.
import type { Evento, Prenotazione, VoceMenu, VoceOrdine } from '../types';

export const CATEGORIE_MENU = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Bevande', 'Altro'];

/** 1250 → "12,50 €" */
export const euro = (centesimi: number) =>
  (centesimi / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

/** "12,5" / "12.50" / "12" → 1250 centesimi; null se non è un prezzo. */
export function centesimi(testo: string): number | null {
  const t = testo.trim().replace('€', '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Quota a persona: quella impostata, oppure ricavata da un prezzo semplice come "5 €" o "€ 7,50 a bambino". */
export function quotaUnitaria(ev: Pick<Evento, 'quotaPersona' | 'prezzo'> | null | undefined): number | null {
  if (!ev) return null;
  if (typeof ev.quotaPersona === 'number') return ev.quotaPersona > 0 ? ev.quotaPersona : null;
  const m = /^\s*(?:€\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)?(\D*)$/i.exec(ev.prezzo ?? '');
  if (!m || (!/€|euro/i.test(ev.prezzo))) return null;
  const c = centesimi(m[1]);
  return c && c > 0 ? c : null;
}

/** Quanto deve pagare questa prenotazione: totale dell'ordine d'asporto, oppure quota × persone. */
export function daPagare(p: Pick<Prenotazione, 'ordine' | 'totale' | 'quantita' | 'modalita'>, ev: Pick<Evento, 'quotaPersona' | 'prezzo'> | null | undefined):
  { importo: number; dettaglio: string } | null {
  if (p.ordine?.length) return { importo: p.totale ?? 0, dettaglio: 'ordine d\'asporto' };
  if (p.modalita === 'asporto') return null;
  const q = quotaUnitaria(ev);
  if (!q) return null;
  return { importo: q * p.quantita, dettaglio: `${p.quantita} × ${euro(q)}` };
}

export const haMenuAsporto = (ev: Pick<Evento, 'menuAsporto'>) => (ev.menuAsporto ?? []).some((v) => v.disponibile !== false);

/** Voci del menù raggruppate per categoria, nell'ordine delle categorie. */
export function perCategoria<T extends { categoria: string }>(voci: T[]): [string, T[]][] {
  const ordine = (c: string) => { const i = CATEGORIE_MENU.indexOf(c); return i < 0 ? 99 : i; };
  const m = new Map<string, T[]>();
  voci.forEach((v) => m.set(v.categoria || 'Altro', [...(m.get(v.categoria || 'Altro') ?? []), v]));
  return [...m.entries()].sort((a, b) => ordine(a[0]) - ordine(b[0]));
}

/** Dalle quantità scelte all'ordine da salvare, con nome e prezzo del momento. */
export function creaOrdine(menu: VoceMenu[], quantita: Record<string, number>): VoceOrdine[] {
  return menu
    .filter((v) => (quantita[v.id] ?? 0) > 0)
    .map((v) => ({ id: v.id, nome: v.nome, prezzo: v.prezzo, quantita: quantita[v.id], porzione: v.porzione !== false }));
}

export const totaleOrdine = (o: VoceOrdine[]) => o.reduce((s, v) => s + v.prezzo * v.quantita, 0);
/** Porzioni che contano per il limite d'asporto (le bevande di solito no). */
export const porzioniOrdine = (o: VoceOrdine[]) => o.reduce((s, v) => s + (v.porzione === false ? 0 : v.quantita), 0);

export const righeOrdine = (o: VoceOrdine[]) => o.map((v) => `${v.quantita} × ${v.nome}`);

/** Totale ricalcolato con i prezzi attuali del menù: serve all'ingresso per accorgersi di differenze. */
export function totaleConMenu(p: Pick<Prenotazione, 'ordine'>, menu: VoceMenu[] | undefined): number | null {
  if (!p.ordine?.length || !menu?.length) return null;
  let t = 0;
  for (const v of p.ordine) {
    const m = menu.find((x) => x.id === v.id);
    if (!m) return null;
    t += m.prezzo * v.quantita;
  }
  return t;
}

/** Quante porzioni di ogni piatto: il riepilogo per la cucina. */
export function riepilogoCucina(prenotazioni: Pick<Prenotazione, 'ordine'>[]): { nome: string; quantita: number; incasso: number }[] {
  const m = new Map<string, { nome: string; quantita: number; incasso: number }>();
  prenotazioni.forEach((p) => (p.ordine ?? []).forEach((v) => {
    const x = m.get(v.id) ?? { nome: v.nome, quantita: 0, incasso: 0 };
    x.quantita += v.quantita;
    x.incasso += v.quantita * v.prezzo;
    m.set(v.id, x);
  }));
  return [...m.values()];
}
