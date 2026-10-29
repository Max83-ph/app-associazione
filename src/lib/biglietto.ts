import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import type { Evento, Prenotazione } from '../types';
import { codiceLeggibile } from './codice';
import { avvisoArrivo, dataBreve, dove } from './format';
import { NOME_ASSOCIAZIONE } from '../config';
import { testiCorrenti, testoSemplice } from './testi';
import { daPagare, euro, righeOrdine } from './menu';

/** Il QR contiene solo il codice del biglietto, nessun dato personale. */
export const qrDataUrl = (codice: string, width = 480) =>
  QRCode.toDataURL(codice, { width, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#141A26', light: '#FFFFFF' } });

export const qrLinkDataUrl = (url: string, width = 1024) =>
  QRCode.toDataURL(url, { width, margin: 2, errorCorrectionLevel: 'M' });

export function descriviModalita(p: Prenotazione): string {
  if (p.modalita === 'asporto' && p.ordine?.length) return `Asporto, totale ${euro(p.totale ?? 0)}`;
  if (p.modalita === 'asporto') return `Asporto, ${p.quantita} ${p.quantita === 1 ? 'porzione' : 'porzioni'}`;
  if (p.modalita === 'tavolo') return `Al tavolo, ${p.quantita} ${p.quantita === 1 ? 'persona' : 'persone'}`;
  if (p.partecipanti.length) return `${p.partecipanti.length} ${p.partecipanti.length === 1 ? 'bambino' : 'bambini'}`;
  return `${p.quantita} ${p.quantita === 1 ? 'persona' : 'persone'}`;
}

export async function scaricaPdfBiglietto(p: Prenotazione, ev?: Evento | null) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a5' });
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(18, 32, 26);
  pdf.rect(0, 0, w, 22, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(NOME_ASSOCIAZIONE, 10, 14);

  pdf.setTextColor(26, 31, 43);
  pdf.setFontSize(17);
  pdf.text(pdf.splitTextToSize(p.eventoTitolo, w - 20), w / 2, 34, { align: 'center' });
  pdf.setFontSize(11);
  pdf.setTextColor(178, 58, 30);
  pdf.text(dataBreve(p.eventoData), w / 2, 46, { align: 'center' });
  const luogo = ev ? dove(ev, testiCorrenti().contatti.indirizzo).testo : '';
  if (luogo) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(26, 31, 43);
    pdf.text(pdf.splitTextToSize(luogo, w - 24), w / 2, 52, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
  }

  pdf.addImage(await qrDataUrl(p.id, 600), 'PNG', w / 2 - 33, 58, 66, 66);
  pdf.setTextColor(26, 31, 43);
  pdf.setFontSize(14);
  pdf.text(codiceLeggibile(p.id), w / 2, 132, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  const righe = [
    `Nome: ${p.nome} ${p.cognome}`,
    descriviModalita(p),
    ...p.partecipanti.map((b) => `• ${b.nome} ${b.cognome}, ${b.eta} anni`),
    ...(p.ordine?.length ? righeOrdine(p.ordine).map((r) => `• ${r}`) : []),
    p.ordine?.length
      ? `Totale ${p.pagamento.stato === 'da_pagare' ? 'da pagare al ritiro' : 'pagato'}: ${euro(p.totale ?? 0)}`
      : daPagare(p, ev) && p.pagamento.stato === 'da_pagare'
        ? `Da pagare all'ingresso: ${euro(daPagare(p, ev)!.importo)} (${daPagare(p, ev)!.dettaglio})`
        : `Pagamento: ${p.pagamento.stato === 'da_pagare' ? 'in loco' : 'effettuato'}`,
  ];
  // Le righe stanno tra y=146 e y=176: con un ordine lungo il carattere si rimpicciolisce.
  pdf.setFontSize(Math.max(6.5, Math.min(11, 30 / (righe.length * 0.406))));
  pdf.text(righe, 14, 146, { lineHeightFactor: 1.15 });
  const arrivo = ev ? avvisoArrivo(ev) : '';
  if (arrivo) {
    pdf.setFillColor(252, 241, 204);
    pdf.roundedRect(10, 178, w - 20, 12, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(106, 80, 0);
    pdf.text(pdf.splitTextToSize(arrivo, w - 28), w / 2, 185, { align: 'center' });
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(90, 98, 115);
  pdf.text('Mostra questo QR all\'ingresso, stampato o dal telefono.', w / 2, 200, { align: 'center' });
  pdf.save(`biglietto-${p.id}.pdf`);
}

/** PDF dei documenti firmati per una prenotazione (informativa ed eventuale liberatoria). */
export function scaricaPdfFirmato(p: Prenotazione) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  let y = 18;
  const scrivi = (testo: string, size = 10, stile: 'normal' | 'bold' = 'normal') => {
    pdf.setFont('helvetica', stile);
    pdf.setFontSize(size);
    const righe = pdf.splitTextToSize(testo, w - 30);
    pdf.text(righe, 15, y);
    y += righe.length * size * 0.42 + 3;
  };
  scrivi(NOME_ASSOCIAZIONE, 14, 'bold');
  scrivi(`${p.eventoTitolo}, ${dataBreve(p.eventoData)}`, 11);
  scrivi(`Firmatario: ${p.nome} ${p.cognome} (${p.email}), biglietto ${codiceLeggibile(p.id)}`, 10);
  if (p.partecipanti.length) scrivi(`Partecipanti: ${p.partecipanti.map((b) => `${b.nome} ${b.cognome}, ${b.eta} anni`).join('; ')}`, 10);
  if (p.createdAt) scrivi(`Data firma: ${p.createdAt.toDate().toLocaleString('it-IT')}`, 10);
  y += 3;
  scrivi('Informativa privacy', 12, 'bold');
  scrivi(testoSemplice(testiCorrenti().informativaPrivacy), 9.5);
  scrivi('Presa visione: sì', 10, 'bold');
  if (p.consensi.liberatoriaFoto !== null) {
    y += 2;
    scrivi('Liberatoria foto e video', 12, 'bold');
    scrivi(testoSemplice(testiCorrenti().liberatoriaFoto), 9.5);
    scrivi(`Scelta: ${p.consensi.liberatoriaFoto ? 'ACCONSENTO' : 'NON ACCONSENTO'}`, 10, 'bold');
  }
  if (p.firma) {
    y += 4;
    scrivi('Firma', 11, 'bold');
    pdf.addImage(p.firma, 'PNG', 15, y, 80, 30);
  }
  pdf.save(`documenti-firmati-${p.cognome.toLowerCase()}-${p.id}.pdf`);
}
