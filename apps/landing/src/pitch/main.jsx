import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Deck from './Deck.jsx';
import { textureUrl } from '../texture.js';
import './pitch.css';

/* La presentación del jurado (priv8.es/pitch). El mismo sistema que la landing: cobalto con el fondo de datos,
   papel blanco, Sora en los titulares y 8 vivo en las diapositivas. */
document.documentElement.style.setProperty('--texture', textureUrl());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Deck />
  </StrictMode>,
);
