import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@landing/styles.css';
import './demo.css';
import { textureUrl } from '@landing/texture.js';

document.documentElement.style.setProperty('--texture', textureUrl());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
