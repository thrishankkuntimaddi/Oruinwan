// @vitest-environment jsdom
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FREE_LIMITS, NOTIFY_EMAIL, PLANS, notifyHref, planById } from '../pages/pricing/plans';
import PlanCards from '../pages/pricing/PlanCards';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1' } }) }));

describe('pricing plans', () => {
  test('Free is available; Pro and Enterprise are coming soon', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
    expect(planById('free').status).toBe('available');
    expect(planById('pro').status).toBe('coming-soon');
    expect(planById('enterprise').status).toBe('coming-soon');
    expect(planById('nope')).toBeNull();
  });

  test('the Free plan lists the launch limits', () => {
    const text = FREE_LIMITS.map((l) => `${l.label} ${l.value}`).join('\n');
    for (const fragment of ['Up to 4', 'Create 2, join 2', 'Owner + 10', '10 besides the ones made with the workspace',
      'Up to 10 people, 30 minutes', '2 per template', '300 active per workspace', '30 for yourself + 30 assigned',
      '50 per person per day', '300 per workspace per day', 'Google Drive']) {
      expect(text).toContain(fragment);
    }
    expect(new Set(FREE_LIMITS.map((l) => l.id)).size).toBe(FREE_LIMITS.length);
  });

  test('"Notify me" is a mailto link to the admin address', () => {
    const href = notifyHref('Pro');
    expect(href.startsWith(`mailto:${NOTIFY_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain('Oruinwan Pro');
  });

  test('cards: public site offers sign-up, coming-soon plans offer Notify me', () => {
    render(<MemoryRouter><div className="prc-root"><PlanCards site /></div></MemoryRouter>);
    const free = screen.getByRole('article', { name: 'Free' });
    expect(within(free).getByText('Available now')).toBeTruthy();
    expect(within(free).getByText(/Get started free/)).toBeTruthy();
    const pro = screen.getByRole('article', { name: 'Pro' });
    expect(within(pro).getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(within(pro).getByText(/Notify me/).closest('a').getAttribute('href')).toMatch(/^mailto:/);
  });

  test('cards in the app mark Free as the current plan', () => {
    render(<MemoryRouter><PlanCards currentPlan="free" /></MemoryRouter>);
    const free = screen.getByRole('article', { name: 'Free' });
    expect(within(free).getByText('Your plan')).toBeTruthy();
    expect(within(free).getByText('Your current plan')).toBeTruthy();
  });

  test('signed in, /pricing renders the app page', async () => {
    const { default: Pricing } = await import('../pages/pricing/Pricing');
    render(<MemoryRouter><Pricing /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Plans and pricing' })).toBeTruthy();
    expect(screen.getByText('What the Free plan includes')).toBeTruthy();
  });
});
