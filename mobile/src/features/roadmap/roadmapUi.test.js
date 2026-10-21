import { describe, expect, it } from 'vitest';
import { groupByQuarter, itemQuarter, itemSpan, nextQuarter, quarterLabel, quarterOf, quarterOptions, roadmapPermissions, timelineLayout } from './roadmapUi.js';
import { mapRoadmapItem, roadmapBody } from '../../data/live/adapter.roadmap.js';

describe('quarters', () => {
  it('derives quarters in UTC', () => {
    expect(quarterOf('2026-01-01')).toBe('2026-Q1');
    expect(quarterOf('2026-12-31T23:00:00Z')).toBe('2026-Q4');
    expect(quarterOf(null)).toBe(null);
    expect(quarterOf('nope')).toBe(null);
    expect(nextQuarter('2026-Q4')).toBe('2027-Q1');
    expect(quarterLabel('2026-Q3')).toBe('Q3 2026');
    expect(quarterLabel(null)).toBe('No quarter');
  });
  it('prefers the stored quarter, then start, then end', () => {
    expect(itemQuarter({ quarter: '2027-Q2', start: '2026-01-05' })).toBe('2027-Q2');
    expect(itemQuarter({ start: '2026-05-05' })).toBe('2026-Q2');
    expect(itemQuarter({ end: '2026-08-05' })).toBe('2026-Q3');
    expect(itemQuarter({})).toBe(null);
  });
  it('offers eight consecutive quarters', () => {
    const opts = quarterOptions(Date.UTC(2026, 9, 21));
    expect(opts).toHaveLength(8);
    expect(opts[0]).toBe('2026-Q3');
    expect(opts[1]).toBe('2026-Q4');
  });
});

describe('groupByQuarter', () => {
  it('orders quarters in time, unscheduled last, items by lane order', () => {
    const groups = groupByQuarter([
      { id: 'a', quarter: '2026-Q4', order: 2 },
      { id: 'b', start: '2026-07-01', order: 0 },
      { id: 'c' },
      { id: 'd', quarter: '2026-Q4', order: 1 },
    ]);
    expect(groups.map((g) => g.quarter)).toEqual(['2026-Q3', '2026-Q4', null]);
    expect(groups[1].items.map((i) => i.id)).toEqual(['d', 'a']);
    expect(groups[2].label).toBe('No quarter');
  });
});

describe('timelineLayout', () => {
  const now = Date.UTC(2026, 9, 21);
  it('spans whole quarters and places bars by percent', () => {
    const { quarters, rows, unscheduled, today } = timelineLayout(
      [
        { id: 'a', start: '2026-10-01', end: '2026-12-31' },
        { id: 'b', quarter: '2027-Q1' },
        { id: 'c' },
      ],
      now,
    );
    expect(quarters.map((q) => q.key)).toEqual(['2026-Q4', '2027-Q1']);
    expect(quarters.reduce((s, q) => s + q.width, 0)).toBeCloseTo(100);
    expect(rows[0].item.id).toBe('a');
    expect(rows[0].left).toBe(0);
    expect(rows[0].width).toBeCloseTo(quarters[0].width, 0);
    expect(rows[1].left).toBeCloseTo(quarters[0].width);
    expect(unscheduled.map((i) => i.id)).toEqual(['c']);
    expect(today).toBeGreaterThan(0);
  });
  it('shows at least two quarters for an empty roadmap', () => {
    expect(timelineLayout([], now).quarters).toHaveLength(2);
  });
  it('gives an item with only a start a span to the end of its quarter', () => {
    const [s, e] = itemSpan({ start: '2026-11-01' });
    expect(new Date(e).toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(e).toBeGreaterThan(s);
  });
});

describe('permissions', () => {
  const item = { ownerId: 'o', createdById: 'c', canEdit: false };
  it('follows the doc: managers everything, owner edits, creator edits and deletes', () => {
    expect(roadmapPermissions(item, { manager: true, me: 'x' })).toEqual({ edit: true, remove: true, changeOwner: true });
    expect(roadmapPermissions(item, { me: 'o' })).toEqual({ edit: true, remove: false, changeOwner: false });
    expect(roadmapPermissions(item, { me: 'c' })).toEqual({ edit: true, remove: true, changeOwner: false });
    expect(roadmapPermissions(item, { me: 'x' })).toEqual({ edit: false, remove: false, changeOwner: false });
  });
});

describe('roadmap adapter mapping', () => {
  it('maps a server item', () => {
    const it = mapRoadmapItem({
      _id: 'r1', workspaceId: 'w1', title: 'Onboarding', status: 'at_risk', startDate: '2026-10-01T00:00:00.000Z', endDate: null,
      ownerId: { _id: 'u1', username: 'ana' }, createdBy: 'u2', milestoneIds: ['m1'], taskIds: [{ _id: 't1' }], color: 'color-success',
      quarter: '2026-Q4', order: 3, canEdit: true,
      progress: { percent: 66.6, tasks: { total: 3, done: 2, open: 1 }, milestones: { total: 1, completed: 0, items: [{ _id: 'm1', name: 'Beta', percent: 50 }] } },
    });
    expect(it).toMatchObject({ id: 'r1', status: 'at_risk', start: '2026-10-01', end: null, ownerId: 'u1', createdById: 'u2', taskIds: ['t1'], color: 'color-success', canEdit: true });
    expect(it.owner.name).toBe('ana');
    expect(it.progress.percent).toBe(67);
    expect(it.progress.milestones.items[0]).toMatchObject({ id: 'm1', name: 'Beta', percent: 50 });
  });
  it('falls back for unknown status / colour', () => {
    expect(mapRoadmapItem({ _id: 'x', status: 'weird', color: 'indigo' })).toMatchObject({ status: 'planned', color: 'accent', progress: { percent: 0 } });
  });
  it('builds request bodies', () => {
    expect(roadmapBody({ title: '  A ', start: '', end: '2026-12-01', quarter: '' })).toEqual({ title: 'A', startDate: null, endDate: '2026-12-01', quarter: null });
    expect(roadmapBody({ status: 'done' })).toEqual({ status: 'done' });
  });
});
