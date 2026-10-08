import type { jsPDF as JsPDF } from 'jspdf';
import type { Socio } from '../types';
import { NOME_ASSOCIAZIONE, NOME_COMITATO } from '../config';
import { testiCorrenti } from './testi';

const siNo = (v: boolean) => (v ? 'Sì' : 'No');
const dataIt = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const statoIt: Record<Socio['stato'], string> = {
  in_attesa: 'In attesa',
  attivo: 'Attivo',
  respinto: 'Respinto',
  sospeso: 'Sospeso',
};
const oggi = () => new Date().toISOString().slice(0, 10);

function scarica(blob: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- PDF: modulo firmato ----------

function paginaSocio(pdf: JsPDF, s: Socio) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  let y = 20;
  const scrivi = (testo: string, size = 10, stile: 'normal' | 'bold' = 'normal', spazio = 2.5) => {
    pdf.setFont('helvetica', stile);
    pdf.setFontSize(size);
    const righe = pdf.splitTextToSize(testo, w - 30) as string[];
    if (y + righe.length * size * 0.42 > h - 15) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(righe, 15, y);
    y += righe.length * size * 0.42 + spazio;
  };

  // Nastro giallo-verde
  pdf.setFillColor(242, 194, 48);
  pdf.rect(0, 0, w, 2.5, 'F');
  pdf.setFillColor(30, 107, 69);
  pdf.rect(0, 2.5, w, 2.5, 'F');

  scrivi(NOME_ASSOCIAZIONE, 15, 'bold', 1);
  scrivi('Domanda di adesione socio, informativa privacy e liberatoria foto e video', 10.5, 'normal', 6);

  scrivi('Dati anagrafici', 12, 'bold');
  const r = s.residenza;
  [
    `Nome e cognome: ${s.nome} ${s.cognome}`,
    `Nato/a a ${s.luogoNascita} il ${dataIt(s.dataNascita)}`,
    `Codice fiscale: ${s.codiceFiscale}`,
    `Residenza: ${r.indirizzo}, ${r.cap} ${r.comune} (${r.provincia})`,
    `Email: ${s.email}   Cellulare: ${s.cellulare}`,
  ].forEach((t) => scrivi(t, 10, 'normal', 1));
  y += 4;

  scrivi('Informativa sul trattamento dei dati personali', 12, 'bold');
  scrivi(testiCorrenti().informativaSoci, 9);
  scrivi('Il socio dichiara di aver letto l\'informativa.', 10, 'bold', 5);

  scrivi('Liberatoria foto e video', 12, 'bold');
  scrivi(testiCorrenti().liberatoriaSoci, 9);
  scrivi(`Scelta del socio: ${s.consensi.liberatoriaFoto ? 'ACCONSENTE' : 'NON ACCONSENTE'}`, 10, 'bold', 5);

  scrivi('Comunicazioni', 12, 'bold');
  scrivi(`Gruppo WhatsApp dei soci: ${siNo(s.consensi.whatsapp)}   Mailing list del ${NOME_COMITATO}: ${siNo(s.consensi.mailingList)}`, 10, 'normal', 6);

  const quando = s.firmatoIl ? s.firmatoIl.toDate().toLocaleString('it-IT') : '';
  scrivi(`Firmato ${quando ? `il ${quando}` : ''}${s.creatoDa === 'admin' ? ', alla presenza di un organizzatore' : ', dall\'app'}`, 9.5);
  if (s.firma) {
    if (y + 35 > h - 10) {
      pdf.addPage();
      y = 20;
    }
    pdf.setDrawColor(207, 213, 205);
    pdf.rect(15, y, 85, 32);
    pdf.addImage(s.firma, 'PNG', 16, y + 1, 83, 30);
    y += 36;
    scrivi(`Firma di ${s.nome} ${s.cognome}`, 8.5);
  }
}

const nomeFile = (s: Socio) => `${s.cognome}-${s.nome}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export async function pdfSocio(s: Socio) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  paginaSocio(pdf, s);
  pdf.save(`adesione-${nomeFile(s)}.pdf`);
}

/** Un unico PDF con i moduli firmati di tutti i soci indicati, uno per pagina. */
export async function pdfTuttiSoci(lista: Socio[]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  lista.forEach((s, i) => {
    if (i > 0) pdf.addPage();
    paginaSocio(pdf, s);
  });
  pdf.save(`moduli-firmati-soci-${oggi()}.pdf`);
}

// ---------- Excel ----------

export async function excelSoci(lista: Socio[], anno: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = NOME_ASSOCIAZIONE;
  wb.created = new Date();

  const intestazione = (ws: import('exceljs').Worksheet) => {
    const riga = ws.getRow(1);
    riga.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    riga.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E6B45' } };
    riga.alignment = { vertical: 'middle' };
    riga.height = 22;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  const elenco = wb.addWorksheet('Soci');
  elenco.columns = [
    { header: 'Stato', key: 'stato', width: 11 },
    { header: `Tessera ${anno}`, key: 'tessera', width: 12 },
    { header: `Quota ${anno}`, key: 'quota', width: 11 },
    { header: 'Cognome', key: 'cognome', width: 18 },
    { header: 'Nome', key: 'nome', width: 16 },
    { header: 'Codice fiscale', key: 'cf', width: 19 },
    { header: 'Data di nascita', key: 'nascita', width: 14 },
    { header: 'Luogo di nascita', key: 'luogo', width: 18 },
    { header: 'Indirizzo', key: 'indirizzo', width: 28 },
    { header: 'CAP', key: 'cap', width: 8 },
    { header: 'Comune', key: 'comune', width: 18 },
    { header: 'Prov.', key: 'prov', width: 7 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Cellulare', key: 'cell', width: 15 },
    { header: 'Privacy', key: 'privacy', width: 9 },
    { header: 'Liberatoria foto', key: 'foto', width: 15 },
    { header: 'WhatsApp', key: 'wa', width: 11 },
    { header: 'Mailing list', key: 'ml', width: 12 },
    { header: 'Firmato il', key: 'firmato', width: 18 },
    { header: 'Inserito da', key: 'da', width: 12 },
    { header: 'Note', key: 'note', width: 30 },
  ];
  for (const s of lista) {
    const t = s.tessere?.[anno];
    elenco.addRow({
      stato: statoIt[s.stato],
      tessera: t?.numero ?? '',
      quota: t ? (t.quotaPagata ? 'Pagata' : 'Da pagare') : '',
      cognome: s.cognome,
      nome: s.nome,
      cf: s.codiceFiscale,
      nascita: dataIt(s.dataNascita),
      luogo: s.luogoNascita,
      indirizzo: s.residenza.indirizzo,
      cap: s.residenza.cap,
      comune: s.residenza.comune,
      prov: s.residenza.provincia,
      email: s.email,
      cell: s.cellulare,
      privacy: siNo(s.consensi.privacy),
      foto: siNo(s.consensi.liberatoriaFoto),
      wa: siNo(s.consensi.whatsapp),
      ml: siNo(s.consensi.mailingList),
      firmato: s.firmatoIl ? s.firmatoIl.toDate().toLocaleString('it-IT') : '',
      da: s.creatoDa === 'admin' ? 'Organizzatore' : 'App',
      note: s.note,
    });
  }
  intestazione(elenco);

  // Elenchi pronti da usare: chi vuole il gruppo WhatsApp e chi la mailing list.
  const attivi = lista.filter((s) => s.stato === 'attivo');
  const wa = wb.addWorksheet('WhatsApp');
  wa.columns = [
    { header: 'Cognome', key: 'cognome', width: 18 },
    { header: 'Nome', key: 'nome', width: 16 },
    { header: 'Cellulare', key: 'cell', width: 16 },
  ];
  attivi.filter((s) => s.consensi.whatsapp).forEach((s) => wa.addRow({ cognome: s.cognome, nome: s.nome, cell: s.cellulare }));
  intestazione(wa);

  const ml = wb.addWorksheet('Mailing list');
  ml.columns = [
    { header: 'Cognome', key: 'cognome', width: 18 },
    { header: 'Nome', key: 'nome', width: 16 },
    { header: 'Email', key: 'email', width: 30 },
  ];
  attivi.filter((s) => s.consensi.mailingList).forEach((s) => ml.addRow({ cognome: s.cognome, nome: s.nome, email: s.email }));
  intestazione(ml);

  const buf = await wb.xlsx.writeBuffer();
  scarica(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `soci-${oggi()}.xlsx`,
  );
}
