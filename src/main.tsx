import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import PenroseTerritoryGame from '../penrose-territory';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PenroseTerritoryGame />
  </StrictMode>
);
