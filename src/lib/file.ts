// Archivio file sul piano gratuito Firebase (niente Storage): ogni file è salvato
// in Firestore, spezzato in parti da ~700 KB (un documento non può superare 1 MB).
//   file/{id}            → nome, tipo, dimensione, numero di parti, visibilità
//   file/{id}/parti/{n}  → { dati: base64 }
// Le foto vengono ridotte a 1600 px in JPEG prima del caricamento.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/** pubblico: chiunque; soci: soci attivi e staff; link: chi conosce il file (pagine comunicazioni con codice). */
export type Visibilita = 'pubblico' | 'soci' | 'link';

export interface RifFile {
  id: string;
  nome: string;
  tipo: string;
  dimensione: number;
}

const PARTE = 700_000; // caratteri base64 per parte
export const MAX_FILE_BYTE = 8 * 1024 * 1024;
const fileCol = collection(db, 'file');

export const isImmagine = (tipo: string) => tipo.startsWith('image/');

export function dimensioneLeggibile(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Riduce una foto a max 1600 px di lato, JPEG. GIF e SVG restano come sono. */
async function preparaImmagine(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const max = 1600;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
  return out && out.size < file.size ? out : file;
}

function inBase64(b: Blob): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => { const s = r.result as string; ok(s.slice(s.indexOf(',') + 1)); };
    r.onerror = () => ko(r.error);
    r.readAsDataURL(b);
  });
}

export class ErroreFile extends Error {}

/** Carica un file e restituisce il riferimento da salvare nell'avviso, evento, pagina… */
export async function caricaFile(file: File, visibilita: Visibilita, autore: string, avanzamento?: (p: number) => void): Promise<RifFile> {
  const immagine = isImmagine(file.type);
  const blob = immagine ? await preparaImmagine(file) : file;
  if (blob.size > MAX_FILE_BYTE) {
    throw new ErroreFile(`"${file.name}" è troppo grande (${dimensioneLeggibile(blob.size)}): il massimo è ${dimensioneLeggibile(MAX_FILE_BYTE)}.`);
  }
  const tipo = blob.type || file.type || 'application/octet-stream';
  const nome = immagine && tipo === 'image/jpeg' && !/\.jpe?g$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
  const dati = await inBase64(blob);
  const n = Math.max(1, Math.ceil(dati.length / PARTE));
  const rif = doc(fileCol);
  // Prima i metadati (incompleti), poi le parti, infine il segno "completo".
  await setDoc(rif, { nome, tipo, dimensione: blob.size, parti: n, visibilita, completo: false, caricatoDa: autore, createdAt: serverTimestamp() });
  try {
    for (let i = 0; i < n; i++) {
      await setDoc(doc(rif, 'parti', String(i)), { dati: dati.slice(i * PARTE, (i + 1) * PARTE) });
      avanzamento?.((i + 1) / n);
    }
    await updateDoc(rif, { completo: true });
  } catch (e) {
    await eliminaFile(rif.id).catch(() => undefined);
    throw e;
  }
  return { id: rif.id, nome, tipo, dimensione: blob.size };
}

const cache = new Map<string, Promise<Blob>>();

async function scaricaBlob(id: string): Promise<Blob> {
  const meta = await getDoc(doc(fileCol, id));
  if (!meta.exists()) throw new ErroreFile('File non trovato.');
  const m = meta.data() as { tipo: string; parti: number; completo: boolean };
  if (!m.completo) throw new ErroreFile('File non ancora caricato del tutto.');
  const parti = await Promise.all(Array.from({ length: m.parti }, (_, i) => getDoc(doc(fileCol, id, 'parti', String(i)))));
  const b64 = parti.map((p) => (p.data()?.dati as string) ?? '').join('');
  const bin = atob(b64);
  const byte = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) byte[i] = bin.charCodeAt(i);
  return new Blob([byte], { type: m.tipo });
}

/** Legge il file (con cache in memoria per la sessione). */
export function leggiFile(id: string): Promise<Blob> {
  let p = cache.get(id);
  if (!p) {
    p = scaricaBlob(id);
    cache.set(id, p);
    p.catch(() => cache.delete(id));
  }
  return p;
}

export async function apriFile(f: RifFile, scaricare = false) {
  // La finestra si apre subito (iPhone blocca le finestre aperte dopo un'attesa).
  const finestra = scaricare ? null : window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await leggiFile(f.id));
    if (finestra) {
      finestra.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = f.nome;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (e) {
    finestra?.close();
    throw e;
  }
}

export async function eliminaFile(id: string) {
  cache.delete(id);
  const parti = await getDocs(collection(fileCol, id, 'parti'));
  const b = writeBatch(db);
  parti.docs.forEach((p) => b.delete(p.ref));
  await b.commit();
  await deleteDoc(doc(fileCol, id));
}

/** Elimina i file che non sono più usati (ignora gli errori: al massimo resta un file orfano). */
export async function eliminaFiles(ids: string[]) {
  await Promise.all(ids.map((id) => eliminaFile(id).catch(() => undefined)));
}
