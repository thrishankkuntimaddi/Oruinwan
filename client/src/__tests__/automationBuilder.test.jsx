// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const svc = vi.hoisted(() => ({
  getTemplates: vi.fn(), createAutomation: vi.fn(), getAutomation: vi.fn(), updateAutomation: vi.fn(),
  previewSchedule: vi.fn(), runAutomation: vi.fn(), getAutomationRuns: vi.fn(),
}));
vi.mock('../services/automationsService', () => svc);
const showToast = vi.hoisted(() => vi.fn());
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));

import AutomationBuilderPage from '../pages/workspace/AutomationBuilderPage';

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.getTemplates.mockResolvedValue({ data: { templates: [] } });
  svc.previewSchedule.mockResolvedValue({ data: { nextRuns: ['2026-10-26T08:00:00.000Z', '2026-10-27T08:00:00.000Z'] } });
  svc.getAutomationRuns.mockResolvedValue({ data: { runs: [] } });
  showToast.mockReset();
});

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/workspace/:workspaceId/automations/new" element={<AutomationBuilderPage />} />
      <Route path="/workspace/:workspaceId/automations/:id/edit" element={<AutomationBuilderPage />} />
      <Route path="/workspace/:workspaceId/automations" element={<div>list page</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('workflow builder', () => {
  it('builds a multi-step workflow with variables, any-logic conditions and saves it', async () => {
    svc.createAutomation.mockResolvedValue({ data: { automation: { _id: 'a1' } } });
    renderAt('/workspace/ws1/automations/new');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Release flow' } });
    fireEvent.click(screen.getByRole('button', { name: /PR merged/ }));

    // Step 1: send a message
    fireEvent.change(screen.getByLabelText('Step 1 action'), { target: { value: 'send_message' } });
    expect(screen.getByLabelText('Step 1 id')).toHaveValue('message');
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'engineering' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert a variable into Message' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'Variables' })).getByText('github.repo'));
    expect(screen.getByLabelText('Message')).toHaveValue('{{github.repo}}');

    // Step 2: create a task using step 1's output
    fireEvent.click(screen.getByRole('button', { name: /Add another step/ }));
    fireEvent.change(screen.getByLabelText('Step 2 action'), { target: { value: 'create_task' } });
    expect(screen.getByLabelText('Step 2 id')).toHaveValue('task');
    fireEvent.click(screen.getByRole('button', { name: 'Insert a variable into Task title' }));
    const menu = screen.getByRole('menu', { name: 'Variables' });
    expect(within(menu).getByText('previous.channelName')).toBeInTheDocument();
    fireEvent.click(within(menu).getByText('steps.message.messageId'));
    expect(screen.getByLabelText('Task title')).toHaveValue('{{steps.message.messageId}}');

    // Conditions with "any"
    fireEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    fireEvent.change(screen.getByLabelText('Condition 1 field'), { target: { value: 'repo' } });
    fireEvent.change(screen.getByLabelText('Condition 1 operator'), { target: { value: 'in' } });
    fireEvent.change(screen.getByLabelText('Condition 1 value'), { target: { value: 'web, api' } });
    fireEvent.click(screen.getByRole('button', { name: /Add a condition/ }));
    fireEvent.change(screen.getByLabelText('Condition 2 field'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Condition 2 operator'), { target: { value: 'exists' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Any matches' }));

    fireEvent.click(screen.getByRole('button', { name: /Create workflow/ }));
    await waitFor(() => expect(svc.createAutomation).toHaveBeenCalled());
    const body = svc.createAutomation.mock.calls[0][0];
    expect(body.conditionLogic).toBe('any');
    expect(body.conditions).toEqual([
      { field: 'repo', operator: 'in', value: ['web', 'api'] },
      { field: 'title', operator: 'exists', value: true },
    ]);
    expect(body.actions.map((a) => [a.id, a.type])).toEqual([['message', 'send_message'], ['task', 'create_task']]);
    expect(body.actions[0].config).toMatchObject({ channelName: 'engineering', text: '{{github.repo}}' });
    expect(body.actions[1].config.title).toBe('{{steps.message.messageId}}');
    expect(await screen.findByText('list page')).toBeInTheDocument();
  });

  it('blocks saving with a bad step id', async () => {
    renderAt('/workspace/ws1/automations/new');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Step 1 id'), { target: { value: '9lives' } });
    fireEvent.click(screen.getByRole('button', { name: /Create workflow/ }));
    expect(await screen.findAllByText(/Start with a letter/)).not.toHaveLength(0);
    expect(svc.createAutomation).not.toHaveBeenCalled();
  });

  it('previews a cron schedule in a time zone', async () => {
    renderAt('/workspace/ws1/automations/new');
    fireEvent.click(screen.getByRole('button', { name: /On a schedule/ }));
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'cron' } });
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/Berlin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mondays at 09:30' }));
    await waitFor(() => expect(svc.previewSchedule).toHaveBeenCalledWith({ expression: '30 9 * * 1', type: 'cron', timezone: 'Europe/Berlin', count: 5 }));
    expect(await screen.findByText(/Next runs:/)).toBeInTheDocument();
  });

  it('tests a saved workflow (dry run) and shows per-step results and history', async () => {
    svc.getAutomation.mockResolvedValue({ data: { automation: {
      _id: 'a1', name: 'Ship notes', trigger: { type: 'task.completed' }, conditions: [], conditionLogic: 'all',
      actions: [{ id: 'announce', type: 'send_message', config: { channelName: 'eng', text: '{{title}}' } }], isActive: true,
    } } });
    svc.getAutomationRuns.mockResolvedValue({ data: { runs: [
      { _id: 'r1', status: 'partial', source: 'event', createdAt: new Date().toISOString(), durationMs: 12,
        actionsExecuted: [{ index: 0, stepId: 'announce', type: 'send_message', status: 'failed', error: 'No key' }] },
    ] } });
    svc.runAutomation.mockResolvedValue({ data: { run: {
      _id: 'r2', status: 'success', source: 'test', dryRun: true, conditionsMet: true,
      actionsExecuted: [{ index: 0, stepId: 'announce', type: 'send_message', status: 'skipped', reason: 'Test run', preview: { text: 'Fix login' } }],
    } } });
    renderAt('/workspace/ws1/automations/a1/edit');
    expect(await screen.findByDisplayValue('Ship notes')).toBeInTheDocument();
    expect(await screen.findByText('Partly failed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Partly failed'));
    expect(screen.getByText('No key')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Test$/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Sample event data'), { target: { value: '{"title":"Fix login"}' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Run test/ }));
    await waitFor(() => expect(svc.runAutomation).toHaveBeenCalledWith('a1', 'ws1', { eventData: { title: 'Fix login' }, dryRun: true }));
    expect(await within(dialog).findByText('Test run')).toBeInTheDocument();
    expect(within(dialog).getByText(/"text": "Fix login"/)).toBeInTheDocument();
    await waitFor(() => expect(svc.getAutomationRuns).toHaveBeenCalledTimes(2));
  });
});
