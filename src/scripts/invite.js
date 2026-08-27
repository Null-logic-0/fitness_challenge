import { supabase } from '../db/supabase.js';
import { getSession } from './auth.js';

/**
 * Creates a "challenge a friend" invite pointing at a result and returns the
 * shareable URL. Requires an authenticated session — RLS only allows an
 * invite's inviter_id to be the caller's own uid (see
 * supabase/migrations/0001_init.sql), regardless of whose result it links to.
 * @param {{resultId: string, inviteBasePath: string}} params
 * @returns {Promise<{url?: string, error?: Error}>}
 */
export async function createInviteLink({ resultId, inviteBasePath }) {
  const session = await getSession();
  if (!session) return { error: new Error('not signed in') };

  const { data, error } = await supabase
    .from('invites')
    .insert({ inviter_id: session.user.id, result_id: resultId })
    .select('token')
    .single();

  if (error || !data) return { error: error ?? new Error('insert failed') };
  return { url: `${window.location.origin}${inviteBasePath}/${data.token}` };
}

/**
 * Wires an "Invite friends" button: on click, signs-in-gates, creates the
 * invite, and copies the link — mirroring the other copy buttons' UX.
 * @param {HTMLElement|null} button
 * @param {{resultId: string, inviteBasePath: string, loginPath: string, generatingLabel: string}} config
 */
export function wireInviteButton(button, config) {
  if (!button) return;
  const label = button.querySelector('[data-copy-label]') ?? button;
  const defaultText = label.textContent;
  const copiedText = button.dataset.copiedLabel ?? defaultText;

  button.addEventListener('click', async () => {
    const session = await getSession();
    if (!session) {
      window.location.href = `${config.loginPath}?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    button.disabled = true;
    label.textContent = config.generatingLabel;

    const { url, error } = await createInviteLink({
      resultId: config.resultId,
      inviteBasePath: config.inviteBasePath,
    });

    button.disabled = false;
    if (error || !url) {
      label.textContent = defaultText;
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      label.textContent = copiedText;
      setTimeout(() => { label.textContent = defaultText; }, 2500);
    } catch {
      label.textContent = defaultText;
    }
  });
}

/**
 * @param {string} token
 * @returns {Promise<{data?: string, error?: object}>}
 */
export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  return { data, error };
}

/** @param {string} token */
export async function completeInvite(token) {
  return supabase.rpc('complete_invite', { p_token: token });
}
