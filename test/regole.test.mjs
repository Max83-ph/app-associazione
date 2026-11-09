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

test('iscritti inseriti a mano: li crea l\'organizzatore, lo staff completa firme all\'ingresso', async () => {
  const data = Timestamp.fromMillis(Date.now() + 3 * 86400000);
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'events/evLab'), {
      titolo: 'Laboratorio', data, tipo: 'laboratorio', pubblico: 'bambini', stato: 'aperto', visibile: true,
      postiMax: 20, postiOccupati: 0, asportoAttivo: false, porzioniPrenotate: 0, documentiRichiesti: { privacy: true, liberatoriaFoto: true },
    });
    await setDoc(doc(c.firestore(), 'users/staff2'), { ruolo: 'staff', email: 's2@x.it', nome: 'S' });
  });
  const manuale = {
    eventId: 'evLab', eventoTitolo: 'Laboratorio', eventoData: data, modalita: 'partecipazione', nome: 'Luca', cognome: 'Verdi',
    email: '', telefono: '333', note: '', quantita: 2, partecipanti: [{ nome: '', cognome: 'Verdi', eta: 6 }, { nome: '', cognome: 'Verdi', eta: 8 }],
    consensi: { privacy: false, liberatoriaFoto: null }, firma: null, statoBiglietto: 'valido', checkInAt: null, createdAt: serverTimestamp(),
    pagamento: { stato: 'da_pagare', importo: null, metodo: null, riferimentoTransazione: null }, manuale: true, daCompletare: true, inseritaDa: 'o@x.it',
  };
  await assertFails(setDoc(doc(db(null), 'bookings/MANUALE00001'), manuale));
  await assertFails(setDoc(doc(db('staff2'), 'bookings/MANUALE00001'), manuale));
  await assertSucceeds(setDoc(doc(db('org'), 'bookings/MANUALE00001'), manuale));
  const { updateDoc } = await import('firebase/firestore');
  const ref = doc(db('staff2'), 'bookings/MANUALE00001');
  await assertFails(updateDoc(ref, { quantita: 5 }));
  await assertSucceeds(updateDoc(ref, {
    partecipanti: [{ nome: 'Anna', cognome: 'Verdi', eta: 6 }, { nome: 'Bea', cognome: 'Verdi', eta: 8 }],
    consensi: { privacy: true, liberatoriaFoto: true }, firma: FIRMA, daCompletare: false, completataAt: serverTimestamp(),
    statoBiglietto: 'usato', checkInAt: serverTimestamp(),
  }));
  // Le prenotazioni fatte dall'app restano modificabili dallo staff solo per ingresso e pagamento.
  await assertFails(updateDoc(doc(db('staff2'), 'bookings/MENUOK123456'), { firma: FIRMA }));
});

test('carnevale: iscrizione con prova, posti dello slot, doppioni e staff', async () => {
  const ora = Timestamp.fromMillis(Date.now() + 5 * 86400000);
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, 'contenuti/carnevale'), { aperte: true, quotaAdulto: 5000, quotaBambino: 3000, anticipo: 2000, etaBambino: 14, slotMinuti: 10, postiSlot: 5, sfilate: '', luogoProve: '' });
    await setDoc(doc(d, 'proveCarnevale/g1'), { data: ora, giorno: '2026-11-21', dalle: '15:00', alle: '18:00', slotMinuti: 10, postiSlot: 5, prenotati: { h1540: 3 } });
    await setDoc(doc(d, 'users/staffc'), { ruolo: 'staff', email: 'sc@x.it', nome: 'S' });
  });
  const persona = (cf, bambino = false) => ({ nome: 'A', cognome: 'Rossi', dataNascita: bambino ? '2018-01-01' : '1980-01-01', luogoNascita: 'Vercelli', codiceFiscale: cf, bambino });
  const iscrivi = (code, persone, { prova = true, totale, ora = '15:40', occupati = 3, extra = {} } = {}) => {
    const d = db(null);
    const b = writeBatch(d);
    const na = persone.filter((p) => !p.bambino).length;
    const nb = persone.length - na;
    if (prova) b.update(doc(d, 'proveCarnevale/g1'), { [`prenotati.h${ora.replace(':', '')}`]: occupati + persone.length, ultimaPrenotazione: code });
    b.set(doc(d, `iscrizioniCarnevale/${code}`), {
      persone, cfs: persone.map((p) => p.codiceFiscale), numAdulti: na, numBambini: nb,
      referente: { indirizzo: 'Via X 1', cellulare: '3400000000', email: 'a@b.it' },
      consensi: { privacy: true, liberatoriaFoto: true }, firma: FIRMA,
      prova: prova ? { giornata: 'g1', ora, data: ora === '15:40' ? Timestamp.now() : Timestamp.now() } : null,
      stato: 'valido', createdAt: serverTimestamp(), totale: totale ?? 0, pagato: 0, movimenti: [], provato: false, consegnato: false, ...extra,
    });
    for (const p of persone) b.set(doc(d, `cfCarnevale/${p.codiceFiscale}`), { codice: code });
    return b.commit();
  };
  // Due persone in uno slot con 3 occupati su 5: ok.
  await assertSucceeds(iscrivi('CARNAAAAAAA2', [persona('RSSAAA80A01L750A'), persona('RSSBBB18A01L750B', true)]));
  // Slot ormai pieno (5/5): rifiutata.
  await assertFails(iscrivi('CARNBBBBBBB2', [persona('RSSCCC80A01L750C')], { occupati: 5 }));
  // Totale impostato da chi si iscrive (si decide alla prova): rifiutata.
  await assertFails(iscrivi('CARNCCCCCCC2', [persona('RSSDDD80A01L750D')], { prova: false, totale: 100 }));
  // Codice fiscale già iscritto: rifiutata.
  await assertFails(iscrivi('CARNDDDDDDD2', [persona('RSSAAA80A01L750A')], { prova: false }));
  // Senza prova: ok; poi la prenota dal link.
  await assertSucceeds(iscrivi('CARNEEEEEEE2', [persona('RSSEEE80A01L750E')], { prova: false }));
  const d = db(null);
  const b = writeBatch(d);
  b.update(doc(d, 'proveCarnevale/g1'), { 'prenotati.h1550': 1, ultimaPrenotazione: 'CARNEEEEEEE2' });
  b.update(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), { prova: { giornata: 'g1', ora: '15:50', data: Timestamp.now() } });
  await assertSucceeds(b.commit());
  // Non si può cambiare la prova già prenotata dal link.
  const b2 = writeBatch(d);
  b2.update(doc(d, 'proveCarnevale/g1'), { 'prenotati.h1600': 1, ultimaPrenotazione: 'CARNEEEEEEE2' });
  b2.update(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), { prova: { giornata: 'g1', ora: '16:00', data: Timestamp.now() } });
  await assertFails(b2.commit());
  // Ora la sposta da 15:50 a 16:00 (stessa giornata): il vecchio slot scende, il nuovo sale.
  const b3 = writeBatch(d);
  b3.update(doc(d, 'proveCarnevale/g1'), { 'prenotati.h1550': 0, 'prenotati.h1600': 1, ultimaPrenotazione: 'CARNEEEEEEE2' });
  b3.update(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), { prova: { giornata: 'g1', ora: '16:00', data: Timestamp.now() } });
  await assertSucceeds(b3.commit());
  // Spostamento che non libera il vecchio slot: rifiutato.
  const b4 = writeBatch(d);
  b4.update(doc(d, 'proveCarnevale/g1'), { 'prenotati.h1610': 1, ultimaPrenotazione: 'CARNEEEEEEE2' });
  b4.update(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), { prova: { giornata: 'g1', ora: '16:10', data: Timestamp.now() } });
  await assertFails(b4.commit());
  // Correzione dei dati dal link: stessa persona, quota ricalcolata, nuovo codice fiscale.
  const b5 = writeBatch(d);
  b5.update(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), {
    persone: [persona('RSSGGG80A01L750G')], cfs: ['RSSGGG80A01L750G'],
    referente: { indirizzo: 'Via Y 2', cellulare: '3401111111', email: 'nuova@b.it' }, modificataAt: serverTimestamp(),
  });
  b5.set(doc(d, 'cfCarnevale/RSSGGG80A01L750G'), { codice: 'CARNEEEEEEE2' });
  await assertSucceeds(b5.commit());
  // Quota truccata nella modifica: rifiutata.
  const { updateDoc: upd } = await import('firebase/firestore');
  await assertFails(upd(doc(d, 'iscrizioniCarnevale/CARNEEEEEEE2'), { totale: 100, modificataAt: serverTimestamp() }));
  // Elenco: solo staff.
  await assertFails(getDocs(collection(db(null), 'iscrizioniCarnevale')));
  await assertSucceeds(getDocs(collection(db('staffc'), 'iscrizioniCarnevale')));
  const { updateDoc } = await import('firebase/firestore');
  await assertSucceeds(updateDoc(doc(db('staffc'), 'iscrizioniCarnevale/CARNAAAAAAA2'), { pagato: 4000, movimenti: [{ tipo: 'anticipo', importo: 4000, at: Timestamp.now(), da: 'sc@x.it' }], provato: true, totale: 8000, numAdulti: 1, numBambini: 1 }));
  await assertFails(updateDoc(doc(db('staffc'), 'iscrizioniCarnevale/CARNAAAAAAA2'), { referente: { indirizzo: 'x', cellulare: 'y', email: 'z' } }));
  // Iscrizioni chiuse: rifiutata.
  await env.withSecurityRulesDisabled(async (c) => updateDoc(doc(c.firestore(), 'contenuti/carnevale'), { aperte: false }));
  await assertFails(iscrivi('CARNFFFFFFF2', [persona('RSSFFF80A01L750F')], { prova: false }));
});
