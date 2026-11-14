import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App.jsx';
import { useAppearance } from './app/theme.js';
import { LiquidGlass } from '../../platform/theme/liquid-glass.js';

useAppearance.getState().init();
// Liquid Glass behaviour: edge refraction (Chromium), touch press spring, floating headers.
// (Not LiquidGlass.init(): the theme is ours, app/theme.js.)
LiquidGlass.lens();
LiquidGlass.press();
LiquidGlass.floatHeaders();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
