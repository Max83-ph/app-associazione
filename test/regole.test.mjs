// Test delle regole Firestore sull'emulatore: npx firebase emulators:exec --only firestore "node --test test/regole.test.mjs"
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, query, where, serverTimestamp, getCountFromServer, writeBatch, increment, Timestamp } from 'firebase/firestore';

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
    await setDoc(doc(db, 'file/pub'), { nome: 'a.jpg', tipo: 'image/jpeg', parti: 1, visibilita: 'pubblico', completo: true });
    await setDoc(doc(db, 'file/pub/parti/0'), { dati: 'AAAA' });
    await setDoc(doc(db, 'file/priv'), { nome: 'v.pdf', tipo: 'application/pdf', parti: 1, visibilita: 'soci', completo: true });
    await setDoc(doc(db, 'file/priv/parti/0'), { dati: 'AAAA' });
    await setDoc(doc(db, 'pagine/aperta'), { titolo: 'Storia', visibilita: 'pubblica' });
    await setDoc(doc(db, 'pagine/riservata'), { titolo: 'Verbali', visibilita: 'soci' });
    await setDoc(doc(db, 'archivio/a1'), { titolo: 'Statuto', cartella: 'Statuto' });
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

const richiesta = (uid, extra = {}) => ({
  uid, nome: 'Anna', cognome: 'Bianchi', dataNascita: '1990-01-01', luogoNascita: 'Vercelli',
  codiceFiscale: 'BNCNNA90A41L750X', residenza: { indirizzo: 'Via Roma 1', cap: '13100', comune: 'Vercelli', provincia: 'VC' },
  email: `${uid}@x.it`, cellulare: '3331234567', consensi: { privacy: true, liberatoriaFoto: false, whatsapp: false, mailingList: false },
  firma: FIRMA, firmatoIl: serverTimestamp(), stato: 'in_attesa', tessere: {}, note: '', creatoDa: 'socio',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const impostaModo = (modo) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'contenuti/iscrizione'), { modo }));

test('iscrizione soci: aperte, solo con codice, chiuse', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'codiciIscrizione/CAPPU2026'), { attivo: true });
    await setDoc(doc(c.firestore(), 'codiciIscrizione/VECCHIO'), { attivo: false });
  });
  // Nessuna scelta salvata: aperte.
  await assertSucceeds(setDoc(doc(db('n1'), 'soci/n1'), richiesta('n1')));
  await assertFails(setDoc(doc(db('n2'), 'soci/n2'), richiesta('n2', { stato: 'attivo' })));

  await impostaModo('codice');
  await assertFails(setDoc(doc(db('n3'), 'soci/n3'), richiesta('n3')));
  await assertFails(setDoc(doc(db('n3'), 'soci/n3'), richiesta('n3', { codiceIscrizione: 'SBAGLIATO' })));
  await assertFails(setDoc(doc(db('n3'), 'soci/n3'), richiesta('n3', { codiceIscrizione: 'VECCHIO' })));
  await assertSucceeds(setDoc(doc(db('n3'), 'soci/n3'), richiesta('n3', { codiceIscrizione: 'CAPPU2026' })));

  await impostaModo('chiuse');
  await assertFails(setDoc(doc(db('n4'), 'soci/n4'), richiesta('n4', { codiceIscrizione: 'CAPPU2026' })));
  await assertSucceeds(setDoc(doc(db('org'), 'soci/manuale'), richiesta('manuale', { creatoDa: 'admin' })));
  // Socio inserito a mano, firmato su carta, senza email né cellulare.
  await assertSucceeds(setDoc(doc(db('org'), 'soci/carta'), richiesta(null, { creatoDa: 'admin', stato: 'attivo', firma: null, firmatoIl: null, email: '', cellulare: '', moduloCartaceo: [] })));
  await assertFails(setDoc(doc(db('mario'), 'soci/carta2'), richiesta(null, { creatoDa: 'admin', stato: 'attivo', firma: null })));

  await impostaModo('aperte');
  await assertSucceeds(setDoc(doc(db('n5'), 'soci/n5'), richiesta('n5')));
});

test('modalità iscrizione: la legge chiunque, la cambiano solo gli organizzatori', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'contenuti/iscrizione')));
  await assertFails(setDoc(doc(db('mario'), 'contenuti/iscrizione'), { modo: 'aperte' }));
  await assertFails(setDoc(doc(db('org'), 'contenuti/iscrizione'), { modo: 'forse' }));
  await assertSucceeds(setDoc(doc(db('org'), 'contenuti/iscrizione'), { modo: 'codice' }));
  await impostaModo('aperte');
});

test('file: pubblici a tutti, riservati solo a soci attivi e staff', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'file/pub')));
  await assertSucceeds(getDoc(doc(db(null), 'file/pub/parti/0')));
  await assertFails(getDoc(doc(db(null), 'file/priv')));
  await assertFails(getDoc(doc(db(null), 'file/priv/parti/0')));
  await assertFails(getDoc(doc(db('attesa'), 'file/priv/parti/0')));
  await assertSucceeds(getDoc(doc(db('mario'), 'file/priv/parti/0')));
  await assertFails(setDoc(doc(db('mario'), 'file/x'), { visibilita: 'soci', parti: 1 }));
  await assertSucceeds(setDoc(doc(db('org'), 'file/x'), { visibilita: 'soci', parti: 1 }));
  await assertSucceeds(setDoc(doc(db('org'), 'file/x/parti/0'), { dati: 'AAAA' }));
});

test('pagine e archivio', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'pagine/aperta')));
  await assertSucceeds(getDoc(doc(db(null), 'pagine/home')));
  await assertSucceeds(getDocs(query(collection(db(null), 'pagine'), where('visibilita', '==', 'pubblica'))));
  await assertFails(getDoc(doc(db(null), 'pagine/riservata')));
  await assertSucceeds(getDoc(doc(db('mario'), 'pagine/riservata')));
  await assertSucceeds(getDocs(query(collection(db('mario'), 'pagine'), where('visibilita', '==', 'soci'))));
  await assertFails(setDoc(doc(db('mario'), 'pagine/aperta'), { titolo: 'x', visibilita: 'pubblica' }));
  await assertSucceeds(setDoc(doc(db('org'), 'pagine/nuova'), { titolo: 'x', visibilita: 'soci' }));
  await assertFails(getDocs(collection(db('attesa'), 'archivio')));
  await assertSucceeds(getDocs(collection(db('mario'), 'archivio')));
  await assertFails(setDoc(doc(db('mario'), 'archivio/x'), { titolo: 'x' }));
});

test('comunicazioni con codice: si leggono solo conoscendo il codice', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'comunicazioni/ABCD2345XY'), { titolo: 'Figuranti', attiva: true });
    await setDoc(doc(d, 'comunicazioni/ABCD2345XY/messaggi/m1'), { testo: 'Prova abiti giovedì' });
    await setDoc(doc(d, 'comunicazioni/CHIUSA2345'), { titolo: 'Vecchia', attiva: false });
    await setDoc(doc(d, 'comunicazioni/CHIUSA2345/messaggi/m1'), { testo: 'x' });
    await setDoc(doc(d, 'file/lnk'), { nome: 'a.pdf', visibilita: 'link', parti: 1 });
    await setDoc(doc(d, 'file/lnk/parti/0'), { dati: 'AAAA' });
  });
  await assertSucceeds(getDoc(doc(db(null), 'comunicazioni/ABCD2345XY')));
  await assertSucceeds(getDocs(collection(db(null), 'comunicazioni/ABCD2345XY/messaggi')));
  await assertFails(getDocs(collection(db(null), 'comunicazioni')));
  await assertFails(getDocs(collection(db('mario'), 'comunicazioni')));
  await assertFails(getDoc(doc(db(null), 'comunicazioni/CHIUSA2345')));
  await assertFails(getDocs(collection(db(null), 'comunicazioni/CHIUSA2345/messaggi')));
  await assertFails(setDoc(doc(db(null), 'comunicazioni/ABCD2345XY/messaggi/m2'), { testo: 'spam' }));
  await assertFails(setDoc(doc(db('org'), 'comunicazioni/CORTO'), { titolo: 'x', attiva: true }));
  await assertSucceeds(setDoc(doc(db('org'), 'comunicazioni/NUOVA23456'), { titolo: 'Cucina', attiva: true }));
  await assertSucceeds(getDocs(collection(db('org'), 'comunicazioni')));
  // File "link": si leggono con l'ID, ma non si possono elencare.
  await assertSucceeds(getDoc(doc(db(null), 'file/lnk')));
  await assertSucceeds(getDoc(doc(db(null), 'file/lnk/parti/0')));
  await assertFails(getDocs(query(collection(db(null), 'file'), where('visibilita', '==', 'link'))));
  await assertSucceeds(getDocs(query(collection(db(null), 'file'), where('visibilita', '==', 'pubblico'))));
});

test('configurazione email: solo organizzatori e solo URL di Apps Script', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'contenuti/email')));
  await assertFails(setDoc(doc(db('mario'), 'contenuti/email'), { url: 'https://script.google.com/macros/s/abc/exec' }));
  await assertFails(setDoc(doc(db('org'), 'contenuti/email'), { url: 'https://cattivo.example.com/exec' }));
  await assertSucceeds(setDoc(doc(db('org'), 'contenuti/email'), { url: 'https://script.google.com/macros/s/AKfy_cb-123/exec' }));
  await assertSucceeds(setDoc(doc(db('org'), 'contenuti/email'), { url: '' }));
});

test('pulizia dati: solo gli organizzatori contano e cancellano le prenotazioni', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'bookings/VECCHIO12345'), { eventId: 'evVecchio', nome: 'A', statoBiglietto: 'valido' });
  });
  const q = (d) => query(collection(d, 'bookings'), where('eventId', '==', 'evVecchio'));
  await assertFails(getCountFromServer(q(db(null))));
  await assertFails(getCountFromServer(q(db('mario'))));
  await assertSucceeds(getCountFromServer(q(db('org'))));
  await assertFails(deleteDoc(doc(db('mario'), 'bookings/VECCHIO12345')));
  await assertSucceeds(deleteDoc(doc(db('org'), 'bookings/VECCHIO12345')));
  // Testi: si può salvare anche la pagina Privacy e cookie.
  const t = { chiSiamo: 'a', informativaPrivacy: 'b', liberatoriaFoto: 'c', informativaSoci: 'd', liberatoriaSoci: 'e', privacySito: 'f', contatti: {} };
  await assertSucceeds(setDoc(doc(db('org'), 'contenuti/testi'), t));
});

test('registro pulizie: solo organizzatori, voci non modificabili', async () => {
  await assertFails(setDoc(doc(db('mario'), 'registroPulizie/r1'), { prenotazioni: 3 }));
  await assertSucceeds(setDoc(doc(db('org'), 'registroPulizie/r1'), { prenotazioni: 3 }));
  await assertFails(setDoc(doc(db('org'), 'registroPulizie/r1'), { prenotazioni: 0 }));
  await assertFails(deleteDoc(doc(db('org'), 'registroPulizie/r1')));
  await assertFails(getDocs(collection(db('mario'), 'registroPulizie')));
  await assertSucceeds(getDocs(collection(db('org'), 'registroPulizie')));
});

test('asporto con ordine dal menù: righe e totale solo per l\'asporto', async () => {
  const data = Timestamp.fromMillis(Date.now() + 10 * 86400000);
  const inizioGiorno = Timestamp.fromMillis(Date.now() + 9 * 86400000);
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'events/evMenu'), {
      titolo: 'Pranzo', data, tipo: 'pasto', stato: 'aperto', visibile: true, chiusuraIscrizioni: null,
      postiMax: 50, postiOccupati: 0, asportoAttivo: true, porzioniPrenotate: 0, porzioniMaxGiornoEvento: 20, inizioGiorno,
      documentiRichiesti: { privacy: true, liberatoriaFoto: false },
    });
  });
  const ordine = [{ id: 'a1', nome: 'Agnolotti', prezzo: 800, quantita: 2, porzione: true }, { id: 'b1', nome: 'Acqua', prezzo: 100, quantita: 1, porzione: false }];
  const prenota = (code, extra) => {
    const d = db(null);
    const b = writeBatch(d);
    const q = extra.quantita ?? 2;
    b.set(doc(d, `bookings/${code}`), {
      eventId: 'evMenu', eventoTitolo: 'Pranzo', eventoData: data, modalita: 'asporto', nome: 'Anna', cognome: 'Bianchi',
      email: 'a@b.it', quantita: q, partecipanti: [], consensi: { privacy: true, liberatoriaFoto: null }, firma: null,
      statoBiglietto: 'valido', checkInAt: null, createdAt: serverTimestamp(),
      pagamento: { stato: 'da_pagare', importo: null, metodo: null, riferimentoTransazione: null }, ...extra,
    });
    const tavolo = extra.modalita === 'tavolo';
    b.update(doc(d, 'events/evMenu'), {
      ultimaPrenotazione: code,
      ...(tavolo ? { postiOccupati: increment(q) } : { porzioniPrenotate: increment(q) }),
    });
    return b.commit();
  };
  await assertSucceeds(prenota('MENUOK123456', { ordine, totale: 1700 }));
  await assertFails(prenota('MENUKO123456', { ordine, totale: 1700, modalita: 'tavolo' }));
  await assertFails(prenota('MENUKO223456', { totale: 1700 }));
  await assertFails(prenota('MENUKO323456', { ordine: [], totale: 0 }));
  await assertFails(prenota('MENUKO423456', { ordine, totale: '17' }));
  // Lo staff segna il pagamento con l'importo incassato.
  await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users/staff1'), { ruolo: 'staff', email: 's@x.it', nome: 'S' }));
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(db('staff1'), 'bookings/MENUOK123456'), { 'pagamento.stato': 'pagato_in_loco', 'pagamento.metodo': 'in_loco', 'pagamento.importo': 1700 }));
});
