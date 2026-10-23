// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const ME = 'c'.repeat(24);
const BOB = 'b'.repeat(24);
const WS = 'a'.repeat(24);
const CH = 'd'.repeat(24);
const DM = 'e'.repeat(24);

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: ME, username: 'alice' } }) }));
const toast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: toast }) }));
vi.mock('@services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, API_BASE: '' }));
vi.mock('../contexts/WorkspaceContext', () => ({ useWorkspace: () => ({ activeWorkspace: { name: 'Acme' } }) }));
const downloadAttachment = vi.fn(async () => {});
vi.mock('../utils/uploadFile', async (orig) => ({ ...(await orig()), downloadAttachment: (...a) => downloadAttachment(...a) }));

import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import api from '@services/api';
import FileLibrary from '../pages/SidebarComp/FileLibrary';
import { sharedFilesParams, messageLink, whereLabel, toAttachment } from '../hooks/useSharedFiles';
import { viewerFor } from '../pages/SidebarComp/AttachmentPreview';

const NOW = new Date().toISOString();
const chatPdf = {
    id: `msg:m1:0`, source: 'channel', name: 'roadmap.pdf', mimeType: 'application/pdf', size: 4096, type: 'file',
    url: 'https://files.example/roadmap.pdf', kind: 'document', sharedBy: { _id: BOB, username: 'bob' }, sharedAt: NOW,
    messageId: 'm1', parentId: null, conversation: { id: CH, type: 'channel', name: 'general' },
};
const dmPhoto = {
    id: `msg:m2:0`, source: 'dm', name: 'photo.png', mimeType: 'image/png', size: 900, type: 'image',
    url: 'https://files.example/photo.png', kind: 'image', sharedBy: { _id: BOB, username: 'bob' }, sharedAt: NOW,
    messageId: 'm2', parentId: 'p9', conversation: { id: DM, type: 'dm', name: 'bob' },
};
const libZip = {
    id: 'lib:f1', source: 'library', fileId: 'f1', name: 'brand.zip', mimeType: 'application/zip', size: 5000,
    kind: 'other', sharedBy: { _id: ME, username: 'alice' }, sharedAt: NOW, conversation: null, tags: [],
};

function respond({ items = [chatPdf, dmPhoto, libZip], total } = {}) {
    api.get.mockImplementation(async (url) => {
        if (url === '/api/v2/files/shared') {
            return { data: { items, total: total ?? items.length, hasMore: false, conversations: [{ id: CH, type: 'channel', name: 'general' }, { id: DM, type: 'dm', name: 'bob' }] } };
        }
        return { data: { files: [] } };
    });
}

let lastLocation = null;
function Spy() {
    lastLocation = useLocation();
    return null;
}

function renderPage() {
    return render(
        <MemoryRouter initialEntries={[`/workspace/${WS}/files`]}>
            <Routes>
                <Route path="/workspace/:workspaceId/files" element={<FileLibrary />} />
                <Route path="*" element={<Spy />} />
            </Routes>
        </MemoryRouter>,
    );
}

const sharedCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/v2/files/shared');

beforeEach(() => {
    api.get.mockReset();
    toast.mockReset();
    downloadAttachment.mockClear();
    lastLocation = null;
});

describe('shared file helpers', () => {
    it('builds query params from the filters', () => {
        expect(sharedFilesParams({ workspaceId: WS })).toEqual({ workspaceId: WS, sort: 'newest', offset: 0, limit: 50 });
        expect(sharedFilesParams({ workspaceId: WS, kind: 'image', source: 'dms', q: ' plan ', sort: 'name', offset: 50 }))
            .toEqual({ workspaceId: WS, kind: 'image', source: 'dms', q: 'plan', sort: 'name', offset: 50, limit: 50 });
        expect(sharedFilesParams({ workspaceId: WS, source: `conv:${CH}` })).toMatchObject({ conversationId: CH });
        expect(sharedFilesParams({ workspaceId: WS, source: `conv:${CH}` }).source).toBeUndefined();
    });

    it('links to the message, through its thread for replies', () => {
        expect(messageLink(chatPdf, WS)).toBe(`/workspace/${WS}/channel/${CH}?message=m1`);
        expect(messageLink(dmPhoto, WS)).toBe(`/workspace/${WS}/dm/${DM}?message=m2&thread=p9`);
        expect(messageLink(libZip, WS)).toBeNull();
    });

    it('labels where a file was shared', () => {
        expect(whereLabel(chatPdf)).toBe('#general');
        expect(whereLabel(dmPhoto)).toBe('bob');
        expect(whereLabel(libZip)).toBe('Files');
    });

    it('maps items to the attachment shape the chat viewers use', () => {
        expect(toAttachment(dmPhoto)).toMatchObject({ type: 'image', url: dmPhoto.url, name: 'photo.png', mimeType: 'image/png' });
        expect(viewerFor({ mimeType: 'image/png' })).toBe('image');
        expect(viewerFor({ type: 'voice' })).toBe('audio');
        expect(viewerFor({ mimeType: 'video/mp4' })).toBe('video');
        expect(viewerFor({ mimeType: 'application/pdf' })).toBe('file');
    });
});

// The page pulls in the chat viewers: the first render can be slow on a busy machine.
describe('Files page: everything shared with me', { timeout: 20000 }, () => {
    it('lists chat attachments and uploads with who shared them and where', async () => {
        respond();
        renderPage();
        const list = await screen.findByRole('list', { name: 'Files' });
        expect(within(list).getByText('roadmap.pdf')).toBeInTheDocument();
        expect(within(list).getByText(/bob · #general/)).toBeInTheDocument();
        expect(within(list).getByText('photo.png')).toBeInTheDocument();
        expect(within(list).getByText(/alice · Files/)).toBeInTheDocument();
        expect(screen.getByText('3 files')).toBeInTheDocument();
    });

    it('filters by type, place and sort through the server', async () => {
        respond();
        renderPage();
        await screen.findByRole('list', { name: 'Files' });
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        await waitFor(() => expect(sharedCalls().at(-1)[1].params).toMatchObject({ kind: 'image' }));
        fireEvent.change(screen.getByLabelText('Shared in'), { target: { value: `conv:${CH}` } });
        await waitFor(() => expect(sharedCalls().at(-1)[1].params).toMatchObject({ kind: 'image', conversationId: CH }));
        fireEvent.change(screen.getByLabelText('Sort files'), { target: { value: 'size' } });
        await waitFor(() => expect(sharedCalls().at(-1)[1].params).toMatchObject({ sort: 'size' }));
    });

    it('searches by name after typing stops', async () => {
        respond();
        renderPage();
        await screen.findByRole('list', { name: 'Files' });
        fireEvent.change(screen.getByLabelText('Find a file'), { target: { value: 'road' } });
        await waitFor(() => expect(sharedCalls().at(-1)[1].params).toMatchObject({ q: 'road' }), { timeout: 2000 });
    });

    it('opens a chat attachment with Download and Go to message', async () => {
        respond();
        renderPage();
        const list = await screen.findByRole('list', { name: 'Files' });
        fireEvent.click(within(list).getByText('roadmap.pdf'));
        const panel = await screen.findByRole('complementary', { name: 'Preview of roadmap.pdf' });
        expect(within(panel).getByText('#general')).toBeInTheDocument();
        expect(within(panel).getByTestId('attachment-preview')).toHaveAttribute('data-viewer', 'file');
        fireEvent.click(within(panel).getByRole('button', { name: /^Download$/ }));
        await waitFor(() => expect(downloadAttachment).toHaveBeenCalledWith(expect.objectContaining({ name: 'roadmap.pdf', url: chatPdf.url })));
        fireEvent.click(within(panel).getByRole('button', { name: /Go to message/ }));
        await waitFor(() => expect(lastLocation?.pathname).toBe(`/workspace/${WS}/channel/${CH}`));
        expect(lastLocation.search).toBe('?message=m1');
    });

    it('row actions: go to the message; only uploads can be deleted', async () => {
        respond();
        renderPage();
        await screen.findByRole('list', { name: 'Files' });
        expect(screen.queryByLabelText('Delete roadmap.pdf')).toBeNull();
        expect(screen.getByLabelText('Delete brand.zip')).toBeInTheDocument();
        expect(screen.queryByLabelText('Go to the message with brand.zip')).toBeNull();
        fireEvent.click(screen.getByLabelText('Go to the message with photo.png'));
        await waitFor(() => expect(lastLocation?.pathname).toBe(`/workspace/${WS}/dm/${DM}`));
        expect(lastLocation.search).toBe('?message=m2&thread=p9');
    });

    it('explains where files come from when nothing is shared yet', async () => {
        respond({ items: [] });
        renderPage();
        expect(await screen.findByText('Nothing shared yet')).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'How files get here' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload a file/ })).toBeInTheDocument();
    });

    it('offers to clear filters when nothing matches', async () => {
        respond();
        renderPage();
        await screen.findByRole('list', { name: 'Files' });
        respond({ items: [] });
        fireEvent.click(screen.getByRole('tab', { name: 'Media' }));
        expect(await screen.findByText('No files match')).toBeInTheDocument();
        respond();
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        await waitFor(() => expect(sharedCalls().at(-1)[1].params.kind).toBeUndefined());
    });
});
