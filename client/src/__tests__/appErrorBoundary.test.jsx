// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AppErrorBoundary from '../shared/components/ui/AppErrorBoundary';

function Boom({ fail }) {
    if (fail) throw new Error('page broke');
    return <p>page works</p>;
}

describe('AppErrorBoundary', () => {
    afterEach(() => cleanup());

    test('shows an inline error for a section, and recovers when resetKey changes', () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = render(<AppErrorBoundary label="This page" resetKey="/a"><Boom fail /></AppErrorBoundary>);
        expect(screen.getByText('This page couldn’t load')).toBeTruthy();

        // Same page: the error stays.
        rerender(<AppErrorBoundary label="This page" resetKey="/a"><Boom /></AppErrorBoundary>);
        expect(screen.getByText('This page couldn’t load')).toBeTruthy();

        // Another page: the error clears and the new page renders.
        rerender(<AppErrorBoundary label="This page" resetKey="/b"><Boom /></AppErrorBoundary>);
        expect(screen.getByText('page works')).toBeTruthy();
        quiet.mockRestore();
    });
});
