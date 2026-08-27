import { getSession, signOut, onAuthStateChange } from './auth.js';

/**
 * Toggles the guest/signed-in nav variants (desktop bar + mobile drawer)
 * based on Supabase auth state, and wires the logout button. Renders as
 * "guest" by default in the markup so there's no protected content to
 * flash — this only swaps which nav links are visible.
 */
export function initNavAuth() {
  const guestEls = document.querySelectorAll('[data-auth-state="guest"]');
  const userEls = document.querySelectorAll('[data-auth-state="user"]');
  const nameEls = document.querySelectorAll('[data-user-name]');
  const initialEls = document.querySelectorAll('[data-user-initial]');
  const logoutBtns = document.querySelectorAll('[data-action="logout"]');

  function render(session) {
    const loggedIn = !!session;
    guestEls.forEach((el) => { el.hidden = loggedIn; });
    userEls.forEach((el) => { el.hidden = !loggedIn; });
    if (loggedIn) {
      const name = session.user.user_metadata?.display_name || session.user.email || '';
      nameEls.forEach((el) => { el.textContent = name; });
      initialEls.forEach((el) => { el.textContent = name.charAt(0).toUpperCase() || '•'; });
    }
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
