import { getSession } from './auth.js';
import { supabase } from '../db/supabase.js';
import { fetchLeaderboardPage, PAGE_SIZE } from '../db/leaderboard-query.js';
import { formatNumber } from '../utils/format.js';
import { getLocalizedPath, localeTags } from '../i18n/utils.js';
import { getCountryName } from '../utils/countries.js';

export function initials(name) {
  return (name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Real server-paginated leaderboard: the table is SSR'd with page 1 (so it
 * works and is crawlable with no JS at all), and this adds scope/time/
 * category filtering (each a fresh server query, not a client-side
 * hide/show) plus infinite scroll for subsequent pages, viewer highlighting,
 * and distinct loading/error/empty states.
 * @param {HTMLElement} root
 */
export function initLeaderboard(root) {
  const lang = root.dataset.lang;
  const tbody = root.querySelector('[data-rows]');
  const podiumSlots = Array.from(root.querySelectorAll('[data-podium-slot]'));
  const sentinel = root.querySelector('[data-sentinel]');
  const loadingMoreEl = root.querySelector('[data-loading-more]');
  const states = {
    error: root.querySelector('[data-state="error"]'),
    empty: root.querySelector('[data-state="empty"]'),
    content: root.querySelector('[data-state="content"]'),
  };

  const state = {
    scope: 'global',
    time: 'all',
    category: 'open',
    viewerCountry: null,
    viewerId: null,
    offset: Number(root.dataset.nextOffset || 0),
    hasMore: root.dataset.hasMore === 'true',
    loading: false,
  };

  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
  }

  function highlightIfViewer(row, userId) {
    if (!state.viewerId || userId !== state.viewerId) return;
    row.classList.add('bg-primary/10');
    const badge = row.querySelector('[data-you-badge]');
    if (badge) badge.hidden = false;
  }

  function buildRow(athlete, rank) {
    const tr = document.createElement('tr');
    tr.dataset.row = '';
    tr.dataset.userId = athlete.user_id;

    const rankTd = document.createElement('td');
    rankTd.className = 'font-stat font-bold';
    rankTd.textContent = String(rank);

    const athleteTd = document.createElement('td');
    const link = document.createElement('a');
    link.href = getLocalizedPath(lang, `/athletes/${athlete.username}`);
    link.className = 'flex items-center gap-3 focus-ring rounded-field';

    const avatar = document.createElement('div');
    avatar.className = 'avatar avatar-placeholder';
    avatar.innerHTML = '<div class="w-8 rounded-full bg-base-300 text-base-content"><span class="text-xs font-semibold"></span></div>';
    avatar.querySelector('span').textContent = initials(athlete.display_name);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'font-medium';
    nameSpan.append(document.createTextNode(athlete.display_name));
    const youBadge = document.createElement('span');
    youBadge.dataset.youBadge = '';
    youBadge.hidden = true;
    youBadge.className = 'badge badge-primary badge-sm ml-2';
    youBadge.textContent = root.dataset.youLabel;
    nameSpan.append(youBadge);

    const countrySpan = document.createElement('span');
    countrySpan.className = 'text-base-content/40';
    countrySpan.textContent = getCountryName(athlete.country, localeTags[lang]);

    link.append(avatar, nameSpan, countrySpan);
    athleteTd.appendChild(link);

    const pullUpsTd = document.createElement('td');
    pullUpsTd.className = 'font-stat text-right';
    pullUpsTd.textContent = formatNumber(lang, athlete.pull_ups);

    const dipsTd = document.createElement('td');
    dipsTd.className = 'font-stat text-right';
    dipsTd.textContent = formatNumber(lang, athlete.dips);

    const totalTd = document.createElement('td');
    totalTd.className = 'font-stat text-right font-bold';
    totalTd.textContent = formatNumber(lang, athlete.total);

    tr.append(rankTd, athleteTd, pullUpsTd, dipsTd, totalTd);
    highlightIfViewer(tr, athlete.user_id);
    return tr;
  }

  function updatePodium(rows) {
    const top3 = rows.slice(0, 3);
    podiumSlots.forEach((slot) => {
      const place = Number(slot.dataset.podiumSlot);
      const rankIndex = place === 1 ? 0 : place === 2 ? 1 : 2;
      const athlete = top3[rankIndex];
      if (!athlete) {
        slot.style.visibility = 'hidden';
        return;
      }
      slot.style.visibility = 'visible';
      slot.href = getLocalizedPath(lang, `/athletes/${athlete.username}`);
      const set = (sel, text) => {
        const el = slot.querySelector(sel);
        if (el) el.textContent = text;
      };
      set('[data-slot-initials]', initials(athlete.display_name));
      set('[data-slot-name]', athlete.display_name);
      set('[data-slot-country]', getCountryName(athlete.country, localeTags[lang]));
      set('[data-slot-total]', formatNumber(lang, athlete.total));
    });
  }

  async function loadFirstPage() {
    showState('content'); // optimistic; corrected below if empty/error
    if (loadingMoreEl) loadingMoreEl.hidden = false;
    tbody.innerHTML = '';
    state.offset = 0;

    const { rows, error, hasMore } = await fetchLeaderboardPage({
      scope: state.scope,
      time: state.time,
      category: state.category,
      viewerCountry: state.viewerCountry,
      offset: 0,
    });

    if (loadingMoreEl) loadingMoreEl.hidden = true;

    if (error) {
      showState('error');
      return;
    }
    if (rows.length === 0) {
      showState('empty');
      updatePodium([]);
      return;
    }

    showState('content');
    updatePodium(rows);
    rows.forEach((athlete, i) => tbody.appendChild(buildRow(athlete, i + 1)));
    state.offset = rows.length;
    state.hasMore = hasMore;
  }

  async function loadNextPage() {
    if (state.loading || !state.hasMore) return;
    state.loading = true;
    if (loadingMoreEl) loadingMoreEl.hidden = false;

    const { rows, error, hasMore } = await fetchLeaderboardPage({
      scope: state.scope,
      time: state.time,
      category: state.category,
      viewerCountry: state.viewerCountry,
      offset: state.offset,
    });

    state.loading = false;
    if (loadingMoreEl) loadingMoreEl.hidden = true;

    if (error) {
      state.hasMore = false; // stop retrying automatically; the section above still shows loaded rows
      return;
    }

    rows.forEach((athlete, i) => tbody.appendChild(buildRow(athlete, state.offset + i + 1)));
    state.offset += rows.length;
    state.hasMore = hasMore;
  }

  root.querySelectorAll('[data-filter-group]').forEach((group) => {
    const key = group.dataset.filterGroup;
    group.querySelectorAll('[data-filter-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('[data-filter-value]').forEach((b) => {
          b.classList.remove('tab-active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('tab-active');
        btn.setAttribute('aria-pressed', 'true');
        state[key] = btn.dataset.filterValue;
        loadFirstPage();
      });
    });
  });

  root.querySelectorAll('[data-action="retry"]').forEach((btn) => {
    btn.addEventListener('click', loadFirstPage);
  });

  if (sentinel && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadNextPage();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
  }

  // Highlighting "you" and enabling the Country scope both need to know who
  // is looking — resolved client-side since sessions live in localStorage,
  // not in a cookie the server-rendered table could read. The initial SSR
  // rows are re-checked once this resolves.
  getSession().then(async (session) => {
    if (!session) return;
    state.viewerId = session.user.id;
    const { data: profile } = await supabase.from('profiles').select('country').eq('id', session.user.id).single();
    state.viewerCountry = profile?.country ?? null;

    root.querySelectorAll('[data-row]').forEach((row) => highlightIfViewer(row, row.dataset.userId));
  });
}
