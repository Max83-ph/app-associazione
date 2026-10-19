/**
 * Email dei biglietti – Rione Cappuccini
 * ---------------------------------------
 * Script Google Apps Script da installare UNA volta con l'account Gmail del comitato
 * (istruzioni nell'app: Gestione → Informative e contatti → Email dei biglietti).
 *
 * L'app chiama questo script con il solo codice del biglietto. Lo script legge il biglietto
 * dal database (come farebbe chiunque abbia il link del biglietto) e manda l'email
 * SOLO all'indirizzo scritto nella prenotazione, al massimo MAX_INVII volte per biglietto.
 * Così nessuno può usarlo per mandare email ad altri indirizzi o con testi diversi.
 */

const PROGETTO = 'cappu-events';
const CHIAVE_WEB = 'AIzaSyC_BfTDhiRA-6nr9X6VvWikF0tjdUw8dYM'; // chiave pubblica dell'app web
const APP = 'https://cappu-events.web.app';
const NOME = 'Rione Cappuccini';
const MAX_INVII = 3;
const FUSO = 'Europe/Rome';

function doGet() {
  return risposta({ ok: true, servizio: 'email biglietti ' + NOME });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const dati = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const codice = String(dati.codice || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{10,16}$/.test(codice)) return risposta({ ok: false, errore: 'codice non valido' });

    lock.waitLock(15000);
    const props = PropertiesService.getScriptProperties();
    const chiave = 'b_' + codice;
    const inviati = Number(props.getProperty(chiave) || 0);
    if (inviati >= MAX_INVII) return risposta({ ok: false, errore: 'limite' });

    const p = leggi('bookings/' + codice);
    if (!p) return risposta({ ok: false, errore: 'biglietto non trovato' });
    if (p.statoBiglietto === 'annullato') return risposta({ ok: false, errore: 'annullato' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || '')) return risposta({ ok: false, errore: 'email' });

    const ev = leggi('events/' + p.eventId) || {};
    const testi = leggi('contenuti/testi') || {};
    inviaEmail(codice, p, ev, testi);
    props.setProperty(chiave, String(inviati + 1));
    return risposta({ ok: true });
  } catch (err) {
    return risposta({ ok: false, errore: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* nessun lock */ }
  }
}

/** Da eseguire una volta dall'editor: chiede i permessi e manda un'email di prova a te stesso. */
function prova() {
  const io = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(io, 'Prova email biglietti ' + NOME, 'Funziona! Ora pubblica lo script come App web.', { name: NOME });
}

// ---------- Email ----------

function inviaEmail(codice, p, ev, testi) {
  const leggibile = codice.match(/.{1,4}/g).join('-');
  const link = APP + '/biglietto/' + codice;
  const data = p.eventoData ? new Date(p.eventoData) : null;
  const quando = data ? giornoLungo(data) + ', ore ' + Utilities.formatDate(data, FUSO, 'HH:mm') : '';
  const indirizzo = String(ev.indirizzo || (testi.contatti && testi.contatti.indirizzo) || '').trim();
  const dove = [String(ev.luogo || '').trim(), indirizzo.charAt(0) === '[' ? '' : indirizzo].filter(String).join(', ');
  const mappa = indirizzo && indirizzo.charAt(0) !== '[' ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(indirizzo) : '';
  const anticipo = ev.anticipoMinuti === undefined || ev.anticipoMinuti === null ? 15 : Number(ev.anticipoMinuti);
  const arrivo = data && anticipo > 0
    ? 'Presentati almeno ' + anticipo + ' minuti prima dell\'inizio, entro le ' + Utilities.formatDate(new Date(data.getTime() - anticipo * 60000), FUSO, 'HH:mm') + '.'
    : '';
  const cosa = descrivi(p);

  const testo = [
    'Ciao ' + p.nome + ',',
    'ecco il tuo biglietto per "' + p.eventoTitolo + '".',
    '',
    'Quando: ' + quando,
    dove ? 'Dove: ' + dove : '',
    'Prenotazione: ' + cosa,
    'Codice biglietto: ' + leggibile,
    arrivo,
    '',
    'Apri il biglietto con il QR da mostrare all\'ingresso: ' + link,
    '',
    NOME,
  ].filter(function (r, i, a) { return r !== '' || a[i - 1] !== ''; }).join('\n');

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1f2b">' +
    '<div style="background:#1e6b45;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;font-weight:bold;font-size:16px">' + esc(NOME) + '</div>' +
    '<div style="border:1px solid #e2e6df;border-top:0;border-radius:0 0 12px 12px;padding:18px">' +
    '<p style="margin:0 0 12px">Ciao ' + esc(p.nome) + ', ecco il tuo biglietto.</p>' +
    '<h1 style="font-size:22px;margin:0 0 6px">' + esc(p.eventoTitolo) + '</h1>' +
    '<p style="margin:0 0 4px;color:#b23a1e;font-weight:bold">' + esc(quando) + '</p>' +
    (dove ? '<p style="margin:0 0 12px">' + (mappa ? '<a href="' + mappa + '" style="color:#1e6b45">' + esc(dove) + '</a>' : esc(dove)) + '</p>' : '') +
    (arrivo ? '<p style="margin:12px 0;padding:10px 12px;background:#fcf1cc;color:#6a5000;border-radius:8px;font-weight:bold">' + esc(arrivo) + '</p>' : '') +
    '<p style="margin:12px 0 4px">' + esc(cosa) + (p.partecipanti && p.partecipanti.length ? ': ' + esc(p.partecipanti.map(function (b) { return b.nome + ' ' + b.cognome; }).join(', ')) : '') + '</p>' +
    '<p style="margin:0 0 16px;color:#56625b">Codice biglietto: <strong style="font-size:18px;letter-spacing:1px;color:#1a1f2b">' + leggibile + '</strong></p>' +
    '<p style="margin:0 0 16px"><a href="' + link + '" style="display:inline-block;background:#1e6b45;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Apri il biglietto con il QR</a></p>' +
    '<p style="margin:0;font-size:13px;color:#56625b">All\'ingresso mostra il QR dal telefono (o stampato). Se non riesci ad aprirlo, basta il codice qui sopra. ' +
    'Dal biglietto puoi anche annullare la prenotazione se non puoi più venire.</p>' +
    '</div></div>';

  const contatti = testi.contatti || {};
  const opzioni = { name: NOME, htmlBody: html };
  if (/@/.test(contatti.email || '')) opzioni.replyTo = contatti.email;
  GmailApp.sendEmail(p.email, 'Il tuo biglietto: ' + p.eventoTitolo, testo, opzioni);
}

function descrivi(p) {
  const q = Number(p.quantita || 1);
  if (p.modalita === 'asporto') return 'Asporto, ' + q + (q === 1 ? ' porzione' : ' porzioni');
  if (p.modalita === 'tavolo') return 'Al tavolo, ' + q + (q === 1 ? ' persona' : ' persone');
  if (p.partecipanti && p.partecipanti.length) return p.partecipanti.length + (p.partecipanti.length === 1 ? ' bambino' : ' bambini');
  return q + (q === 1 ? ' persona' : ' persone');
}

function giornoLungo(d) {
  const giorni = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const g = Number(Utilities.formatDate(d, FUSO, 'u')) % 7;
  return giorni[g] + ' ' + Utilities.formatDate(d, FUSO, 'd') + ' ' + mesi[Number(Utilities.formatDate(d, FUSO, 'M')) - 1];
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- Lettura dal database (Firestore REST, come un visitatore senza account) ----------

function leggi(percorso) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROGETTO + '/databases/(default)/documents/' + percorso + '?key=' + CHIAVE_WEB;
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const d = JSON.parse(r.getContentText());
  return d.fields ? valori(d.fields) : {};
}

function valori(fields) {
  const o = {};
  Object.keys(fields).forEach(function (k) { o[k] = valore(fields[k]); });
  return o;
}

function valore(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return valori(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valore);
  return null;
}

function risposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
