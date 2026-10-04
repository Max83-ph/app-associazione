import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { NOME_ASSOCIAZIONE } from '../config';

export function Layout() {
  const { isStaff, isOrganizzatore } = useAuth();
  return (
    <div className="app">
      <Outlet />
      <nav className="tabbar" aria-label="Sezioni">
        <NavLink to="/" end>Eventi</NavLink>
        <NavLink to="/carnevale">Carnevale</NavLink>
        <NavLink to="/chi-siamo">Chi siamo</NavLink>
        <NavLink to="/contatti">Contatti</NavLink>
        {isOrganizzatore ? (
          <NavLink to="/admin">Gestione</NavLink>
        ) : isStaff ? (
          <NavLink to="/staff">Ingresso</NavLink>
        ) : null}
      </nav>
    </div>
  );
}

export function Intestazione({ titolo, children }: { titolo: string; children?: React.ReactNode }) {
  return (
    <header className="intestazione">
      <div className="intestazione-riga">
        <Link to="/" className="marchio">{NOME_ASSOCIAZIONE}</Link>
        <Link to="/accesso" className="link-accesso">Area riservata</Link>
      </div>
      <h1>{titolo}</h1>
      {children}
    </header>
  );
}
