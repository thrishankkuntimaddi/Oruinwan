// @vitest-environment jsdom
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  FREE_LIMITS, PRO_LIMITS, PRO_PRICE, SALES_EMAIL, NOTIFY_EMAIL, PLANS, notifyHref, planById, upgradeHref, enterpriseHref,
} from '../pages/pricing/plans';
import PlanCards from '../pages/pricing/PlanCards';
import { currentPlanOf } from '../pages/pricing/Pricing';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1' } }) }));
vi.mock('../features/plan/usePlan', () => ({ usePlan: () => ({ plan: { userPlan: 'free' }, loading: false }) }));

describe('pricing plans', () => {
  test('Free is self-serve, Pro is requested, Enterprise is a conversation', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'pro', 'enterprise']);
    expect(planById('free').status).toBe('available');
    expect(planById('pro').status).toBe('request');
    expect(planById('enterprise').status).toBe('contact');
    expect(planById('pro').price).toBe(`$${PRO_PRICE.yearly}`);
    expect(planById('enterprise').price).toBe('Custom');
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

  test('Pro rows match the server limits', () => {
    const text = PRO_LIMITS.map((l) => `${l.label} ${l.value}`).join('\n');
    for (const fragment of ['Up to 10 per person', 'Create 10, join 20', 'Owner + 100', 'Up to 25 people, 5 hours',
      '10,000 active', '100 per person per day', '2,000 per workspace per day']) {
      expect(text).toContain(fragment);
    }
  });

  test('upgrade and enterprise links are mailto links to the sales inbox', () => {
    expect(NOTIFY_EMAIL).toBe(SALES_EMAIL);
    expect(upgradeHref().startsWith(`mailto:${SALES_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(upgradeHref())).toContain('Upgrade to Oruinwan Pro');
    expect(decodeURIComponent(enterpriseHref())).toContain('Oruinwan Enterprise enquiry');
    expect(notifyHref('Enterprise')).toBe(enterpriseHref());
    expect(notifyHref('Pro')).toBe(upgradeHref());
  });

  test('cards: public site offers sign-up, Upgrade to Pro and Talk to us', () => {
    render(<MemoryRouter><div className="prc-root"><PlanCards site /></div></MemoryRouter>);
    const free = screen.getByRole('article', { name: 'Free' });
    expect(within(free).getByText('Available now')).toBeTruthy();
    expect(within(free).getByText(/Get started free/)).toBeTruthy();
    const pro = screen.getByRole('article', { name: 'Pro' });
    expect(within(pro).getByText(/Upgrade to Pro/).closest('a').getAttribute('href')).toMatch(/^mailto:/);
    const ent = screen.getByRole('article', { name: 'Enterprise' });
    expect(within(ent).getByText(/Talk to us/).closest('a').getAttribute('href')).toMatch(/^mailto:/);
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  test('cards in the app mark the current plan', () => {
    render(<MemoryRouter><PlanCards currentPlan="pro" /></MemoryRouter>);
    const pro = screen.getByRole('article', { name: 'Pro' });
    expect(within(pro).getByText('Your plan')).toBeTruthy();
    expect(within(pro).getByText('Your current plan')).toBeTruthy();
    expect(within(pro).queryByText(/Upgrade to Pro/)).toBeNull();
  });

  test('company accounts count as Enterprise; unknown plans as Free', () => {
    expect(currentPlanOf({ userPlan: 'company' })).toBe('enterprise');
    expect(currentPlanOf({ userPlan: 'pro' })).toBe('pro');
    expect(currentPlanOf({ userPlan: 'weird' })).toBe('free');
    expect(currentPlanOf(null)).toBe('free');
  });

  test('signed in, /pricing renders the app page with every section', async () => {
    const { default: Pricing } = await import('../pages/pricing/Pricing');
    render(<MemoryRouter><Pricing /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Plans and pricing' })).toBeTruthy();
    expect(screen.getByText('What the Free plan includes')).toBeTruthy();
    expect(screen.getByText('What Pro raises')).toBeTruthy();
    expect(screen.getByText('Enterprise: we set it up for you')).toBeTruthy();
  });
});
