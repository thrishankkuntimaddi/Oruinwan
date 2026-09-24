import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T } from '../../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export default function DateJumpModal({ visible, initialDate, minDate, onClose, onSelect }) {
  const [view, setView] = useState(monthStart(initialDate || new Date()));
  useEffect(() => { if (visible) setView(monthStart(initialDate || new Date())); }, [visible, initialDate]);

  const maxDate = useMemo(() => new Date(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const min = minDate || new Date(0);

  const days = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const out = [];
    const blanks = new Date(y, m, 1).getDay();
    for (let i = 0; i < blanks; i++) out.push({ id: `b${i}`, blank: true });
    const total = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= total; d++) {
      const date = new Date(y, m, d);
      const t = date.getTime();
      out.push({ id: `d${d}`, day: d, date, disabled: t < midnight(min) || t > midnight(maxDate) });
    }
    return out;
  }, [view, min, maxDate]);

  const prevDisabled = view <= monthStart(min);
  const nextDisabled = view >= monthStart(maxDate);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.header}>
            <Text style={s.title}>Jump to date</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <View style={s.controls}>
            <TouchableOpacity disabled={prevDisabled} onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} style={[s.arrow, prevDisabled && s.off]}>
              <Text style={s.arrowText}>←</Text>
            </TouchableOpacity>
            <Text style={s.month}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
            <TouchableOpacity disabled={nextDisabled} onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} style={[s.arrow, nextDisabled && s.off]}>
              <Text style={s.arrowText}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={s.grid}>
            {WEEKDAYS.map((w, i) => <View key={`w${i}`} style={s.cell}><Text style={s.weekday}>{w}</Text></View>)}
            {days.map((d) => (d.blank ? <View key={d.id} style={s.cell} /> : (
              <TouchableOpacity key={d.id} disabled={d.disabled} onPress={() => onSelect(d.date)} style={[s.cell, s.day, d.disabled && s.off]}>
                <Text style={s.dayText}>{d.day}</Text>
              </TouchableOpacity>
            )))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: T.bgSurface, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: T.borderDefault },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  close: { color: T.textSecondary, fontSize: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  arrow: { padding: 8, borderRadius: 4, backgroundColor: T.bgActive },
  arrowText: { color: T.accent, fontSize: 16 },
  month: { color: T.textPrimary, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: T.textMuted, fontSize: 11, fontWeight: '700' },
  day: { borderRadius: 4 },
  dayText: { color: T.textPrimary, fontSize: 13 },
  off: { opacity: 0.25 },
});
