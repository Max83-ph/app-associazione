// Archivio file per i soci (statuto, verbali, moduli…), diviso in cartelle.
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { eliminaFile, type RifFile } from './file';
import type { Timestamp } from 'firebase/firestore';

export interface VoceArchivio {
  id: string;
  cartella: string;
  titolo: string;
  descrizione: string;
  file: RifFile;
  createdAt: Timestamp;
}

const archivio = collection(db, 'archivio');

export function ascoltaArchivio(cb: (l: VoceArchivio[]) => void, err: (e: Error) => void) {
  return onSnapshot(
    archivio,
    (s) =>
      cb(
        s.docs
          .map((d) => ({ id: d.id, ...d.data() }) as VoceArchivio)
          .sort((a, b) => a.cartella.localeCompare(b.cartella, 'it') || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
      ),
    err,
  );
}

/** Raggruppa per cartella, in ordine alfabetico ("Generale" per le voci senza cartella). */
export function perCartella(l: VoceArchivio[]): [string, VoceArchivio[]][] {
  const m = new Map<string, VoceArchivio[]>();
  l.forEach((v) => {
    const c = v.cartella || 'Generale';
    m.set(c, [...(m.get(c) ?? []), v]);
  });
  return [...m.entries()];
}

export async function salvaVoce(id: string | null, v: Omit<VoceArchivio, 'id' | 'createdAt'>, autore: string, filePrima?: RifFile) {
  const dati = { cartella: v.cartella.trim(), titolo: v.titolo.trim(), descrizione: v.descrizione.trim(), file: v.file };
  if (id) await updateDoc(doc(archivio, id), { ...dati, modificatoIl: serverTimestamp() });
  else await addDoc(archivio, { ...dati, autore, createdAt: serverTimestamp() });
  if (filePrima && filePrima.id !== v.file.id) await eliminaFile(filePrima.id).catch(() => undefined);
}

export async function eliminaVoce(v: VoceArchivio) {
  await deleteDoc(doc(archivio, v.id));
  await eliminaFile(v.file.id).catch(() => undefined);
}
