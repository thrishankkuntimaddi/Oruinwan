'use strict';

const { test, expect } = require('@playwright/test');
const { E2E, login, openWorkspace, seedData, withPg } = require('./helpers');

/** In-app navigation (a reload would ask for the password again). */
async function goInApp(page, path) {
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForURL((u) => u.pathname === path);
}

async function tokenOf(api, key) {
  const res = await api.post('/api/auth/login', { data: { email: E2E.users[key].email, password: E2E.password } });
  expect(res.ok(), `login ${key}`).toBeTruthy();
  return (await res.json()).accessToken;
}

// "Make a task" from a note (web UI) and from a library file (API): both sides link, and a
// second attempt answers with the task that already exists.
test.describe('notes and files become tasks', () => {
  test('a note becomes a task: the task shows "From note", the note shows its task, no duplicates', async ({ page, playwright }) => {
    const ws = seedData().workspaceId;
    const stamp = Date.now();
    const title = `Launch plan ${stamp}`;
    const api = await playwright.request.newContext({ baseURL: E2E.apiUrl });
    const alice = await tokenOf(api, 'alice');
    const bob = await tokenOf(api, 'bob');
    const auth = (t) => ({ Authorization: `Bearer ${t}` });

    const content = JSON.stringify([{ id: 'b1', type: 'text', content: '<p>Book the venue and send invites.</p>', meta: {} }]);
    const made = await api.post('/api/v2/notes', { headers: auth(alice), data: { workspaceId: ws, title, content } });
    expect(made.status()).toBeLessThan(300);
    const noteId = (await made.json()).note._id;

    await login(page, 'alice');
    await openWorkspace(page);
    await goInApp(page, `/workspace/${ws}/notes/${noteId}`);
    await expect(page.getByTestId('note-title-input')).toHaveValue(title);

    // Note menu -> "Make a task" -> pre-filled -> "Make task".
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Make a task' }).click();
    const form = page.getByTestId('make-task-form');
    await expect(form.getByLabel('Title')).toHaveValue(title);
    await expect(form.getByLabel('Description')).toHaveValue(/Book the venue and send invites\.[\s\S]*From note: /);
    const created = page.waitForResponse((r) => r.url().includes(`/api/v2/notes/${noteId}/task`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Make task', exact: true }).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const taskId = (await res.json()).task._id;

    // Both sides link (tasks live in PostgreSQL).
    const [row] = await withPg((sql) => sql('SELECT linked_note_id, title FROM tasks WHERE id = $1', [taskId]));
    expect(row).toMatchObject({ linked_note_id: noteId, title });

    // The note shows its task; its menu now says "Open task".
    const pill = page.getByTestId('source-task-pill');
    await expect(pill).toBeVisible();
    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: 'Open task' })).toBeVisible();
    await page.keyboard.press('Escape');

    // A second attempt answers 409 with the task that exists.
    const again = await api.post(`/api/v2/notes/${noteId}/task`, { headers: auth(alice), data: { title: 'Again' } });
    expect(again.status()).toBe(409);
    expect((await again.json()).taskId).toBe(taskId);
    const [{ count }] = await withPg((sql) => sql('SELECT count(*)::int AS count FROM tasks WHERE linked_note_id = $1', [noteId]));
    expect(count).toBe(1);

    // Bob can't see Alice's private note, so he can't make a task from it.
    expect((await api.post(`/api/v2/notes/${noteId}/task`, { headers: auth(bob), data: { title: 'Mine' } })).status()).toBe(403);

    // The task page shows where it came from, and opens the note.
    await pill.click();
    await page.waitForURL(new RegExp(`/tasks/${taskId}`));
    const source = page.getByTestId('task-source-row');
    await expect(source).toContainText('From note:');
    await expect(source).toContainText(title);
    await source.getByRole('button', { name: title }).click();
    await page.waitForURL(new RegExp(`/notes/${noteId}`));

    await api.dispose();
  });

  test('a library file becomes a task with the file attached, once', async ({ playwright }) => {
    const ws = seedData().workspaceId;
    const api = await playwright.request.newContext({ baseURL: E2E.apiUrl });
    const alice = await tokenOf(api, 'alice');
    const auth = { Authorization: `Bearer ${alice}` };

    const up = await api.post('/api/v2/files', {
      headers: auth,
      multipart: { workspaceId: ws, file: { name: `budget-${Date.now()}.csv`, mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') } },
    });
    expect(up.status()).toBe(201);
    const file = (await up.json()).file;

    const made = await api.post(`/api/v2/files/${file._id}/task`, { headers: auth, data: { title: file.name.replace(/\.csv$/, '') } });
    expect(made.status()).toBe(201);
    const taskId = (await made.json()).task._id;

    const [row] = await withPg((sql) => sql('SELECT linked_file_id, attachments FROM tasks WHERE id = $1', [taskId]));
    expect(row.linked_file_id).toBe(file._id);
    expect(row.attachments).toEqual([expect.objectContaining({ name: file.name, fileId: file._id })]);

    const detail = await (await api.get(`/api/v2/files/${file._id}`, { headers: auth })).json();
    expect(String(detail.file.linkedTaskId)).toBe(taskId);

    const again = await api.post(`/api/v2/files/${file._id}/task`, { headers: auth, data: { title: 'Again' } });
    expect(again.status()).toBe(409);
    expect((await again.json()).taskId).toBe(taskId);

    await api.dispose();
  });
});
