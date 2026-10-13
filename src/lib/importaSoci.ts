// Importazione dei soci da un file Excel (modello scaricabile dall'app).
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Cell, Workbook } from 'exceljs';
import { db } from '../firebase';
import { NOME_ASSOCIAZIONE } from '../config';
import { pulisci } from './soci';
import { normalizzaCF } from './codiceFiscale';
import { problemiSocio, SOCIO_VUOTO } from '../components/ModuloSocio';
import type { DatiSocio, Socio } from '../types';

export interface RigaImport {
  riga: number;
  dati: DatiSocio;
  numeroTessera: string;
  quotaPagata: boolean;
  note: string;
  problemi: string[];
}

type Campo =
  | 'cognome' | 'nome' | 'dataNascita' | 'luogoNascita' | 'codiceFiscale' | 'indirizzo' | 'cap' | 'comune' | 'provincia'
  | 'email' | 'cellulare' | 'tessera' | 'quota' | 'foto' | 'whatsapp' | 'mailing' | 'note';

// Intestazioni riconosciute (minuscolo, senza accenti né punteggiatura).
const SINONIMI: Record<Campo, string[]> = {
  cognome: ['cognome'],
  nome: ['nome'],
  dataNascita: ['data di nascita', 'data nascita', 'nato il', 'nascita', 'data'],
  luogoNascita: ['luogo di nascita', 'luogo nascita', 'nato a', 'comune di nascita'],
  codiceFiscale: ['codice fiscale', 'cf', 'cod fiscale', 'codicefiscale'],
  indirizzo: ['indirizzo', 'via', 'residenza'],
  cap: ['cap'],
  comune: ['comune', 'citta', 'comune di residenza'],
  provincia: ['provincia', 'prov', 'pr'],
  email: ['email', 'e mail', 'mail', 'posta elettronica'],
  cellulare: ['cellulare', 'telefono', 'cell', 'tel', 'numero di telefono'],
  tessera: ['numero tessera', 'tessera', 'n tessera', 'tessera n'],
  quota: ['quota pagata', 'quota', 'pagato', 'pagata'],
  foto: ['liberatoria foto', 'liberatoria', 'foto', 'consenso foto'],
  whatsapp: ['whatsapp', 'gruppo whatsapp'],
  mailing: ['mailing list', 'mailing', 'newsletter'],
  note: ['note', 'annotazioni'],
};

const COLONNE_MODELLO: { campo: Campo; titolo: string; larghezza: number; esempio: string | Date }[] = [
  { campo: 'cognome', titolo: 'Cognome', larghezza: 18, esempio: 'Rossi' },
  { campo: 'nome', titolo: 'Nome', larghezza: 16, esempio: 'Maria' },
  { campo: 'dataNascita', titolo: 'Data di nascita', larghezza: 15, esempio: '15/03/1980' },
  { campo: 'luogoNascita', titolo: 'Luogo di nascita', larghezza: 18, esempio: 'Vercelli' },
  { campo: 'codiceFiscale', titolo: 'Codice fiscale', larghezza: 19, esempio: 'RSSMRA80C55L750X' },
  { campo: 'indirizzo', titolo: 'Indirizzo', larghezza: 26, esempio: 'Via Lamporo 6' },
  { campo: 'cap', titolo: 'CAP', larghezza: 8, esempio: '13100' },
  { campo: 'comune', titolo: 'Comune', larghezza: 16, esempio: 'Vercelli' },
  { campo: 'provincia', titolo: 'Provincia', larghezza: 10, esempio: 'VC' },
  { campo: 'email', titolo: 'Email', larghezza: 26, esempio: 'maria.rossi@esempio.it' },
  { campo: 'cellulare', titolo: 'Cellulare', larghezza: 15, esempio: '333 1234567' },
  { campo: 'tessera', titolo: 'Numero tessera', larghezza: 15, esempio: '1' },
  { campo: 'quota', titolo: 'Quota pagata', larghezza: 13, esempio: 'sì' },
  { campo: 'foto', titolo: 'Liberatoria foto', larghezza: 15, esempio: 'sì' },
  { campo: 'whatsapp', titolo: 'WhatsApp', larghezza: 11, esempio: 'sì' },
  { campo: 'mailing', titolo: 'Mailing list', larghezza: 12, esempio: 'no' },
  { campo: 'note', titolo: 'Note', larghezza: 26, esempio: '' },
];

const pulito = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function testoCella(c: Cell): string {
  const v = c.value as unknown;
  if (v == null) return '';
  if (v instanceof Date) return dataIso(v);
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join('').trim();
    if (o.result instanceof Date) return dataIso(o.result);
    if (o.result != null) return String(o.result).trim();
    if (o.text) return String(o.text).trim();
    if (o.hyperlink) return o.hyperlink.replace(/^mailto:/, '').trim();
    return '';
  }
  return String(v).trim();
}

const dataIso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** "15/03/1980", "15-3-80", "1980-03-15" → "1980-03-15"; altrimenti "" */
function data(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!m) return '';
  let a = Number(m[3]);
  if (a < 100) a += a > new Date().getFullYear() % 100 ? 1900 : 2000;
  const g = Number(m[1]), me = Number(m[2]);
  if (me < 1 || me > 12 || g < 1 || g > 31) return '';
  return `${a}-${String(me).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

const si = (s: string) => ['si', 'sì', 's', 'x', 'yes', 'y', 'true', 'vero', '1', 'pagata', 'pagato', 'ok'].includes(s.toLowerCase().trim());

/** Legge il primo foglio: la prima riga con "Cognome" e "Nome" fa da intestazione. */
export async function leggiExcel(file: File, esistenti: Socio[]): Promise<{ righe: RigaImport[]; mancanti: string[] }> {
  const ExcelJS = (await import('exceljs')).default;
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets.find((w) => w.rowCount > 0);
  if (!ws) throw new Error('Il file non contiene fogli con dati.');

  let rigaTitoli = 0;
  const colonne = new Map<Campo, number>();
  for (let r = 1; r <= Math.min(ws.rowCount, 10) && !rigaTitoli; r++) {
    const titoli = new Map<string, number>();
    ws.getRow(r).eachCell((c, n) => titoli.set(pulito(testoCella(c)), n));
    if (titoli.has('cognome') && titoli.has('nome')) {
      rigaTitoli = r;
      (Object.keys(SINONIMI) as Campo[]).forEach((campo) => {
        const trovato = SINONIMI[campo].find((s) => titoli.has(s));
        if (trovato) colonne.set(campo, titoli.get(trovato)!);
      });
    }
  }
  if (!rigaTitoli) throw new Error('Non trovo le colonne "Cognome" e "Nome" nelle prime righe: usa il modello.');
  const essenziali: Campo[] = ['dataNascita', 'luogoNascita', 'codiceFiscale', 'indirizzo', 'cap', 'comune', 'provincia'];
  const mancanti = essenziali.filter((c) => !colonne.has(c)).map((c) => COLONNE_MODELLO.find((x) => x.campo === c)!.titolo);

  const cfEsistenti = new Set(esistenti.map((s) => s.codiceFiscale));
  const cfFile = new Map<string, number>();
  const righe: RigaImport[] = [];
  for (let r = rigaTitoli + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const val = (c: Campo) => (colonne.has(c) ? testoCella(row.getCell(colonne.get(c)!)) : '');
    if (!val('cognome') && !val('nome') && !val('codiceFiscale')) continue;
    // La riga di esempio del modello, se non è stata cancellata.
    if (normalizzaCF(val('codiceFiscale')) === 'RSSMRA80C55L750X' && val('cognome') === 'Rossi') continue;
    const dataRaw = val('dataNascita');
    const cap = val('cap').replace(/\D/g, '');
    const dati: DatiSocio = {
      ...SOCIO_VUOTO,
      nome: val('nome'),
      cognome: val('cognome'),
      dataNascita: data(dataRaw),
      luogoNascita: val('luogoNascita'),
      codiceFiscale: normalizzaCF(val('codiceFiscale')),
      residenza: { indirizzo: val('indirizzo'), cap: cap && cap.length < 5 ? cap.padStart(5, '0') : cap, comune: val('comune'), provincia: val('provincia').toUpperCase() },
      email: val('email'),
      cellulare: val('cellulare'),
      consensi: { privacy: true, liberatoriaFoto: si(val('foto')), whatsapp: si(val('whatsapp')), mailingList: si(val('mailing')) },
    };
    const problemi = problemiSocio(dati, true);
    if (dataRaw && !dati.dataNascita) problemi.unshift(`la data di nascita "${dataRaw}" non è leggibile (usa GG/MM/AAAA)`);
    const cf = dati.codiceFiscale;
    if (cf && cfEsistenti.has(cf)) problemi.push('nessun doppione: questo codice fiscale è già tra i soci');
    if (cf && cfFile.has(cf)) problemi.push(`nessun doppione: codice fiscale già alla riga ${cfFile.get(cf)}`);
    if (cf) cfFile.set(cf, r);
    righe.push({ riga: r, dati, numeroTessera: val('tessera'), quotaPagata: si(val('quota')), note: val('note'), problemi });
  }
  return { righe, mancanti };
}

/** Salva le righe valide come soci attivi (firmato su carta), a blocchi da 400. */
export async function importaSoci(righe: RigaImport[], anno: string, avanzamento?: (n: number) => void): Promise<number> {
  const col = collection(db, 'soci');
  let fatti = 0;
  for (let i = 0; i < righe.length; i += 400) {
    const b = writeBatch(db);
    righe.slice(i, i + 400).forEach((r) => {
      const tessere = r.numeroTessera || r.quotaPagata
        ? { [anno]: { numero: r.numeroTessera, quotaPagata: r.quotaPagata, pagataIl: r.quotaPagata ? serverTimestamp() : null } }
        : {};
      b.set(doc(col), {
        ...pulisci(r.dati),
        uid: null,
        firma: null,
        firmatoIl: null,
        moduloCartaceo: [],
        stato: 'attivo',
        tessere,
        note: r.note || 'Importato da Excel',
        creatoDa: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await b.commit();
    fatti += Math.min(400, righe.length - i);
    avanzamento?.(fatti);
  }
  return fatti;
}

/** Modello Excel vuoto con una riga di esempio e le istruzioni. */
export async function scaricaModello() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = NOME_ASSOCIAZIONE;
  const ws = wb.addWorksheet('Soci');
  ws.columns = COLONNE_MODELLO.map((c) => ({ header: c.titolo, key: c.campo, width: c.larghezza }));
  const titoli = ws.getRow(1);
  titoli.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  titoli.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E6B45' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const esempio = ws.addRow(Object.fromEntries(COLONNE_MODELLO.map((c) => [c.campo, c.esempio])));
  esempio.font = { italic: true, color: { argb: 'FF8A8A8A' } };
  ['codiceFiscale', 'cap', 'cellulare', 'tessera', 'dataNascita'].forEach((k) => (ws.getColumn(k).numFmt = '@'));

  const info = wb.addWorksheet('Istruzioni');
  info.getColumn(1).width = 110;
  [
    'Come compilare',
    '• Una riga per socio. Cancella la riga di esempio (in grigio) prima di importare.',
    '• Obbligatori: Cognome, Nome, Data di nascita (GG/MM/AAAA), Luogo di nascita, Codice fiscale, Indirizzo, CAP, Comune, Provincia (sigla).',
    '• Facoltativi: Email, Cellulare, Numero tessera, Quota pagata, Liberatoria foto, WhatsApp, Mailing list, Note.',
    '• Nelle colonne Quota pagata, Liberatoria foto, WhatsApp e Mailing list scrivi "sì" oppure lascia vuoto.',
    '• I soci importati risultano attivi, con il modulo firmato su carta. Numero tessera e quota valgono per l\'anno in corso.',
    '• Le righe con errori o con un codice fiscale già presente vengono saltate: l\'app ti mostra quali e perché prima di importare.',
    '• Dopo l\'importazione puoi creare l\'account per l\'app dalla scheda di ogni socio che ha l\'email.',
  ].forEach((t, i) => { const r = info.addRow([t]); if (i === 0) r.font = { bold: true, size: 13 }; });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = 'modello-importazione-soci.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
