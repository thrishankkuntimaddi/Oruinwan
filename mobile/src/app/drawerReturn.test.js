import { useNav } from './nav.js';

// Places opened from the tab bar's drawer: Back returns to the drawer, not Home.
describe('Back from a place the drawer opened', () => {
  beforeEach(() => useNav.getState().resetAll());

  it('a screen pushed from the drawer (Saved, Settings…) goes back to the drawer', () => {
    const s = useNav.getState();
    s.setTab('chats');
    s.setDrawerOpen(true);
    s.push('saved');
    s.openedFromDrawer('chats');
    expect(useNav.getState().drawerOpen).toBe(false);
    expect(useNav.getState().back()).toBe(true);
    expect(useNav.getState().tab).toBe('chats');
    expect(useNav.getState().drawerOpen).toBe(true);
  });

  it('a place opened as a tab (Huddles) goes back to the tab it came from, with the drawer open', () => {
    const s = useNav.getState();
    s.setTab('tasks');
    s.setTab('huddles');
    s.openedFromDrawer('tasks');
    expect(useNav.getState().back()).toBe(true);
    expect(useNav.getState().tab).toBe('tasks');
    expect(useNav.getState().drawerOpen).toBe(true);
  });

  it('only the screen the drawer opened: deeper screens go back normally first', () => {
    const s = useNav.getState();
    s.push('saved');
    s.openedFromDrawer('home');
    s.push('note', { id: 'n1' });
    useNav.getState().back();
    expect(useNav.getState().drawerOpen).toBe(false);
    useNav.getState().back();
    expect(useNav.getState().drawerOpen).toBe(true);
  });

  it('picking a tab yourself forgets the drawer', () => {
    const s = useNav.getState();
    s.setTab('huddles');
    s.openedFromDrawer('home');
    useNav.getState().setTab('chats');
    useNav.getState().setTab('huddles');
    useNav.getState().back();
    expect(useNav.getState().tab).toBe('home');
    expect(useNav.getState().drawerOpen).toBe(false);
  });
});
