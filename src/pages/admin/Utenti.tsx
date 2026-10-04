import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ascoltaUtenti, cambiaRuolo } from '../../lib/dati';
import { useAuth } from '../../lib/auth';
import { Icona } from '../../components/Icona';
import type { Ruolo, Utente } from '../../types';

const ETICHETTE: Record<Ruolo, string> = {
  in_attesa: 'In attesa',
  staff: 'Staff ingresso',
  organizzatore: 'Organizzatore',
};

export function Utenti() {
  const { utente } = useAuth();
  const [lista, setLista] = useState<Utente[] | null>(null);
  const [errore, setErrore] = useState('');

  useEffect(() => ascoltaUtenti(setLista, (e) => setErrore(e.message)), []);

  return (
    <>
      <header className="intestazione compatta">
        <Link to="/admin" className="indietro-chiaro" aria-label="Torna alla gestione"><Icona nome="indietro" size={22} spessore={2} /></Link>
        <h1>Staff e organizzatori</h1>
      </header>
      <main className="contenuto">
        <p className="nota">
          Chi deve aiutare all'ingresso crea un account da “Area riservata → Sono dello staff”. Comparirà qui come “In attesa”: scegli il suo ruolo.
        </p>
        {errore && <p className="avviso errore">{errore}</p>}
        {lista === null && !errore && <p className="vuoto">Caricamento…</p>}
        <ul className="lista-iscritti">
          {(lista ?? []).map((u) => (
            <li key={u.id} className="iscritto">
              <div className="iscritto-testa">
                <div>
                  <div className="iscritto-nome">{u.nome || u.email}</div>
                  <div className="iscritto-sotto">{u.email}</div>
                </div>
                {u.id === utente?.uid ? (
                  <span className="etichetta etichetta-neutro">Tu · {ETICHETTE[u.ruolo]}</span>
                ) : (
                  <label className="selettore-ruolo">
                    <span className="visivamente-nascosto">Ruolo di {u.email}</span>
                    <select value={u.ruolo} onChange={(e) => cambiaRuolo(u.id, e.target.value as Ruolo)}>
                      {(Object.keys(ETICHETTE) as Ruolo[]).map((r) => <option key={r} value={r}>{ETICHETTE[r]}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
