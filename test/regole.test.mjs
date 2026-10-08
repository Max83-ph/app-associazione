// Test delle regole Firestore sull'emulatore: npx firebase emulators:exec --only firestore "node --test test/"
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';

let env;
const SOCIO = { nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01L750X', stato: 'attivo' };
const FIRMA = 'data:image/png;base64,' + 'A'.repeat(500);
const firma = (uid, extra = {}) => ({
  documentoId: 'doc1', uid, nome: 'Mario', cognome: 'Rossi', codiceFiscale: 'RSSMRA80A01L750X',
  titolo: 'Regolamento', testo: 'Testo', pdfNome: null, versione: 1, firma: FIRMA, firmatoIl: serverTimestamp(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-regole', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'users/org'), { ruolo: 'organizzatore', email: 'o@x.it', nome: 'O' });
    await setDoc(doc(db, 'soci/mario'), { ...SOCIO, uid: 'mario' });
    await setDoc(doc(db, 'soci/attesa'), { ...SOCIO, uid: 'attesa', stato: 'in_attesa' });
    await setDoc(doc(db, 'documenti/doc1'), { titolo: 'Regolamento', testo: 'Testo', attivo: true, versione: 1 });
    await setDoc(doc(db, 'documenti/nascosto'), { titolo: 'Bozza', testo: 'X', attivo: false, versione: 1 });
  });
});
after(async () => env?.cleanup());

const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@x.it` }) : env.unauthenticatedContext()).firestore();

test('testi: lettura pubblica, scrittura solo organizzatori', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'contenuti/testi')));
  const t = { chiSiamo: 'a', informativaPrivacy: 'b', liberatoriaFoto: 'c', informativaSoci: 'd', liberatoriaSoci: 'e', contatti: {} };
  await assertFails(setDoc(doc(db('mario'), 'contenuti/testi'), t));
  await assertSucceeds(setDoc(doc(db('org'), 'contenuti/testi'), t));
});

test('documenti: il socio attivo vede solo quelli visibili', async () => {
  await assertSucceeds(getDocs(query(collection(db('mario'), 'documenti'), where('attivo', '==', true))));
  await assertFails(getDoc(doc(db('mario'), 'documenti/nascosto')));
  await assertFails(getDoc(doc(db('attesa'), 'documenti/doc1')));
  await assertFails(setDoc(doc(db('mario'), 'documenti/nuovo'), { titolo: 'x', attivo: true, versione: 1 }));
});

test('firme: il socio firma per sé, con i suoi dati e la versione attuale', async () => {
  await assertFails(setDoc(doc(db('mario'), 'firme/doc1_mario'), firma('mario', { nome: 'Luigi' })));
  await assertFails(setDoc(doc(db('mario'), 'firme/doc1_mario'), firma('mario', { versione: 2 })));
  await assertFails(setDoc(doc(db('mario'), 'firme/doc1_altro'), firma('mario')));
  await assertFails(setDoc(doc(db('attesa'), 'firme/doc1_attesa'), firma('attesa')));
  await assertFails(setDoc(doc(db('mario'), 'firme/nascosto_mario'), firma('mario', { documentoId: 'nascosto', titolo: 'Bozza', testo: 'X' })));
  await assertSucceeds(setDoc(doc(db('mario'), 'firme/doc1_mario'), firma('mario')));
  await assertFails(setDoc(doc(db('mario'), 'firme/doc1_mario'), firma('mario')));
  await assertSucceeds(getDocs(query(collection(db('mario'), 'firme'), where('uid', '==', 'mario'))));
  await assertFails(getDoc(doc(db('attesa'), 'firme/doc1_mario')));
  await assertSucceeds(getDocs(query(collection(db('org'), 'firme'), where('documentoId', '==', 'doc1'))));
});

test('iscrizione soci senza codice', async () => {
  const r = {
    uid: 'nuovo', nome: 'Anna', cognome: 'Bianchi', dataNascita: '1990-01-01', luogoNascita: 'Vercelli',
    codiceFiscale: 'BNCNNA90A41L750X', residenza: { indirizzo: 'Via Roma 1', cap: '13100', comune: 'Vercelli', provincia: 'VC' },
    email: 'nuovo@x.it', cellulare: '3331234567', consensi: { privacy: true, liberatoriaFoto: false, whatsapp: false, mailingList: false },
    firma: FIRMA, firmatoIl: serverTimestamp(), stato: 'in_attesa', tessere: {}, note: '', creatoDa: 'socio',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(db('nuovo'), 'soci/nuovo'), r));
  await assertFails(setDoc(doc(db('nuovo2'), 'soci/nuovo2'), { ...r, uid: 'nuovo2', stato: 'attivo' }));
});
