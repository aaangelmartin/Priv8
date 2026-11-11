import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PaginaMovil from './PaginaMovil.jsx';
import '@landing/styles.css';
import './demo.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PaginaMovil />
  </StrictMode>,
);
