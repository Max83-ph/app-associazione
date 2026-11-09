import type { jsPDF as JsPDF } from 'jspdf';
import { NOME_ASSOCIAZIONE } from '../config';
import { testiCorrenti, testoSemplice } from './testi';
import { codiceLeggibile } from './codice';
import { etaAl } from './carnevale';
import type { IscrizioneCarnevale } from '../types';

const dataIt = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const oggi = () => new Date().toISOString().slice(0, 10);
const nomeFile = (i: IscrizioneCarnevale) => `${i.persone[0]?.cognome ?? ''}-${i.persone[0]?.nome ?? ''}-${i.id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const descriviProva = (i: IscrizioneCarnevale) =>
  i.prova ? i.prova.data.toDate().toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

function scarica(blob: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Modulo firmato di un'iscrizione: figuranti, referente, informativa, liberatoria e firma. */
function paginaIscrizione(pdf: JsPDF, i: IscrizioneCarnevale) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  let y = 20;
  const scrivi = (testo: string, size = 10, stile: 'normal' | 'bold' = 'normal', spazio = 2.5) => {
    pdf.setFont('helvetica', stile);
    pdf.setFontSize(size);
    const righe = pdf.splitTextToSize(testo, w - 30) as string[];
    if (y + righe.length * size * 0.42 > h - 15) { pdf.addPage(); y = 20; }
    pdf.text(righe, 15, y);
    y += righe.length * size * 0.42 + spazio;
  };
  pdf.setFillColor(242, 194, 48); pdf.rect(0, 0, w, 2.5, 'F');
  pdf.setFillColor(30, 107, 69); pdf.rect(0, 2.5, w, 2.5, 'F');
  const ref = i.persone[0];
  scrivi(NOME_ASSOCIAZIONE, 15, 'bold', 1);
  scrivi(`Iscrizione alle sfilate di Carnevale, informativa privacy e liberatoria foto e video · codice ${codiceLeggibile(i.id)}`, 10.5, 'normal', 6);
  scrivi('Figuranti', 12, 'bold');
  i.persone.forEach((p) => {
    const eta = etaAl(p.dataNascita);
    scrivi(`• ${p.nome} ${p.cognome}, nato/a a ${p.luogoNascita} il ${dataIt(p.dataNascita)} (${eta} anni), C.F. ${p.codiceFiscale}${p.taglia ? `, taglia ${p.taglia}` : ''}`, 10, 'normal', 1);
  });
  y += 3;
  scrivi('Referente', 12, 'bold');
  scrivi(`${ref.nome} ${ref.cognome}, ${i.referente.indirizzo}`, 10, 'normal', 1);
  scrivi(`Cellulare ${i.referente.cellulare}   Email ${i.referente.email}`, 10, 'normal', 1);
  if (i.persone.some((p) => etaAl(p.dataNascita) < 18)) scrivi(`Per i figuranti minorenni firma ${ref.nome} ${ref.cognome}, che dichiara di esercitare la responsabilità genitoriale (artt. 316 e 320 c.c.).`, 9.5, 'normal', 1);
  y += 4;
  scrivi('Informativa sul trattamento dei dati personali', 12, 'bold');
  scrivi(testoSemplice(testiCorrenti().informativaCarnevale), 9);
  scrivi(`Presa visione: ${i.consensi.privacy ? 'sì' : 'da completare'}`, 10, 'bold', 5);
  scrivi('Liberatoria foto e video', 12, 'bold');
  scrivi(testoSemplice(testiCorrenti().liberatoriaCarnevale), 9);
  scrivi(`Scelta: ${i.consensi.liberatoriaFoto === null ? 'da completare' : i.consensi.liberatoriaFoto ? 'ACCONSENTE' : 'NON ACCONSENTE'}`, 10, 'bold', 5);
  const quando = (i.completataAt ?? i.createdAt)?.toDate().toLocaleString('it-IT') ?? '';
  if (i.firma) {
    scrivi(`Firmato il ${quando}${i.completataAt ? ', alla prova costume' : ', dall\'app'}`, 9.5);
    if (y + 35 > h - 10) { pdf.addPage(); y = 20; }
    pdf.setDrawColor(207, 213, 205);
    pdf.rect(15, y, 85, 32);
    pdf.addImage(i.firma, 'PNG', 16, y + 1, 83, 30);
    y += 36;
    scrivi(`Firma di ${ref.nome} ${ref.cognome}`, 8.5);
  } else scrivi('Firma non ancora raccolta.', 9.5, 'bold');
}

export async function pdfIscrizioneCarnevale(i: IscrizioneCarnevale) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  paginaIscrizione(pdf, i);
  pdf.save(`carnevale-${nomeFile(i)}.pdf`);
}

/** ZIP con un PDF firmato per ogni iscrizione. */
export async function zipIscrizioniCarnevale(lista: IscrizioneCarnevale[]) {
  const [{ jsPDF }, JSZip] = await Promise.all([import('jspdf'), import('jszip').then((m) => m.default)]);
  const zip = new JSZip();
  for (const i of lista) {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    paginaIscrizione(pdf, i);
    zip.file(`carnevale-${nomeFile(i)}.pdf`, pdf.output('arraybuffer'));
  }
  scarica(await zip.generateAsync({ type: 'blob' }), `carnevale-moduli-firmati-${oggi()}.zip`);
}

/** Excel: una riga per figurante, con i dati della famiglia ripetuti. */
export async function excelCarnevale(lista: IscrizioneCarnevale[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = NOME_ASSOCIAZIONE;
  const ws = wb.addWorksheet('Figuranti');
  ws.columns = [
    { header: 'Cognome', key: 'cognome', width: 18 },
    { header: 'Nome', key: 'nome', width: 16 },
    { header: 'Data di nascita', key: 'nascita', width: 14 },
    { header: 'Età', key: 'eta', width: 6 },
    { header: 'Luogo di nascita', key: 'luogo', width: 18 },
    { header: 'Codice fiscale', key: 'cf', width: 19 },
    { header: 'Quota', key: 'quota', width: 9 },
    { header: 'Taglia', key: 'taglia', width: 11 },
    { header: 'Referente', key: 'ref', width: 22 },
    { header: 'Cellulare', key: 'cell', width: 15 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Indirizzo', key: 'indirizzo', width: 30 },
    { header: 'Prova costume', key: 'prova', width: 24 },
    { header: 'Provato', key: 'provato', width: 9 },
    { header: 'Consegnato', key: 'consegnato', width: 11 },
    { header: 'Totale famiglia €', key: 'totale', width: 15 },
    { header: 'Pagato €', key: 'pagato', width: 10 },
    { header: 'Da incassare €', key: 'resto', width: 14 },
    { header: 'Foto', key: 'foto', width: 8 },
    { header: 'Firmato', key: 'firma', width: 9 },
    { header: 'Codice', key: 'codice', width: 16 },
    { header: 'Note', key: 'note', width: 26 },
  ];
  const n = (c: number) => Math.round(c) / 100;
  for (const i of lista) {
    const ref = i.persone[0];
    i.persone.forEach((p, k) => ws.addRow({
      cognome: p.cognome, nome: p.nome, nascita: dataIt(p.dataNascita), eta: etaAl(p.dataNascita), luogo: p.luogoNascita,
      cf: p.codiceFiscale, quota: p.bambino ? 'Bambino' : 'Adulto', taglia: p.taglia ?? '',
      ref: `${ref.nome} ${ref.cognome}`, cell: i.referente.cellulare, email: i.referente.email, indirizzo: i.referente.indirizzo,
      prova: descriviProva(i), provato: i.provato ? 'Sì' : 'No', consegnato: i.consegnato ? 'Sì' : 'No',
      totale: k === 0 ? n(i.totale) : '', pagato: k === 0 ? n(i.pagato) : '', resto: k === 0 ? n(Math.max(0, i.totale - i.pagato)) : '',
      foto: i.consensi.liberatoriaFoto === null ? '?' : i.consensi.liberatoriaFoto ? 'Sì' : 'No', firma: i.firma ? 'Sì' : 'No',
      codice: codiceLeggibile(i.id), note: i.note ?? '',
    }));
  }
  const riga = ws.getRow(1);
  riga.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  riga.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E6B45' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  const buf = await wb.xlsx.writeBuffer();
  scarica(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `carnevale-figuranti-${oggi()}.xlsx`);
}


/** File .ics dell'appuntamento per la prova costume. */
export function icsProva(i: IscrizioneCarnevale, luogo: string, minuti: number) {
  if (!i.prova) return;
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const inizio = i.prova.data.toDate();
  const fine = new Date(inizio.getTime() + minuti * 60000);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rione Cappuccini//Carnevale//IT', 'BEGIN:VEVENT',
    `UID:prova-${i.id}@cappu-events`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(inizio)}`, `DTEND:${f(fine)}`,
    'SUMMARY:Prova costume Carnevale', `LOCATION:${luogo.replace(/[,;]/g, ' ')}`, `DESCRIPTION:Codice ${codiceLeggibile(i.id)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  scarica(new Blob([ics], { type: 'text/calendar' }), 'prova-costume.ics');
}
