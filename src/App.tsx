import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { EventoPagina } from './pages/EventoPagina';
import { Accesso } from './pages/Accesso';
import { Carnevale, ChiSiamo, Contatti } from './pages/Statiche';

// Le pagine pesanti (QR, PDF, fotocamera, gestione) si caricano solo quando servono.
const Biglietto = lazy(() => import('./pages/Biglietto').then((m) => ({ default: m.Biglietto })));
const AdminHome = lazy(() => import('./pages/admin/AdminHome').then((m) => ({ default: m.AdminHome })));
const EventoForm = lazy(() => import('./pages/admin/EventoForm').then((m) => ({ default: m.EventoForm })));
const Iscritti = lazy(() => import('./pages/admin/Iscritti').then((m) => ({ default: m.Iscritti })));
const Utenti = lazy(() => import('./pages/admin/Utenti').then((m) => ({ default: m.Utenti })));
const Ingresso = lazy(() => import('./pages/staff/Ingresso').then((m) => ({ default: m.Ingresso })));
function Protetta({ livello, children }: { livello: 'staff' | 'organizzatore'; children: ReactNode }) {
  const { caricamento, isStaff, isOrganizzatore } = useAuth();
  if (caricamento) return <main className="contenuto"><p className="vuoto">Caricamento…</p></main>;
  const ok = livello === 'organizzatore' ? isOrganizzatore : isStaff;
  return ok ? <>{children}</> : <Navigate to="/accesso" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<main className="contenuto"><p className="vuoto">Caricamento…</p></main>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="evento/:id" element={<EventoPagina />} />
            <Route path="carnevale" element={<Carnevale />} />
            <Route path="chi-siamo" element={<ChiSiamo />} />
            <Route path="contatti" element={<Contatti />} />
            <Route path="accesso" element={<Accesso />} />
            <Route path="admin" element={<Protetta livello="organizzatore"><AdminHome /></Protetta>} />
            <Route path="admin/eventi/:id" element={<Protetta livello="organizzatore"><EventoForm /></Protetta>} />
            <Route path="admin/eventi/:id/iscritti" element={<Protetta livello="organizzatore"><Iscritti /></Protetta>} />
            <Route path="admin/utenti" element={<Protetta livello="organizzatore"><Utenti /></Protetta>} />
          </Route>
          <Route path="biglietto/:codice" element={<Biglietto />} />
          <Route path="staff" element={<Protetta livello="staff"><Ingresso /></Protetta>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
