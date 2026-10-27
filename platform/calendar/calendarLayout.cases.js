// Shared cases for platform/calendar/calendarLayout.js (web and phone suites run them).
import { agenda, layoutDay, monthGrid, rangeTitle, stepCursor, weekDays } from './calendarLayout.js';

export function defineCalendarLayoutTests({ describe, it, expect }) {
  describe('calendar layout', () => {
    it('a month is 6 weeks from Monday, with the days around it', () => {
      const g = monthGrid(2026, 9); // October 2026 starts on a Thursday
      expect(g).toHaveLength(6);
      expect(g[0][0].date.getDate()).toBe(28); // Mon 28 Sep
      expect(g[0][0].inMonth).toBe(false);
      expect(g[0][3].date.getDate()).toBe(1);
      expect(g[0][3].inMonth).toBe(true);
    });
    it('weeks start on Monday', () => {
      expect(weekDays(new Date(2026, 9, 27)).map((d) => d.getDate())).toEqual([26, 27, 28, 29, 30, 31, 1]);
    });
    it('overlapping events sit side by side; others take the full width', () => {
      const day = new Date(2026, 9, 27);
      const at = (h, m = 0) => new Date(2026, 9, 27, h, m).toISOString();
      const placed = layoutDay([
        { id: 'a', at: at(9), end: at(10) },
        { id: 'b', at: at(9, 30), end: at(11) },
        { id: 'c', at: at(12), end: at(13) },
        { id: 'd', at: at(8), allDay: true },
      ], day);
      const by = Object.fromEntries(placed.map((p) => [p.event.id, p]));
      expect(by.a).toMatchObject({ top: 540, height: 60, column: 0, columns: 2 });
      expect(by.b).toMatchObject({ top: 570, column: 1, columns: 2 });
      expect(by.c).toMatchObject({ column: 0, columns: 1 });
      expect(by.d).toBeUndefined();
    });
    it('steps and titles by view; agenda groups upcoming days', () => {
      expect(stepCursor('month', new Date(2026, 9, 27), 1).getMonth()).toBe(10);
      expect(stepCursor('week', new Date(2026, 9, 27), -1).getDate()).toBe(20);
      expect(rangeTitle('week', new Date(2026, 9, 27), 'en-US')).toBe('Oct 26 – Nov 1, 2026');
      const list = agenda([{ id: 'x', at: new Date(2026, 9, 29, 10).toISOString() }], new Date(2026, 9, 27), 7);
      expect(list).toHaveLength(1);
      expect(list[0].day.getDate()).toBe(29);
    });
  });
}
