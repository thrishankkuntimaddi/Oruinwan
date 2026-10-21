// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilterChips from '../components/search/SearchFilterChips';

function Harness({ initial = '', channels = [], people = [] }) {
    const [q, setQ] = useState(initial);
    return (
        <>
            <output data-testid="q">{q}</output>
            <SearchFilterChips query={q} onChange={setQ} channels={channels} people={people} />
        </>
    );
}

const q = () => screen.getByTestId('q').textContent;

describe('SearchFilterChips', () => {
    it('shows the query operators as removable chips', () => {
        render(<Harness initial="budget from:@alice in:#general" />);
        expect(screen.getByText('from: @alice')).toBeInTheDocument();
        expect(screen.getByText('in: #general')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove from: @alice' }));
        expect(q()).toBe('in:#general budget');
    });

    it('clears every operator but keeps the free text', () => {
        render(<Harness initial='from:@a type:task "q1 plan"' />);
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(q()).toBe('"q1 plan"');
    });

    it('sets the type from the Type menu, replacing any previous type', () => {
        render(<Harness initial="type:note budget" />);
        fireEvent.click(screen.getByRole('button', { name: /Type/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Tasks' }));
        expect(q()).toBe('type:task budget');
    });

    it('adds a channel and a person from suggestions or typed text', () => {
        render(<Harness initial="x" channels={['design', 'general']} people={['bob']} />);
        fireEvent.click(screen.getByRole('button', { name: /^In/ }));
        fireEvent.change(screen.getByLabelText('#channel'), { target: { value: 'des' } });
        expect(screen.queryByRole('menuitem', { name: '#general' })).toBeNull();
        fireEvent.click(screen.getByRole('menuitem', { name: '#design' }));
        expect(q()).toBe('in:#design x');

        fireEvent.click(screen.getByRole('button', { name: /^From/ }));
        const input = screen.getByLabelText('@person');
        fireEvent.change(input, { target: { value: '@carol' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(q()).toBe('from:@carol in:#design x');
    });

    it('applies a custom date and toggles has:/is: options', () => {
        render(<Harness initial="x" />);
        fireEvent.click(screen.getByRole('button', { name: /Date/ }));
        fireEvent.change(screen.getByLabelText('Date operator'), { target: { value: 'before' } });
        fireEvent.change(screen.getByLabelText('Custom date'), { target: { value: '2026-02-01' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply date' }));
        expect(q()).toBe('before:2026-02-01 x');

        fireEvent.click(screen.getByRole('button', { name: /More/ }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Has a link' }));
        expect(q()).toBe('has:link before:2026-02-01 x');
        fireEvent.click(screen.getByRole('button', { name: /More/ }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Has a link' }));
        expect(q()).toBe('before:2026-02-01 x');
    });

    it('marks quick date ranges as after: and replaces on:', () => {
        render(<Harness initial="on:2026-01-01 x" />);
        fireEvent.click(screen.getByRole('button', { name: /Date/ }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Last 7 days' }));
        expect(q()).toMatch(/^after:\d{4}-\d{2}-\d{2} x$/);
    });
});
