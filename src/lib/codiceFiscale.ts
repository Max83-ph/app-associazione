// Verifica formale del codice fiscale italiano (formato e carattere di controllo).
const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function valorePari(c: string): number {
  return /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
}

export function normalizzaCF(cf: string): string {
  return cf.toUpperCase().replace(/\s/g, '');
}

/** null se valido, altrimenti il motivo. */
export function erroreCF(input: string): string | null {
  const cf = normalizzaCF(input);
  if (cf.length !== 16) return 'deve avere 16 caratteri';
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return 'il formato non è corretto';
  let somma = 0;
  for (let i = 0; i < 15; i++) somma += i % 2 === 0 ? DISPARI[cf[i]] : valorePari(cf[i]);
  if (String.fromCharCode(65 + (somma % 26)) !== cf[15]) return 'l\'ultimo carattere non torna: controlla di averlo scritto bene';
  return null;
}
