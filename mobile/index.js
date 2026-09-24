// Polyfills must load before anything that touches crypto (noble, socket ids).
import './src/polyfills';
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
