// Testi dell'associazione usati in tutta l'app.
// Nella versione completa saranno modificabili dal pannello organizzatori.
export const NOME_ASSOCIAZIONE = 'Rione Cappuccini';

export const CONTATTI = {
  email: 'comitato.cappuccini@gmail.com',
  telefono: '[telefono]',
  whatsapp: '', // es. 'https://wa.me/39333...'
  instagram: '',
  facebook: '',
  indirizzo: 'Via Lamporo 6, 13100 Vercelli',
};

// Bozze dei testi privacy: si possono modificare da Gestione → Informative e contatti.
// Da far verificare all'associazione (non sono un parere legale).
export const TITOLARE = 'Gruppo Carnevalesco Benefico, Folkloristico e Manifestazioni Varie – Rione Cappuccini';
export const SEDE = 'Via Lamporo 6, 13100 Vercelli (VC)';

export const INFORMATIVA_PRIVACY = `**Informativa sul trattamento dei dati personali (art. 13 Regolamento UE 2016/679)**

**Titolare del trattamento:** ${TITOLARE}, ${SEDE}, email ${CONTATTI.email}.

**Quali dati:** nome, cognome ed email di chi prenota; per laboratori ed eventi per bambini anche nome, cognome ed età dei partecipanti, la firma e la scelta sulla liberatoria foto e video.

**Perché:** gestire la prenotazione, l'ingresso all'evento (biglietto con QR), l'invio del biglietto via email ed eventuali comunicazioni sull'evento (es. variazioni di orario). La base giuridica è l'esecuzione della richiesta di partecipazione; per foto e video è il consenso, facoltativo.

**A chi:** i dati sono trattati solo dai volontari incaricati dall'associazione. Sono conservati su server Google in Italia (Firebase, Milano); per l'invio delle email si usa Gmail. Google agisce come responsabile del trattamento; per alcuni servizi (account di accesso, email, assistenza) può trattarli anche fuori dall'Unione Europea con le garanzie previste dal Regolamento. Non sono ceduti né diffusi.

**Per quanto tempo:** fino a 12 mesi dalla data dell'evento, poi vengono cancellati.

**I tuoi diritti:** puoi chiedere in qualsiasi momento di accedere ai tuoi dati, correggerli, cancellarli o limitarne l'uso, e revocare il consenso alle foto, scrivendo a ${CONTATTI.email}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`;

export const LIBERATORIA_FOTO = `Durante l'evento potranno essere scattate foto o girati video per raccontare le attività dell'associazione sui suoi canali (app, social, bacheca, materiale informativo).

Se acconsenti, autorizzi ${TITOLARE} a pubblicare, senza alcun compenso, immagini in cui compaiono i partecipanti indicati (anche minori, se sei il genitore o chi ne ha la responsabilità), escludendo usi che ne ledano la dignità. Puoi revocare il consenso in qualsiasi momento scrivendo a ${CONTATTI.email}.

Se non acconsenti l'iscrizione resta valida: lo staff farà in modo di non riprendere i partecipanti o di non pubblicarne le immagini.`;

// ---------- Soci ----------
export const NOME_GRUPPO = NOME_ASSOCIAZIONE;
export const NOME_COMITATO = 'Comitato';

export const INFORMATIVA_SOCI = `**Informativa sul trattamento dei dati personali dei soci (art. 13 Regolamento UE 2016/679)**

**Titolare del trattamento:** ${TITOLARE}, ${SEDE}, email ${CONTATTI.email}.

**Quali dati:** dati anagrafici (nome, cognome, data e luogo di nascita, codice fiscale), residenza, email, cellulare, firma, numero di tessera e quote versate, preferenze sulle comunicazioni e sulla liberatoria foto e video.

**Perché:** registrazione e iscrizione all'associazione, tesseramento annuale, copertura assicurativa dei soci, comunicazioni associative (bacheca, gruppo WhatsApp e mailing list solo se scelti) e adempimenti previsti dallo statuto e dalla legge. La base giuridica è il rapporto associativo e gli obblighi di legge; per WhatsApp, mailing list e foto è il consenso, facoltativo.

**A chi:** solo ai volontari incaricati dall'associazione; alle compagnie assicurative e agli enti pubblici quando previsto dalla legge. I dati sono conservati su server Google in Italia (Firebase, Milano); per l'invio delle email si usa Gmail. Google agisce come responsabile del trattamento; per alcuni servizi (account di accesso, email, assistenza) può trattarli anche fuori dall'Unione Europea con le garanzie previste dal Regolamento. Non sono ceduti né diffusi.

**Categorie particolari di dati** (es. salute): sono trattate solo se le comunichi tu e con il tuo consenso esplicito.

**Per quanto tempo:** per la durata dell'adesione e poi per il tempo richiesto dalle norme fiscali e civilistiche, al massimo 10 anni.

**I tuoi diritti:** accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso (artt. 15-22 e 7 del Regolamento), scrivendo a ${CONTATTI.email} o con raccomandata a ${SEDE}. Puoi proporre reclamo al Garante per la protezione dei dati personali (art. 77). Molti dati li puoi vedere e correggere da solo nell'Area soci → I miei dati.

L'informativa completa, con il modulo di consenso, è in Area soci → Documenti.`;

export const LIBERATORIA_SOCI = `Autorizzo ${TITOLARE} a riprendermi in foto e video durante gli eventi e le attività organizzati dal Gruppo, e a pubblicare queste immagini sui suoi canali (app, social, materiale informativo) senza alcun compenso, escludendo usi che ne ledano la dignità.

L'autorizzazione vale fino a revoca, che posso comunicare in qualsiasi momento, anche dall'app (Area soci → I miei dati) o scrivendo a ${CONTATTI.email}.`;

export const PRIVACY_SITO = `## Chi tratta i tuoi dati

Titolare del trattamento è ${TITOLARE}, ${SEDE}, email ${CONTATTI.email}.

## Cosa raccoglie questa app

- **Chi visita le pagine** senza iscriversi: nessun dato personale viene raccolto dall'associazione. Il servizio di hosting (Google Firebase) registra per motivi tecnici e di sicurezza dati come l'indirizzo IP, per periodi limitati.
- **Chi prenota un evento:** i dati del modulo di iscrizione, come spiegato nell'informativa mostrata prima di prenotare.
- **Soci, staff e organizzatori con un account:** email e password (gestite da Google Firebase Authentication) e i dati dell'iscrizione all'associazione, come spiegato nell'informativa soci.

## Fornitori

L'app usa i servizi di Google, che agisce come responsabile del trattamento: Firebase per ospitare l'app e i dati, con il database su server in Italia (Milano, regione europe-west8), e Gmail per l'invio dei biglietti e delle comunicazioni. Gli account di accesso (Firebase Authentication), Gmail e l'eventuale assistenza tecnica possono comportare trattamenti fuori dall'Unione Europea, con le garanzie previste dal Regolamento UE 2016/679 (clausole contrattuali standard e Data Privacy Framework UE-USA).

## Cookie e memoria del telefono

L'app **non usa cookie di profilazione, pubblicità o statistiche**, né strumenti di tracciamento di terze parti. Per questo non trovi il banner dei cookie.

Usa solo memorie tecniche, necessarie al funzionamento, che restano sul tuo dispositivo:

- la **sessione di accesso** di soci, staff e organizzatori (Firebase Authentication), finché non esci dall'account;
- l'elenco delle **pagine comunicazioni** aperte con un codice, per ritrovarle facilmente;
- piccole informazioni temporanee della sessione (ad esempio, per non mandare due volte l'email del biglietto).

Puoi cancellarle in qualsiasi momento dalle impostazioni del browser. I link a Google Maps aprono il servizio di Google, che ha la sua informativa.

## Per quanto tempo

Prenotazioni: fino a 12 mesi dopo l'evento. Dati dei soci: per la durata dell'adesione e poi per il tempo richiesto dalla legge.

## I tuoi diritti

Puoi chiedere di accedere ai tuoi dati, correggerli, cancellarli, limitarne l'uso, opporti al trattamento e revocare i consensi scrivendo a ${CONTATTI.email}. Puoi proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`;
