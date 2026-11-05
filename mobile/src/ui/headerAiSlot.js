// The AI button every Header shows (app/HeaderAi.jsx), plugged in by the app at start-up so the
// ui/ layer doesn't import the app. Null in tests and before start-up: no button.
let Slot = null;
export function setHeaderAiSlot(Component) {
  Slot = Component;
}
export const headerAiSlot = () => Slot;
