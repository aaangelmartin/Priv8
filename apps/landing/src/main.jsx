import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { TransitionsLab } from './Field.jsx';
import './styles.css';
import { textureUrl } from './texture.js';

document.documentElement.style.setProperty('--texture', textureUrl());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {location.hash === '#transiciones' ? <TransitionsLab /> : <App />}
  </StrictMode>,
);
