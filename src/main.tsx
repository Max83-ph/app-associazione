import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Carattere servito dal nostro hosting: niente richieste a Google Fonts (meglio per la privacy).
import '@fontsource-variable/instrument-sans/standard.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
