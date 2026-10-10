// Tracks whether the on-screen keyboard is open so the tab bar can step aside.
import { create } from 'zustand';
import { Keyboard } from '@capacitor/keyboard';
import { isNative } from './index.js';

export const useKeyboard = create(() => ({ open: false }));

let started = false;
export async function watchKeyboard() {
  if (started) return;
  started = true;
  if (isNative) {
    try {
      Keyboard.addListener('keyboardWillShow', () => useKeyboard.setState({ open: true }));
      Keyboard.addListener('keyboardWillHide', () => useKeyboard.setState({ open: false }));
      return;
    } catch {
      /* fall back to the viewport heuristic */
    }
  }
  const vv = window.visualViewport;
  if (!vv) return;
  const base = { h: window.innerHeight };
  const check = () => {
    // On the web the layout viewport stays put while the visual viewport shrinks.
    base.h = Math.max(base.h, window.innerHeight);
    useKeyboard.setState({ open: base.h - vv.height > 150 });
  };
  vv.addEventListener('resize', check);
}
