// src/components/messageComp/chatWindow/helpers/helpers.js
// small helper utilities for ChatWindow

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const isSameDay = (aIso, bIso) =>
  new Date(aIso).toDateString() === new Date(bIso).toDateString();

export const isToday = (iso) => isSameDay(iso, new Date().toISOString());

export const isYesterday = (iso) => {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() - 1);
  return d.toDateString() === t.toDateString();
};

export const dateLabel = (iso) => {
  if (isToday(iso)) return "TODAY";
  if (isYesterday(iso)) return "YESTERDAY";
  const d = new Date(iso);
  return d
    .toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
};

export const groupByDate = (messages) => {
  const sorted = [...messages].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const groups = [];
  sorted.forEach((m) => {
    const label = dateLabel(m.ts);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [m] });
    else last.items.push(m);
  });
  return groups;
};

// file picker helper
export const pickFile = (accept) =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] ?? null);
    input.click();
  });
