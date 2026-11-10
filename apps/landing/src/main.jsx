import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { TransitionsLab } from './Field.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {location.hash === '#transiciones' ? <TransitionsLab /> : <App />}
  </StrictMode>,
);
