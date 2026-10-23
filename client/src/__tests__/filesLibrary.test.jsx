// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const ME = 'c'.repeat(24);
const BOB = 'b'.repeat(24);
const WS = 'a'.repeat(24);

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: ME, username: 'alice' } }) }));
const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FileLibrary from '../pages/SidebarComp/FileLibrary';
import api from '@services/api';
import { normalizeTag, mergeFile } from '../hooks/useFiles';
import FileTagsInput from '../pages/SidebarComp/FileTagsInput';
import FilePreviewPanel, { canEditFile } from '../pages/SidebarComp/FilePreviewPanel';
import FileShareDialog, { permissionChanges } from '../pages/SidebarComp/FileShareDialog';

const baseFile = {
    _id: 'f1', name: 'spec.pdf', mimeType: 'application/pdf', size: 2048, url: 'https://x/spec.pdf',
    createdBy: { _id: ME, username: 'alice' }, tags: ['design'], permissions: [], currentVersion: 2,
    createdAt: new Date().toISOString(), workspaceId: WS,
};

function makeApi(overrides = {}) {
    return {
        getComments: vi.fn().mockResolvedValue([]),
        addComment: vi.fn(),
        getVersions: vi.fn().mockResolvedValue({ versions: [{ _id: 'v1', versionNumber: 1, changeNote: 'First draft', size: 100, url: 'https://x/v1', createdAt: new Date().toISOString() }], currentVersion: 2 }),
        uploadVersion: vi.fn().mockResolvedValue({ file: { ...baseFile, currentVersion: 3 }, version: 3 }),
        restoreVersion: vi.fn().mockResolvedValue({ file: { ...baseFile, currentVersion: 3 } }),
        updateTags: vi.fn(async (_id, tags) => ({ ...baseFile, tags })),
        shareFile: vi.fn().mockResolvedValue({ file: baseFile }),
        ...overrides,
    };
}

beforeEach(() => { toast.mockReset(); api.get.mockReset(); });

describe('file helpers', () => {
    it('normalises tags like the server does', () => {
        expect(normalizeTag('  #Design ')).toBe('design');
        expect(normalizeTag('##')).toBe('');
    });

    it('keeps the hydrated creator when merging a raw server document', () => {
        const merged = mergeFile({ _id: 'f', createdBy: { _id: ME, username: 'alice' }, tags: [] }, { _id: 'f', createdBy: ME, tags: ['x'] });
        expect(merged.createdBy.username).toBe('alice');
        expect(merged.tags).toEqual(['x']);
    });

    it('lets the owner and editors edit, not viewers', () => {
        expect(canEditFile(baseFile, ME)).toBe(true);
        expect(canEditFile({ ...baseFile, createdBy: BOB }, ME)).toBe(false);
        expect(canEditFile({ ...baseFile, createdBy: BOB, permissions: [{ user: ME, role: 'edit' }] }, ME)).toBe(true);
        expect(canEditFile({ ...baseFile, createdBy: BOB, permissions: [{ user: ME, role: 'view' }] }, ME)).toBe(false);
    });

    it('sends only changed permissions', () => {
        expect(permissionChanges([{ user: BOB, role: 'view' }], [{ user: BOB, role: 'view' }, { user: 'd', role: 'edit' }]))
            .toEqual([{ user: 'd', role: 'edit' }]);
        expect(permissionChanges([{ user: { _id: BOB }, role: 'download' }], [{ user: BOB, role: 'edit' }])).toEqual([]);
    });
});

describe('FileTagsInput', () => {
    function Harness({ initial = [] }) {
        const [tags, setTags] = useState(initial);
        return <><FileTagsInput value={tags} onChange={setTags} suggestions={['ops', 'design']} label="Tags" /><output data-testid="out">{tags.join(',')}</output></>;
    }

    it('adds on Enter, dedupes, removes with the chip button and Backspace', () => {
        render(<Harness initial={['design']} />);
        const input = screen.getByLabelText('Tags');
        fireEvent.change(input, { target: { value: '#Roadmap' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByTestId('out')).toHaveTextContent('design,roadmap');
        fireEvent.change(input, { target: { value: 'design' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByTestId('out')).toHaveTextContent('design,roadmap');
        fireEvent.click(screen.getByLabelText('Remove tag design'));
        expect(screen.getByTestId('out')).toHaveTextContent(/^roadmap$/);
        fireEvent.keyDown(input, { key: 'Backspace' });
        expect(screen.getByTestId('out')).toHaveTextContent(/^$/);
    });

    it('offers workspace tags not yet used', () => {
        render(<Harness initial={['design']} />);
        fireEvent.click(screen.getByText('#ops'));
        expect(screen.getByTestId('out')).toHaveTextContent('design,ops');
    });
});

describe('FilePreviewPanel', () => {
    it('saves tag edits through updateTags', async () => {
        const fapi = makeApi();
        const onFileChange = vi.fn();
        render(<FilePreviewPanel file={baseFile} workspaceId={WS} api={fapi} onClose={() => { }} onDelete={() => { }} onFileChange={onFileChange} />);
        const input = screen.getByLabelText('Add a tag');
        fireEvent.change(input, { target: { value: 'q3' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(fapi.updateTags).toHaveBeenCalledWith('f1', ['design', 'q3']));
        await waitFor(() => expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ['design', 'q3'] })));
    });

    it('lists versions, uploads a new one and restores an old one', async () => {
        const fapi = makeApi();
        const onFileChange = vi.fn();
        render(<FilePreviewPanel file={baseFile} workspaceId={WS} api={fapi} onClose={() => { }} onDelete={() => { }} onFileChange={onFileChange} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Versions' }));
        expect(await screen.findByText('First draft')).toBeInTheDocument();

        const blob = new File(['x'], 'spec-v3.pdf', { type: 'application/pdf' });
        fireEvent.change(screen.getByTestId('version-input'), { target: { files: [blob] } });
        fireEvent.change(await screen.findByLabelText('What changed? (optional)'), { target: { value: 'New pricing' } });
        fireEvent.click(screen.getByRole('button', { name: /Upload version/ }));
        await waitFor(() => expect(fapi.uploadVersion).toHaveBeenCalledWith('f1', blob, 'New pricing'));
        expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ currentVersion: 3 }));

        fireEvent.click(screen.getByRole('button', { name: /Restore/ }));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
        await waitFor(() => expect(fapi.restoreVersion).toHaveBeenCalledWith('f1', 'v1'));
    });

    it('hides edit controls from people without edit access', async () => {
        const fapi = makeApi();
        render(<FilePreviewPanel file={{ ...baseFile, createdBy: BOB }} workspaceId={WS} api={fapi} onClose={() => { }} onDelete={() => { }} />);
        expect(screen.queryByLabelText('Add a tag')).toBeNull();
        expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Versions' }));
        await screen.findByText('First draft');
        expect(screen.queryByRole('button', { name: /Upload new version/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Restore/ })).toBeNull();
    });
});

describe('FileShareDialog', () => {
    it('adds a member with a role and sends the change', async () => {
        api.get.mockResolvedValue({ data: { members: [{ _id: ME, username: 'alice' }, { _id: BOB, username: 'bob', email: 'bob@x.io' }] } });
        const shareFile = vi.fn().mockResolvedValue({ file: { ...baseFile, permissions: [{ user: BOB, role: 'edit' }] } });
        const onShared = vi.fn();
        const onClose = vi.fn();
        render(<FileShareDialog open file={baseFile} workspaceId={WS} isOwner shareFile={shareFile} onShared={onShared} onClose={onClose} showToast={toast} />);
        await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/api/workspaces/${WS}/members`));
        fireEvent.change(screen.getByLabelText('Add people'), { target: { value: 'bob' } });
        fireEvent.click(await screen.findByRole('button', { name: /bob/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save access' }));
        await waitFor(() => expect(shareFile).toHaveBeenCalledWith('f1', [{ user: BOB, role: 'edit' }]));
        expect(onShared).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('is read-only for people who are not the owner', async () => {
        api.get.mockResolvedValue({ data: { members: [] } });
        render(<FileShareDialog open file={{ ...baseFile, createdBy: BOB }} workspaceId={WS} isOwner={false} shareFile={vi.fn()} onClose={() => { }} />);
        expect(screen.queryByLabelText('Add people')).toBeNull();
        expect(screen.getByText(/Only the person who uploaded the file/)).toBeInTheDocument();
    });
});

describe('FileLibrary upload with tags', () => {
    it('asks for tags before uploading and sends them', async () => {
        api.get.mockImplementation(async (url) => (url === '/api/v2/files/shared'
            ? { data: { items: [{ id: 'lib:f1', source: 'library', fileId: 'f1', name: 'spec.pdf', mimeType: 'application/pdf', size: 2048, sharedBy: { _id: ME, username: 'alice' }, sharedAt: baseFile.createdAt, conversation: null }], total: 1, hasMore: false, conversations: [] } }
            : { data: { files: [baseFile] } }));
        api.post.mockResolvedValue({ data: { file: { ...baseFile, _id: 'f2', name: 'notes.txt', tags: ['ops'] } } });
        const { container } = render(
            <MemoryRouter initialEntries={[`/workspace/${WS}/files`]}>
                <Routes><Route path="/workspace/:workspaceId/files" element={<FileLibrary />} /></Routes>
            </MemoryRouter>,
        );
        await screen.findAllByText('spec.pdf');
        const picker = container.querySelector('input[type="file"][multiple]');
        const blob = new File(['hi'], 'notes.txt', { type: 'text/plain' });
        fireEvent.change(picker, { target: { files: [blob] } });
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('notes.txt');
        const tagBox = within(dialog).getByLabelText('Tags for the upload');
        fireEvent.change(tagBox, { target: { value: 'ops' } });
        fireEvent.keyDown(tagBox, { key: 'Enter' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Upload' }));
        await waitFor(() => expect(api.post).toHaveBeenCalled());
        const form = api.post.mock.calls[0][1];
        expect(form.get('tags')).toBe(JSON.stringify(['ops']));
        expect(form.get('workspaceId')).toBe(WS);
    });
});
