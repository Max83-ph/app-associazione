// Testi dell'associazione usati in tutta l'app.
// Nella versione completa saranno modificabili dal pannello organizzatori.
export const NOME_ASSOCIAZIONE = 'Rione Cappuccini';

export const CONTATTI = {
  email: '[email dell\'associazione]',
  telefono: '[telefono]',
  whatsapp: '', // es. 'https://wa.me/39333...'
  instagram: '',
  facebook: '',
  indirizzo: '[indirizzo della sede]',
};

export const INFORMATIVA_PRIVACY = `Titolare del trattamento è ${NOME_ASSOCIAZIONE}. I dati inseriti (nome, cognome, email e, per i laboratori, nome ed età dei bambini) servono solo a gestire l'iscrizione all'evento e l'ingresso. Non vengono ceduti a terzi e vengono cancellati entro alcuni mesi dalla data dell'evento. Puoi chiedere in qualsiasi momento di vedere, correggere o cancellare i tuoi dati scrivendo a ${CONTATTI.email}.

[Testo dimostrativo: da sostituire con l'informativa validata dall'associazione.]`;

export const LIBERATORIA_FOTO = `Durante l'evento potrebbero essere scattate foto o girati video per raccontare le attività dell'associazione sui suoi canali (sito, social, bacheca). Se acconsenti, autorizzi la pubblicazione di immagini in cui compaiono i partecipanti indicati, senza alcun compenso. Puoi revocare il consenso in qualsiasi momento. Se non acconsenti l'iscrizione resta valida e lo staff farà in modo di non riprendere i partecipanti.

[Testo dimostrativo: da sostituire con la liberatoria validata dall'associazione.]`;

// ---------- Soci ----------
export const NOME_GRUPPO = NOME_ASSOCIAZIONE;
export const NOME_COMITATO = 'Comitato';

export const INFORMATIVA_SOCI = `Ai sensi del Regolamento UE 2016/679 (GDPR), ${NOME_ASSOCIAZIONE}, titolare del trattamento, raccoglie i dati anagrafici e di contatto dei soci per gestire l'iscrizione, il tesseramento annuale, le comunicazioni associative e gli adempimenti previsti dallo statuto e dalla legge. I dati sono conservati per la durata dell'adesione e per il tempo successivo richiesto dalla legge, sono trattati solo da chi gestisce l'associazione e non vengono ceduti a terzi, salvo obblighi di legge o enti a cui l'associazione è affiliata. Puoi chiedere in qualsiasi momento di consultare, correggere o cancellare i tuoi dati, o opporti al trattamento, scrivendo a ${CONTATTI.email}.

[Testo dimostrativo: da sostituire con l'informativa validata dall'associazione.]`;

export const LIBERATORIA_SOCI = `Autorizzo ${NOME_ASSOCIAZIONE} a riprendermi in foto e video durante tutti gli eventi e le attività organizzati dal Gruppo, e a pubblicare queste immagini sui suoi canali (sito, app, social, materiale informativo) senza alcun compenso. L'autorizzazione vale fino a revoca, che posso comunicare in qualsiasi momento anche dall'app.

[Testo dimostrativo: da sostituire con la liberatoria validata dall'associazione.]`;
