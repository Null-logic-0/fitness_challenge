import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({ getSession: vi.fn() }));
vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

import { getSession } from './auth.js';
import { supabase } from '../db/supabase.js';
import { initAdminPanel } from './admin.js';

const labels = {
  statusPending: 'Pending',
  statusVerified: 'Verified',
  statusRejected: 'Rejected',
  watchVideo: 'Watch video',
  editButton: 'Edit',
  deleteButton: 'Delete',
  editTitle: 'Edit result',
  createTitle: 'Create result',
  invalidYoutubeUrl: 'Invalid YouTube URL',
  saveError: 'Could not save',
  userNotFound: 'User not found',
  createError: 'Could not create',
  deleteError: 'Could not delete',
};

function singleBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

function resultsPageBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  };
  return builder;
}

function makeResult(overrides = {}) {
  return {
    id: 'r1',
    user_id: 'u1',
    pull_ups: 40,
    dips: 50,
    total: 90,
    status: 'pending',
    youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
    youtube_video_id: 'dQw4w9WgXcQ',
    submitted_at: '2026-01-15T00:00:00.000Z',
    profiles: { username: 'lukat', display_name: 'Luka T' },
    ...overrides,
  };
}

function buildFixture() {
  document.body.innerHTML = `
    <div id="admin-root" data-lang="en" data-labels='${JSON.stringify(labels)}'>
      <div data-state="checking"></div>
      <div data-state="denied" hidden></div>
      <div data-state="loading" hidden></div>
      <div data-state="error" hidden><button data-action="retry">Retry</button></div>
      <div data-state="empty" hidden></div>
      <div data-state="content" hidden>
        <table><tbody data-rows></tbody></table>
        <button data-action="load-more" hidden>Load more</button>
      </div>
      <button data-action="open-create" hidden>Create</button>
    </div>
    <dialog id="admin-edit-dialog">
      <h3 data-dialog-title></h3>
      <p data-form-error hidden></p>
      <form>
        <div data-username-field hidden><input name="username" /></div>
        <input name="pullUps" />
        <input name="dips" />
        <input name="youtubeUrl" />
        <select name="status">
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <input name="reason" />
        <button type="submit">Save</button>
        <button type="button" data-action="cancel-dialog">Cancel</button>
      </form>
    </dialog>
    <dialog id="admin-delete-dialog">
      <p data-form-error hidden></p>
      <form>
        <input name="reason" />
        <button type="submit">Delete</button>
        <button type="button" data-action="cancel-dialog">Cancel</button>
      </form>
    </dialog>`;
  return document.getElementById('admin-root');
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function flush(times = 8) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('initAdminPanel — access gating', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows denied and never queries results when signed out', async () => {
    getSession.mockResolvedValue(null);
    const root = buildFixture();
    initAdminPanel(root);
    await flush();

    expect(root.querySelector('[data-state="denied"]').hidden).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('shows denied when signed in but not an admin', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValueOnce(singleBuilder({ data: { is_admin: false } }));
    const root = buildFixture();
    initAdminPanel(root);
    await flush();

    expect(root.querySelector('[data-state="denied"]').hidden).toBe(false);
    expect(root.querySelector('[data-action="open-create"]').hidden).toBe(true);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('reveals the create button and loads results for an admin', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from
      .mockReturnValueOnce(singleBuilder({ data: { is_admin: true } }))
      .mockReturnValueOnce(resultsPageBuilder({ data: [makeResult()], error: null }));
    const root = buildFixture();
    initAdminPanel(root);
    await flush();

    expect(root.querySelector('[data-action="open-create"]').hidden).toBe(false);
    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
  });
});

async function setupAdminLoaded(rows = [makeResult()]) {
  getSession.mockResolvedValue({ user: { id: 'u1' } });
  supabase.from
    .mockReturnValueOnce(singleBuilder({ data: { is_admin: true } }))
    .mockReturnValueOnce(resultsPageBuilder({ data: rows, error: null }));
  const root = buildFixture();
  initAdminPanel(root);
  await flush();
  return {
    root,
    editDialog: document.getElementById('admin-edit-dialog'),
    deleteDialog: document.getElementById('admin-delete-dialog'),
  };
}

describe('initAdminPanel — listing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a row per result with formatted stats, status badge, video link, and date', async () => {
    const { root } = await setupAdminLoaded([makeResult()]);
    const row = root.querySelector('[data-rows] tr');
    const cells = row.querySelectorAll('td');

    expect(cells[0].textContent).toBe('Luka T');
    expect(cells[1].textContent).toBe(new Intl.NumberFormat('en-US').format(40));
    expect(cells[3].textContent).toBe(new Intl.NumberFormat('en-US').format(90));
    expect(cells[4].querySelector('.badge').textContent).toBe('Pending');
    expect(cells[4].querySelector('.badge').className).toContain('badge-warning');
    const link = cells[5].querySelector('a');
    expect(link.getAttribute('href')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(link.target).toBe('_blank');
  });

  it('falls back to the raw user_id when the result has no profile', async () => {
    const { root } = await setupAdminLoaded([makeResult({ profiles: null, user_id: 'u-raw' })]);
    expect(root.querySelector('[data-rows] tr td').textContent).toBe('u-raw');
  });

  it('shows the empty state when there are no results', async () => {
    const { root } = await setupAdminLoaded([]);
    expect(root.querySelector('[data-state="empty"]').hidden).toBe(false);
    expect(root.querySelector('[data-state="content"]').hidden).toBe(true);
  });

  it('shows the error state when the query fails, and retry reloads it', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from
      .mockReturnValueOnce(singleBuilder({ data: { is_admin: true } }))
      .mockReturnValueOnce(resultsPageBuilder({ data: null, error: { message: 'boom' } }));
    const root = buildFixture();
    initAdminPanel(root);
    await flush();
    expect(root.querySelector('[data-state="error"]').hidden).toBe(false);

    supabase.from.mockReturnValueOnce(resultsPageBuilder({ data: [makeResult()], error: null }));
    root.querySelector('[data-action="retry"]').click();
    await flush();
    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
  });

  it('hides load-more when fewer than a full page comes back, shows it otherwise', async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => makeResult({ id: `r${i}` }));
    const { root } = await setupAdminLoaded(fullPage);
    expect(root.querySelector('[data-action="load-more"]').hidden).toBe(false);
  });

  it('load-more appends another page and preserves offset', async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => makeResult({ id: `r${i}` }));
    const { root } = await setupAdminLoaded(fullPage);

    supabase.from.mockReturnValueOnce(resultsPageBuilder({ data: [makeResult({ id: 'r-next' })], error: null }));
    root.querySelector('[data-action="load-more"]').click();
    await flush();

    expect(root.querySelectorAll('[data-rows] tr')).toHaveLength(21);
    expect(root.querySelector('[data-action="load-more"]').hidden).toBe(true);
  });
});

describe('initAdminPanel — dialogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the edit dialog prefilled with the row values', async () => {
    const { root, editDialog } = await setupAdminLoaded([makeResult({ status: 'verified' })]);
    root.querySelector('[data-rows] button').click(); // edit is the first action button

    expect(editDialog.open).toBe(true);
    const form = editDialog.querySelector('form');
    expect(form.pullUps.value).toBe('40');
    expect(form.dips.value).toBe('50');
    expect(form.youtubeUrl.value).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(form.status.value).toBe('verified');
    expect(editDialog.querySelector('[data-username-field]').hidden).toBe(true);
    expect(editDialog.querySelector('[data-dialog-title]').textContent).toBe('Edit result');
  });

  it('opens the create dialog reset, with the username field required', async () => {
    const { root, editDialog } = await setupAdminLoaded();
    root.querySelector('[data-action="open-create"]').click();

    expect(editDialog.open).toBe(true);
    const form = editDialog.querySelector('form');
    expect(form.dataset.resultId).toBeUndefined();
    expect(form.status.value).toBe('pending');
    expect(editDialog.querySelector('[data-username-field]').hidden).toBe(false);
    expect(form.username.required).toBe(true);
    expect(editDialog.querySelector('[data-dialog-title]').textContent).toBe('Create result');
  });

  it('opens the delete dialog with a cleared reason field', async () => {
    const { root, deleteDialog } = await setupAdminLoaded();
    const buttons = root.querySelectorAll('[data-rows] button');
    buttons[1].click(); // delete is the second action button

    expect(deleteDialog.open).toBe(true);
    expect(deleteDialog.querySelector('form').reason.value).toBe('');
  });

  it('cancel buttons close their dialog', async () => {
    const { root, editDialog } = await setupAdminLoaded();
    root.querySelector('[data-action="open-create"]').click();
    editDialog.querySelector('[data-action="cancel-dialog"]').click();
    expect(editDialog.open).toBe(false);
  });
});

describe('initAdminPanel — edit form submit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid YouTube URL without calling the RPC', async () => {
    const { root, editDialog } = await setupAdminLoaded();
    root.querySelector('[data-rows] button').click();
    editDialog.querySelector('form').youtubeUrl.value = 'not a url';

    submit(editDialog.querySelector('form'));
    await flush();

    expect(editDialog.querySelector('[data-form-error]').hidden).toBe(false);
    expect(editDialog.querySelector('[data-form-error]').textContent).toBe('Invalid YouTube URL');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(editDialog.open).toBe(true);
  });

  it('updates an existing result via admin_update_result, closes, and reloads', async () => {
    const { root, editDialog } = await setupAdminLoaded([makeResult({ id: 'r1' })]);
    root.querySelector('[data-rows] button').click();
    const form = editDialog.querySelector('form');
    form.pullUps.value = '45';
    form.reason.value = 'correction';
    supabase.rpc.mockResolvedValueOnce({ error: null });
    supabase.from.mockReturnValueOnce(resultsPageBuilder({ data: [makeResult({ pull_ups: 45 })], error: null }));

    submit(form);
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_result', {
      p_result_id: 'r1',
      p_pull_ups: 45,
      p_dips: 50,
      p_youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
      p_youtube_video_id: 'dQw4w9WgXcQ',
      p_status: 'pending',
      p_reason: 'correction',
    });
    expect(editDialog.open).toBe(false);
    expect(root.querySelector('[data-rows] tr td').nextSibling.textContent).toBe(
      new Intl.NumberFormat('en-US').format(45),
    );
  });

  it('shows a save error and keeps the dialog open when the update RPC fails', async () => {
    const { editDialog } = await setupAdminLoaded([makeResult({ id: 'r1' })]);
    document.querySelector('[data-rows] button').click();
    supabase.rpc.mockResolvedValueOnce({ error: { message: 'boom' } });

    submit(editDialog.querySelector('form'));
    await flush();

    expect(editDialog.querySelector('[data-form-error]').hidden).toBe(false);
    expect(editDialog.querySelector('[data-form-error]').textContent).toBe('Could not save');
    expect(editDialog.open).toBe(true);
  });

  it('creates a new result by looking up the username, then calling admin_create_result', async () => {
    const { root, editDialog } = await setupAdminLoaded([]);
    root.querySelector('[data-action="open-create"]').click();
    const form = editDialog.querySelector('form');
    form.username.value = 'newuser';
    form.pullUps.value = '10';
    form.dips.value = '20';
    form.youtubeUrl.value = 'https://youtu.be/dQw4w9WgXcQ';

    supabase.from.mockReturnValueOnce(singleBuilder({ data: { id: 'u-new' }, error: null }));
    supabase.rpc.mockResolvedValueOnce({ error: null });
    supabase.from.mockReturnValueOnce(resultsPageBuilder({ data: [makeResult({ id: 'r-new' })], error: null }));

    submit(form);
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_create_result', expect.objectContaining({
      p_user_id: 'u-new',
      p_pull_ups: 10,
      p_dips: 20,
    }));
    expect(editDialog.open).toBe(false);
    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
  });

  it('shows "user not found" and does not call the RPC when the username lookup fails', async () => {
    const { editDialog } = await setupAdminLoaded([]);
    document.querySelector('[data-action="open-create"]').click();
    const form = editDialog.querySelector('form');
    form.username.value = 'ghost';
    form.youtubeUrl.value = 'https://youtu.be/dQw4w9WgXcQ';

    supabase.from.mockReturnValueOnce(singleBuilder({ data: null, error: { message: 'not found' } }));

    submit(form);
    await flush();

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(editDialog.querySelector('[data-form-error]').textContent).toBe('User not found');
  });
});

describe('initAdminPanel — delete form submit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes via admin_delete_result with the pending id and reason, then closes and reloads', async () => {
    const { root, deleteDialog } = await setupAdminLoaded([makeResult({ id: 'r1' })]);
    const buttons = root.querySelectorAll('[data-rows] button');
    buttons[1].click();
    deleteDialog.querySelector('form').reason.value = 'spam';

    supabase.rpc.mockResolvedValueOnce({ error: null });
    supabase.from.mockReturnValueOnce(resultsPageBuilder({ data: [], error: null }));

    submit(deleteDialog.querySelector('form'));
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith('admin_delete_result', { p_result_id: 'r1', p_reason: 'spam' });
    expect(deleteDialog.open).toBe(false);
    expect(root.querySelector('[data-state="empty"]').hidden).toBe(false);
  });

  it('shows a delete error and keeps the dialog open when the RPC fails', async () => {
    const { root, deleteDialog } = await setupAdminLoaded([makeResult({ id: 'r1' })]);
    root.querySelectorAll('[data-rows] button')[1].click();
    supabase.rpc.mockResolvedValueOnce({ error: { message: 'boom' } });

    submit(deleteDialog.querySelector('form'));
    await flush();

    expect(deleteDialog.querySelector('[data-form-error]').hidden).toBe(false);
    expect(deleteDialog.querySelector('[data-form-error]').textContent).toBe('Could not delete');
    expect(deleteDialog.open).toBe(true);
  });
});
