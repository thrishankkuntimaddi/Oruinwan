import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App.jsx';
import { useAppearance } from './app/theme.js';
import { LiquidGlass } from '../../platform/theme/liquid-glass.js';

useAppearance.getState().init();
// Liquid Glass behaviour: touch press spring and floating headers. (Not LiquidGlass.init(): the
// theme is ours, app/theme.js. No lens(): its SVG edge refraction is drawn in software on many
// Android WebViews and tablets, every frame, and made scrolling stutter.)
LiquidGlass.press();
LiquidGlass.floatHeaders();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
