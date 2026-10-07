# App Associazione: eventi e prenotazioni

Demo dell'app di prenotazione eventi dell'associazione: Home con gli eventi, iscrizione senza account, biglietto con QR, laboratori con firma e liberatoria, pannello organizzatori e scansione all'ingresso.

Gira interamente sul **piano gratuito Firebase (Spark)**: niente Cloud Functions né Storage.

## Cosa c'è

| Pagina | Indirizzo | Chi la usa |
| --- | --- | --- |
| Home con gli eventi | `/` | Tutti |
| Pagina evento e iscrizione | `/evento/:id` | Tutti |
| Biglietto con QR, PDF, annullamento | `/biglietto/:codice` | Chi si è iscritto |
| Info (chi siamo e contatti), Carnevale (in arrivo) | `/info`, `/carnevale` | Tutti |
| Area riservata (accesso) | `/accesso` | Staff e organizzatori |
| Gestione eventi, iscritti, QR, staff | `/admin` | Organizzatori |
| Scansione all'ingresso | `/staff` | Staff e organizzatori |
| Area soci: accesso, tessera, bacheca, i miei dati, documenti (informativa privacy PDF) | `/soci` | Soci |
| Iscrizione soci (link dedicato + codice) | `/soci/iscrizione` | Chi ha link e codice |
| Gestione soci: approvazioni, tessere, Excel, PDF firmati, codice e QR di iscrizione | `/admin/soci` | Organizzatori |
| Bacheca soci: avvisi e news | `/admin/bacheca` | Organizzatori |

## Pubblicazione automatica

Ogni modifica caricata sul ramo `main` viene compilata e pubblicata da GitHub Actions (`.github/workflows/pubblica.yml`) su **https://cappu-events.web.app**, insieme alle regole di sicurezza. Serve una sola configurazione: il secret `FIREBASE_SERVICE_ACCOUNT` del repository, con il contenuto della chiave JSON dell'account di servizio Firebase. Lo stato delle pubblicazioni si vede nella scheda **Actions** del repository.

## Prima messa online a mano (alternativa)

Servono [Node.js](https://nodejs.org) 20 o più recente e il progetto Firebase `cappu-events` già creato, con Firestore, Authentication (Email/password) e Hosting attivi.

```bash
npm install
npx firebase login          # una volta sola, apre il browser
npm run deploy              # compila e pubblica app + regole di sicurezza
```

L'app sarà su **https://cappu-events.web.app**.

### Diventare il primo organizzatore

1. Apri l'app → **Area riservata** → **Sono dello staff: crea account**, con la tua email.
2. Nella [console Firebase](https://console.firebase.google.com/project/cappu-events/firestore) apri la raccolta `users`, poi il documento con il tuo ID (lo trovi anche nell'Area riservata).
3. Cambia il campo `ruolo` da `in_attesa` a `organizzatore` e ricarica l'app.

Da quel momento gli altri volontari si registrano da soli e tu assegni il ruolo da **Gestione → Staff**.

### Creare un organizzatore senza console

Su GitHub: **Actions → Crea organizzatore → Run workflow**, scrivi l'email. Il workflow crea l'account (o promuove quello esistente) con ruolo `organizzatore`. La password la imposta la persona: **Area riservata → Password dimenticata?** con quella email.

## Sviluppo

```bash
npm run dev                 # app in locale su http://localhost:5173
npm run deploy:regole       # pubblica solo le regole di sicurezza
```

Testi dell'associazione (nome, contatti, informativa, liberatoria) in `src/config.ts`.

## Come funziona la sicurezza senza server

- Ogni prenotazione è una **transazione**: crea il biglietto e aggiorna i contatori dell'evento insieme.
- Le regole in `firestore.rules` accettano la prenotazione solo se i contatori salgono esattamente della quantità prenotata e restano entro i limiti. Così non si sfora, nemmeno con due prenotazioni nello stesso istante.
- Il codice del biglietto (12 caratteri casuali) è anche l'ID del documento: chi ha il link vede il proprio biglietto, ma nessuno può elencare le prenotazioni tranne staff e organizzatori.
- Il QR contiene solo il codice, nessun dato personale.

## Passaggio al piano Blaze (se l'associazione lo adotterà)

Si aggiungono, senza riscrivere l'app:

- Cloud Functions per l'email automatica del biglietto e il controllo posti lato server.
- Storage per locandine e PDF firmati (ora salvati leggeri nel database).
