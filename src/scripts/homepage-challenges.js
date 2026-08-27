import { supabase } from '../db/supabase.js';
import { formatNumber } from '../utils/format.js';

/**
 * Replaces the homepage's static "no challenges yet" fallback with up to two
 * real recent invites, if any exist. Uses a <template> + clone rather than
 * innerHTML since the inviter's display name is user-supplied text.
 * @param {HTMLElement} root
 */
export async function loadRecentChallenges(root) {
  const lang = root.dataset.lang;
  const titleTemplate = root.dataset.inviteTitleTemplate;
  const subLabel = root.dataset.canYouBeat;
  const acceptLabel = root.dataset.acceptLabel;
  const inviteBasePath = root.dataset.inviteBasePath;

  const { data } = await supabase
    .from('invites')
    .select('token, created_at, results:result_id(total), profiles:inviter_id(display_name)')
    .order('created_at', { ascending: false })
    .limit(2);

  if (!data || data.length === 0) return; // keep the static "be the first" fallback

  const template = root.querySelector('[data-challenge-template]');
  const container = root.querySelector('[data-challenge-list]');
  if (!(template instanceof HTMLTemplateElement) || !container) return;

  container.innerHTML = '';
  data.forEach((invite) => {
    const name = invite.profiles?.display_name ?? '';
    const total = invite.results?.total ?? 0;
    const node = template.content.cloneNode(true);

    node.querySelector('[data-challenge-title]').textContent = titleTemplate
      .replace('{name}', name)
      .replace('{score}', formatNumber(lang, total));
    node.querySelector('[data-challenge-sub]').textContent = subLabel;

    const cta = node.querySelector('[data-challenge-cta]');
    cta.textContent = acceptLabel;
    cta.setAttribute('href', `${inviteBasePath}/${invite.token}`);

    container.appendChild(node);
  });
}
