// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../pages/pricing/PlanCards', () => ({ default: () => null }));

import Landing from '../pages/landing/Landing';

beforeAll(() => {
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    window.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
});

const renderAt = (user) => {
    auth.user = user;
    return render(<MemoryRouter initialEntries={['/']}><Landing /></MemoryRouter>);
};

describe('landing page', () => {
    it('signed out: offers sign-up and log in', () => {
        renderAt(null);
        expect(screen.getAllByText(/Start free|Get started/).length).toBeGreaterThan(0);
        expect(screen.queryByText('Open your workspaces')).toBeNull();
    });

    it('signed in: still shows the landing page, with a way into the workspaces', () => {
        renderAt({ _id: 'u1', username: 'Ana Lee' });
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('One workspace.');
        expect(screen.getByText('Welcome back, Ana')).toBeInTheDocument();
        const open = screen.getAllByRole('link', { name: /Open your workspaces/ });
        expect(open[0]).toHaveAttribute('href', '/workspaces');
        expect(screen.queryByText('Log in')).toBeNull();
    });
});
