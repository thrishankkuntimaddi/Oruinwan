import { describe, expect, it } from 'vitest';
import {
  actionLabel, exportFileName, flattenTree, isCompanyAdmin, isWorkspaceAdmin, memberActions, ownerCandidates, parseBundle, toggleCell, treeSize, workspaceInfoChanges,
} from './adminUi.js';
import { normalizeTags } from '../files/filesUi.js';

describe('admin helpers', () => {
  it('knows who is an admin', () => {
    expect(isWorkspaceAdmin({ role: 'owner' })).toBe(true);
    expect(isWorkspaceAdmin({ role: 'admin' })).toBe(true);
    expect(isWorkspaceAdmin({ role: 'member' })).toBe(false);
    expect(isWorkspaceAdmin(null)).toBe(false);
    expect(isCompanyAdmin({ companyRole: 'admin' })).toBe(true);
    expect(isCompanyAdmin({ companyRole: 'manager' })).toBe(false);
  });
  it('flattens the org chart depth first', () => {
    const roots = [{ id: 'a', reports: [{ id: 'b', reports: [{ id: 'c', reports: [] }] }, { id: 'd', reports: [] }] }];
    expect(flattenTree(roots).map((r) => `${r.node.id}${r.depth}`)).toEqual(['a0', 'b1', 'c2', 'd1']);
    expect(treeSize(roots)).toBe(4);
    expect(flattenTree(undefined)).toEqual([]);
  });
  it('toggles one matrix cell and keeps the rest of the row', () => {
    const m = { member: { sendMessages: true, createTasks: false } };
    expect(toggleCell(m, 'member', 'createTasks')).toEqual({ sendMessages: true, createTasks: true });
    expect(m.member.createTasks).toBe(false);
    expect(toggleCell({}, 'guest', 'pinMessages')).toEqual({ pinMessages: true });
  });
  it('names exports and reads them back', () => {
    expect(exportFileName('Acme Team!', new Date(2026, 2, 3))).toBe('oruinwan-acme-team-2026-03-03.json');
    const bundle = { schemaVersion: '1.0', workspace: { name: 'A' } };
    expect(parseBundle(JSON.stringify({ bundle }))).toEqual(bundle);
    expect(parseBundle(JSON.stringify(bundle))).toEqual(bundle);
    expect(() => parseBundle('nope')).toThrow(/not valid JSON/);
    expect(() => parseBundle('{"a":1}')).toThrow(/isn't a workspace export/);
  });
  it('labels audit actions', () => {
    expect(actionLabel('workspace.created')).toBe('Workspace created');
    expect(actionLabel('userRoleChanged')).toBe('User role changed');
  });
  it('normalizes file tags', () => {
    expect(normalizeTags([' Design', 'design', '#Q3', '', null])).toEqual(['design', 'q3']);
  });
  it('follows the server hierarchy for member actions', () => {
    const member = { role: 'member', status: 'active' };
    const admin = { role: 'admin', status: 'active' };
    expect(memberActions('admin', member)).toEqual({ role: 'admin', suspend: true, restore: false, remove: true });
    expect(memberActions('admin', admin)).toEqual({ role: null, suspend: false, restore: false, remove: false });
    expect(memberActions('owner', admin)).toEqual({ role: 'member', suspend: true, restore: false, remove: true });
    expect(memberActions('owner', { role: 'owner' }).remove).toBe(false);
    expect(memberActions('owner', { ...member, isMe: true }).remove).toBe(false);
    expect(memberActions('member', member).remove).toBe(false);
    expect(memberActions('admin', { role: 'member', status: 'suspended' })).toEqual({ role: null, suspend: false, restore: true, remove: true });
  });
  it('picks owner candidates', () => {
    const list = [{ id: 'me', isMe: true, role: 'owner' }, { id: 'a', role: 'admin' }, { id: 'b', role: 'member', status: 'suspended' }, { id: 'c', role: 'member' }];
    expect(ownerCandidates(list).map((m) => m.id)).toEqual(['a', 'c']);
  });
  it('saves only what changed on the General screen', () => {
    const ws = { name: 'Acme', description: '', rules: 'Be kind' };
    expect(workspaceInfoChanges(ws, { name: ' Acme ', description: '', rules: 'Be kind' })).toEqual({});
    expect(workspaceInfoChanges(ws, { name: 'Acme Co', description: 'Hi', rules: 'Be kind' })).toEqual({ name: 'Acme Co', description: 'Hi' });
    expect(workspaceInfoChanges(ws, { name: '  ', rules: '' })).toEqual({ rules: '' });
  });
});
