// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../utils/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import api from '../services/api';
import { FeatureFlagsProvider, useFlag, FeatureRoute } from '../contexts/FeatureFlagsContext';

function FlagProbe({ name }) {
    return <span data-testid={`flag-${name}`}>{useFlag(name) ? 'on' : 'off'}</span>;
}

function renderAt(path) {
    return render(
        <FeatureFlagsProvider>
            <MemoryRouter initialEntries={[path]}>
                <FlagProbe name="billing" />
                <FlagProbe name="sso" />
                <Routes>
                    <Route path="/" element={<div>home</div>} />
                    <Route path="/billing" element={<FeatureRoute flag="billing"><div>billing page</div></FeatureRoute>} />
                    <Route path="/sso" element={<FeatureRoute flag="sso" redirectTo="/"><div>sso page</div></FeatureRoute>} />
                </Routes>
            </MemoryRouter>
        </FeatureFlagsProvider>
    );
}

describe('FeatureFlagsContext', () => {
    beforeEach(() => { vi.mocked(api.get).mockReset(); });

    it('reports flags from /api/flags', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { flags: { billing: true, sso: false } } });
        renderAt('/');
        await waitFor(() => expect(screen.getByTestId('flag-billing').textContent).toBe('on'));
        expect(screen.getByTestId('flag-sso').textContent).toBe('off');
        expect(api.get).toHaveBeenCalledWith('/api/flags');
    });

    it('renders a flagged route when the flag is on', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { flags: { billing: true } } });
        renderAt('/billing');
        expect(await screen.findByText('billing page')).toBeTruthy();
    });

    it('redirects away from a flagged route when the flag is off', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { flags: { sso: false } } });
        renderAt('/sso');
        expect(await screen.findByText('home')).toBeTruthy();
        expect(screen.queryByText('sso page')).toBeNull();
    });

    it('treats every flag as off when the request fails', async () => {
        vi.mocked(api.get).mockRejectedValue(new Error('network down'));
        renderAt('/billing');
        expect(await screen.findByText('home')).toBeTruthy();
        expect(screen.getByTestId('flag-billing').textContent).toBe('off');
    });

    it('renders nothing for a flagged route until flags load', () => {
        vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
        renderAt('/billing');
        expect(screen.queryByText('billing page')).toBeNull();
        expect(screen.queryByText('home')).toBeNull();
    });
});
