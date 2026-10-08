// Documenti da firmare in app: gli organizzatori li pubblicano (testo e/o PDF),
// i soci attivi li firmano con il dito dall'Area soci.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  addDoc,
  increment,
} from 'firebase/firestore';
import type { jsPDF as JsPDF } from 'jspdf';
import { db } from '../firebase';
import { NOME_ASSOCIAZIONE } from '../config';
import type { DocumentoFirma, FirmaDocumento, Socio } from '../types';

const documenti = collection(db, 'documenti');
const firme = collection(db, 'firme');
const conId = <T,>(id: string, data: unknown) => ({ id, ...(data as object) }) as T;

/** Limite del PDF allegato: il documento Firestore non può superare 1 MB. */
export const MAX_PDF_BYTE = 650 * 1024;

// ---------- Lettura ----------

export function ascoltaDocumentiAttivi(cb: (d: DocumentoFirma[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    query(documenti, where('attivo', '==', true)),
    (s) => cb(s.docs.map((d) => conId<DocumentoFirma>(d.id, d.data())).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))),
    err,
  );
}

export function ascoltaTuttiDocumenti(cb: (d: DocumentoFirma[]) => void, err: (e: Error) => void) {
  return onSnapshot(query(documenti, orderBy('createdAt', 'desc')), (s) => cb(s.docs.map((d) => conId<DocumentoFirma>(d.id, d.data()))), err);
}

export function ascoltaMieFirme(uid: string, cb: (f: FirmaDocumento[]) => void, err: (e: Error) => void) {
  return onSnapshot(query(firme, where('uid', '==', uid)), (s) => cb(s.docs.map((d) => conId<FirmaDocumento>(d.id, d.data()))), err);
}

export function ascoltaFirmeDocumento(documentoId: string, cb: (f: FirmaDocumento[]) => void, err: (e: Error) => void) {
  return onSnapshot(query(firme, where('documentoId', '==', documentoId)), (s) => cb(s.docs.map((d) => conId<FirmaDocumento>(d.id, d.data()))), err);
}

/** Una firma vale solo se fatta sulla versione attuale del documento. */
export const firmaValida = (f: FirmaDocumento | undefined, d: DocumentoFirma) => !!f && f.versione === d.versione;

// ---------- Organizzatori ----------

export interface DatiDocumento {
  titolo: string;
  testo: string;
  pdf: string | null;
  pdfNome: string | null;
  attivo: boolean;
}

/**
 * Crea o aggiorna un documento. Se cambiano testo o PDF la versione sale:
 * le firme raccolte prima restano archiviate ma ai soci viene chiesto di firmare di nuovo.
 */
export async function salvaDocumento(id: string | null, d: DatiDocumento, contenutoCambiato: boolean, autore: string) {
  const dati = { titolo: d.titolo.trim(), testo: d.testo.trim(), pdf: d.pdf, pdfNome: d.pdfNome, attivo: d.attivo, autore, aggiornatoIl: serverTimestamp() };
  if (!id) {
    await addDoc(documenti, { ...dati, versione: 1, createdAt: serverTimestamp() });
    return;
  }
  await updateDoc(doc(documenti, id), contenutoCambiato ? { ...dati, versione: increment(1) } : dati);
}

export async function eliminaDocumento(id: string) {
  const s = await getDocs(query(firme, where('documentoId', '==', id)));
  const b = writeBatch(db);
  s.docs.forEach((d) => b.delete(d.ref));
  b.delete(doc(documenti, id));
  await b.commit();
}

export async function eliminaFirma(id: string) {
  await deleteDoc(doc(firme, id));
}

export function leggiPdfComeDataUrl(file: File): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(file);
  });
}

// ---------- Il socio firma ----------

export async function firmaDocumento(d: DocumentoFirma, s: Socio, uid: string, firmaPng: string) {
  await setDoc(doc(firme, `${d.id}_${uid}`), {
    documentoId: d.id,
    uid,
    nome: s.nome,
    cognome: s.cognome,
    codiceFiscale: s.codiceFiscale,
    titolo: d.titolo,
    testo: d.testo,
    pdfNome: d.pdfNome ?? null,
    versione: d.versione,
    firma: firmaPng,
    firmatoIl: serverTimestamp(),
  });
}

// ---------- PDF firmato ----------

function scarica(dati: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(dati);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const nomeFile = (t: string) => t.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento';

/** Pagina con il testo del documento (se c'è) e la firma. */
function paginaFirma(pdf: JsPDF, f: FirmaDocumento, documentoModificato: boolean) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  let y = 20;
  const scrivi = (testo: string, size = 10, stile: 'normal' | 'bold' = 'normal', spazio = 2.5) => {
    pdf.setFont('helvetica', stile);
    pdf.setFontSize(size);
    const righe = pdf.splitTextToSize(testo, w - 30) as string[];
    for (const riga of righe) {
      if (y + size * 0.42 > h - 15) { pdf.addPage(); y = 20; }
      pdf.text(riga, 15, y);
      y += size * 0.42;
    }
    y += spazio;
  };
  pdf.setFillColor(242, 194, 48);
  pdf.rect(0, 0, w, 2.5, 'F');
  pdf.setFillColor(30, 107, 69);
  pdf.rect(0, 2.5, w, 2.5, 'F');
  scrivi(NOME_ASSOCIAZIONE, 14, 'bold', 1);
  scrivi(f.titolo, 12, 'bold', 5);
  if (f.testo) scrivi(f.testo, 10, 'normal', 5);
  if (f.pdfNome) scrivi(`Il firmatario dichiara di aver letto il documento allegato "${f.pdfNome}"${f.testo ? '' : ', riportato nelle pagine precedenti'}.`, 10, 'normal', 5);
  if (documentoModificato) scrivi('Attenzione: il documento è stato modificato dopo questa firma. Le pagine allegate sono quelle della versione attuale.', 9, 'bold', 4);
  scrivi(`Firmatario: ${f.nome} ${f.cognome}${f.codiceFiscale ? `, codice fiscale ${f.codiceFiscale}` : ''}`, 10, 'normal', 1);
  scrivi(`Firmato nell'app il ${f.firmatoIl?.toDate().toLocaleString('it-IT') ?? ''} (versione ${f.versione} del documento)`, 10, 'normal', 4);
  if (y + 40 > h - 15) { pdf.addPage(); y = 20; }
  scrivi('Firma', 11, 'bold', 1);
  pdf.addImage(f.firma, 'PNG', 15, y, 80, 30);
}

/** Scarica la copia firmata: PDF allegato (se c'è) + pagina con testo e firma. */
export async function scaricaCopiaFirmata(f: FirmaDocumento, d: DocumentoFirma | undefined) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  paginaFirma(pdf, f, !!d && d.versione !== f.versione);
  const nome = `${nomeFile(f.titolo)}-${nomeFile(`${f.cognome} ${f.nome}`)}.pdf`;
  if (!d?.pdf) {
    pdf.save(nome);
    return;
  }
  const { PDFDocument } = await import('pdf-lib');
  const finale = await PDFDocument.load(d.pdf.slice(d.pdf.indexOf(',') + 1));
  const firma = await PDFDocument.load(pdf.output('arraybuffer'));
  (await finale.copyPages(firma, firma.getPageIndices())).forEach((p) => finale.addPage(p));
  scarica(new Blob([await finale.save() as BlobPart], { type: 'application/pdf' }), nome);
}

/** Tutte le firme di un documento in un unico PDF (una sezione per firmatario). */
export async function scaricaTutteLeFirme(lista: FirmaDocumento[], d: DocumentoFirma) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  lista.forEach((f, i) => {
    if (i) pdf.addPage();
    paginaFirma(pdf, f, d.versione !== f.versione);
  });
  pdf.save(`firme-${nomeFile(d.titolo)}.pdf`);
}

/** Apre il PDF allegato in una nuova scheda. */
export function apriPdf(d: DocumentoFirma) {
  if (!d.pdf) return;
  const byte = Uint8Array.from(atob(d.pdf.slice(d.pdf.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([byte], { type: 'application/pdf' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
