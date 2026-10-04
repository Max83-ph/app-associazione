// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Codice del biglietto: 12 caratteri casuali, circa 59 bit.
 * È anche l'ID del documento: chi lo conosce vede il biglietto,
 * ma non si può indovinare né elencare.
 */
export function nuovoCodice(lunghezza = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(lunghezza));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

/** "AX7K29QPM3TB" -> "AX7K-29QP-M3TB" */
export function codiceLeggibile(codice: string): string {
  return codice.match(/.{1,4}/g)?.join('-') ?? codice;
}

/** Accetta il codice scritto a mano, con trattini, spazi o minuscole. */
export function normalizzaCodice(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
