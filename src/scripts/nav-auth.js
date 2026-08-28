import { getSession, signOut, onAuthStateChange } from './auth.js';
import { supabase } from '../db/supabase.js';

/**
 * Toggles the guest/signed-in nav variants (desktop bar + mobile drawer)
 * based on Supabase auth state, and wires the logout button. Renders as
 * "guest" by default in the markup so there's no protected content to
 * flash — this only swaps which nav links are visible. Also reveals the
 * "Admin" link for accounts with profiles.is_admin, purely as a UX
 * convenience — the real gate is the admin panel's own access check plus
 * the admin_* RPCs, not this link's visibility.
 */
export function initNavAuth() {
  const guestEls = document.querySelectorAll('[data-auth-state="guest"]');
  const userEls = document.querySelectorAll('[data-auth-state="user"]');
  const nameEls = document.querySelectorAll('[data-user-name]');
  const initialEls = document.querySelectorAll('[data-user-initial]');
  const adminEls = document.querySelectorAll('[data-admin-only]');
  const logoutBtns = document.querySelectorAll('[data-action="logout"]');

  function render(session) {
    const loggedIn = !!session;
    guestEls.forEach((el) => { el.hidden = loggedIn; });
    userEls.forEach((el) => { el.hidden = !loggedIn; });
    if (!loggedIn) {
      adminEls.forEach((el) => { el.hidden = true; });
      return;
    }

    const name = session.user.user_metadata?.display_name || session.user.email || '';
    nameEls.forEach((el) => { el.textContent = name; });
    initialEls.forEach((el) => { el.textContent = name.charAt(0).toUpperCase() || '•'; });

    supabase.from('profiles').select('is_admin').eq('id', session.user.id).single().then(({ data }) => {
      adminEls.forEach((el) => { el.hidden = !data?.is_admin; });
    });
  }

  getSession().then(render);
  onAuthStateChange(render);

  logoutBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      await signOut();
      window.location.reload();
    });
  });
}
