import { getSession } from './auth.js';
import { supabase } from '../db/supabase.js';
import { extractYouTubeId } from '../utils/youtube.js';
import { formatNumber, formatDate } from '../utils/format.js';

const PAGE_SIZE = 20;

/**
 * Admin results panel: access-gates on profiles.is_admin, lists all
 * results (paginated), and lets an admin create/edit/delete any result via
 * the admin_* RPCs (see supabase/migrations/0004_admin.sql) — there is no
 * direct table write from here, only through those audited functions.
 * @param {HTMLElement} root
 */
export function initAdminPanel(root) {
  const lang = root.dataset.lang;
  const labels = JSON.parse(root.dataset.labels);

  const states = {
    checking: root.querySelector('[data-state="checking"]'),
    denied: root.querySelector('[data-state="denied"]'),
    loading: root.querySelector('[data-state="loading"]'),
    error: root.querySelector('[data-state="error"]'),
    empty: root.querySelector('[data-state="empty"]'),
    content: root.querySelector('[data-state="content"]'),
  };
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
  }

  const tbody = root.querySelector('[data-rows]');
  const loadMoreBtn = root.querySelector('[data-action="load-more"]');
  const createBtn = root.querySelector('[data-action="open-create"]');
  const editDialog = document.getElementById('admin-edit-dialog');
  const deleteDialog = document.getElementById('admin-delete-dialog');
  const editForm = editDialog.querySelector('form');
  const deleteForm = deleteDialog.querySelector('form');
  const editError = editDialog.querySelector('[data-form-error]');
  const deleteError = deleteDialog.querySelector('[data-form-error]');
  const usernameField = editForm.querySelector('[data-username-field]');
  const dialogTitle = editDialog.querySelector('[data-dialog-title]');

  let offset = 0;
  let pendingDeleteId = null;

  const statusBadgeClass = (status) => ({ pending: 'badge-warning', verified: 'badge-success', rejected: 'badge-error' })[status] ?? 'badge-neutral';
  const statusText = (status) => ({ pending: labels.statusPending, verified: labels.statusVerified, rejected: labels.statusRejected })[status] ?? status;

  function buildRow(result) {
    const tr = document.createElement('tr');

    const athleteTd = document.createElement('td');
    athleteTd.textContent = result.profiles?.display_name ?? result.user_id;

    const pullUpsTd = document.createElement('td');
    pullUpsTd.className = 'font-stat text-right';
    pullUpsTd.textContent = formatNumber(lang, result.pull_ups);

    const dipsTd = document.createElement('td');
    dipsTd.className = 'font-stat text-right';
    dipsTd.textContent = formatNumber(lang, result.dips);

    const totalTd = document.createElement('td');
    totalTd.className = 'font-stat text-right font-bold';
    totalTd.textContent = formatNumber(lang, result.total);

    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${statusBadgeClass(result.status)} badge-sm font-semibold`;
    badge.textContent = statusText(result.status);
    statusTd.appendChild(badge);

    const videoTd = document.createElement('td');
    const videoLink = document.createElement('a');
    videoLink.href = result.youtube_url;
    videoLink.target = '_blank';
    videoLink.rel = 'noopener noreferrer';
    videoLink.className = 'link link-primary text-sm';
    videoLink.textContent = labels.watchVideo;
    videoTd.appendChild(videoLink);

    const submittedTd = document.createElement('td');
    submittedTd.className = 'whitespace-nowrap text-sm text-base-content/60';
    submittedTd.textContent = formatDate(lang, result.submitted_at, { year: 'numeric', month: 'short', day: 'numeric' });

    const actionsTd = document.createElement('td');
    actionsTd.className = 'whitespace-nowrap text-right';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-xs';
    editBtn.textContent = labels.editButton;
    editBtn.addEventListener('click', () => openEditDialog(result));
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-ghost btn-xs text-error';
    deleteBtn.textContent = labels.deleteButton;
    deleteBtn.addEventListener('click', () => openDeleteDialog(result));
    actionsTd.append(editBtn, deleteBtn);

    tr.append(athleteTd, pullUpsTd, dipsTd, totalTd, statusTd, videoTd, submittedTd, actionsTd);
    return tr;
  }

  function openEditDialog(result) {
    editError.hidden = true;
    editForm.dataset.resultId = result.id;
    editForm.pullUps.value = result.pull_ups;
    editForm.dips.value = result.dips;
    editForm.youtubeUrl.value = result.youtube_url;
    editForm.status.value = result.status;
    editForm.reason.value = '';
    dialogTitle.textContent = labels.editTitle;
    usernameField.hidden = true;
    editForm.username.required = false;
    editDialog.showModal();
  }

  function openCreateDialog() {
    editError.hidden = true;
    editForm.reset();
    delete editForm.dataset.resultId;
    editForm.status.value = 'pending';
    dialogTitle.textContent = labels.createTitle;
    usernameField.hidden = false;
    editForm.username.required = true;
    editDialog.showModal();
  }

  function openDeleteDialog(result) {
    deleteError.hidden = true;
    pendingDeleteId = result.id;
    deleteForm.reason.value = '';
    deleteDialog.showModal();
  }

  createBtn?.addEventListener('click', openCreateDialog);

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    editError.hidden = true;

    const pullUps = Number(editForm.pullUps.value);
    const dips = Number(editForm.dips.value);
    const youtubeUrl = editForm.youtubeUrl.value.trim();
    const status = editForm.status.value;
    const reason = editForm.reason.value.trim();
    const videoId = extractYouTubeId(youtubeUrl);

    if (!videoId) {
      editError.textContent = labels.invalidYoutubeUrl;
      editError.hidden = false;
      return;
    }

    const submitBtn = editForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    const resultId = editForm.dataset.resultId;

    if (resultId) {
      const { error } = await supabase.rpc('admin_update_result', {
        p_result_id: resultId,
        p_pull_ups: pullUps,
        p_dips: dips,
        p_youtube_url: youtubeUrl,
        p_youtube_video_id: videoId,
        p_status: status,
        p_reason: reason,
      });
      submitBtn.disabled = false;
      if (error) {
        editError.textContent = labels.saveError;
        editError.hidden = false;
        return;
      }
    } else {
      const username = editForm.username.value.trim();
      const { data: profile, error: lookupError } = await supabase.from('profiles').select('id').eq('username', username).single();
      if (lookupError || !profile) {
        submitBtn.disabled = false;
        editError.textContent = labels.userNotFound;
        editError.hidden = false;
        return;
      }
      const { error } = await supabase.rpc('admin_create_result', {
        p_user_id: profile.id,
        p_pull_ups: pullUps,
        p_dips: dips,
        p_youtube_url: youtubeUrl,
        p_youtube_video_id: videoId,
        p_status: status,
        p_reason: reason,
      });
      submitBtn.disabled = false;
      if (error) {
        editError.textContent = labels.createError;
        editError.hidden = false;
        return;
      }
    }

    submitBtn.disabled = false;
    editDialog.close();
    resetAndReload();
  });

  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    deleteError.hidden = true;
    const reason = deleteForm.reason.value.trim();
    const submitBtn = deleteForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await supabase.rpc('admin_delete_result', { p_result_id: pendingDeleteId, p_reason: reason });
    submitBtn.disabled = false;
    if (error) {
      deleteError.textContent = labels.deleteError;
      deleteError.hidden = false;
      return;
    }
    deleteDialog.close();
    resetAndReload();
  });

  async function loadPage() {
    const { data, error } = await supabase
      .from('results')
      .select('id, user_id, pull_ups, dips, total, status, youtube_url, youtube_video_id, submitted_at, profiles:user_id(username, display_name)')
      .order('submitted_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { error };
    return { rows: data ?? [] };
  }

  async function resetAndReload() {
    offset = 0;
    tbody.innerHTML = '';
    showState('loading');

    const { rows, error } = await loadPage();
    if (error) {
      showState('error');
      return;
    }
    if (rows.length === 0) {
      showState('empty');
      return;
    }
    showState('content');
    rows.forEach((r) => tbody.appendChild(buildRow(r)));
    offset = rows.length;
    if (loadMoreBtn) loadMoreBtn.hidden = rows.length < PAGE_SIZE;
  }

  loadMoreBtn?.addEventListener('click', async () => {
    loadMoreBtn.disabled = true;
    const { rows, error } = await loadPage();
    loadMoreBtn.disabled = false;
    if (error || rows.length === 0) {
      loadMoreBtn.hidden = true;
      return;
    }
    rows.forEach((r) => tbody.appendChild(buildRow(r)));
    offset += rows.length;
    loadMoreBtn.hidden = rows.length < PAGE_SIZE;
  });

  root.querySelectorAll('[data-action="retry"]').forEach((btn) => btn.addEventListener('click', resetAndReload));

  [editDialog, deleteDialog].forEach((dialog) => {
    dialog.querySelectorAll('[data-action="cancel-dialog"]').forEach((btn) => {
      btn.addEventListener('click', () => dialog.close());
    });
  });

  showState('checking');
  getSession().then(async (session) => {
    if (!session) {
      showState('denied');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
    if (!profile?.is_admin) {
      showState('denied');
      return;
    }
    if (createBtn) createBtn.hidden = false;
    resetAndReload();
  });
}
