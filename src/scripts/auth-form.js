import { signIn, signUp, getPendingResult } from './auth.js';

/**
 * Wires up the login/register form: submits via Supabase auth, maps error
 * messages to localized copy, and — the whole point of this module —
 * carries a `?redirect=` target through so a visitor who started an
 * unauthenticated attempt lands back where they were (usually /submit)
 * instead of a generic homepage.
 * @param {HTMLElement} root
 */
export function initAuthForm(root) {
  const mode = root.dataset.mode; // 'login' | 'register'
  const messages = JSON.parse(root.dataset.messages);
  const defaultRedirect = root.dataset.defaultRedirect || '/';

  const form = root.querySelector('form');
  const errorEl = root.querySelector('[data-error]');
  const submitBtn = root.querySelector('[data-submit-btn]');
  const submitLabel = submitBtn?.querySelector('[data-submit-label]');
  const defaultLabel = submitLabel?.textContent ?? '';
  const noticeEl = root.querySelector('[data-pending-notice]');
  const confirmPanel = root.querySelector('[data-confirm-email]');

  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get('redirect') || defaultRedirect;

  const switchLink = root.querySelector('[data-switch-link]');
  if (switchLink && params.get('redirect')) {
    const url = new URL(switchLink.getAttribute('href'), window.location.origin);
    url.searchParams.set('redirect', params.get('redirect'));
    switchLink.setAttribute('href', `${url.pathname}${url.search}`);
  }

  const pending = getPendingResult();
  if (pending && noticeEl) {
    const total = Number(pending.pullUps || 0) + Number(pending.dips || 0);
    noticeEl.textContent = messages.pendingResultNotice.replace('{total}', String(total));
    noticeEl.hidden = false;
  }

  function mapError(error) {
    const msg = error?.message || '';
    if (/invalid login credentials/i.test(msg)) return messages.invalidCredentials;
    if (/already registered|already exists|user already/i.test(msg)) return messages.emailInUse;
    if (/password/i.test(msg)) return messages.weakPassword;
    return messages.genericError;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = messages.submitting;

    const email = form.email.value.trim();
    const password = form.password.value;

    const result =
      mode === 'register'
        ? await signUp({
            email,
            password,
            displayName: form.displayName.value.trim(),
            country: form.country?.value.trim(),
            ageRange: form.ageRange?.value,
            category: form.gender?.value,
          })
        : await signIn({ email, password });

    if (result.error) {
      if (errorEl) {
        errorEl.textContent = mapError(result.error);
        errorEl.hidden = false;
      }
      if (submitBtn) submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = defaultLabel;
      return;
    }

    // Supabase projects with "confirm email" enabled return no session on
    // signUp — the account exists, but can't log in until the link is
    // clicked. The pending result stays in localStorage either way.
    if (mode === 'register' && !result.data.session) {
      form.hidden = true;
      if (confirmPanel) {
        confirmPanel.hidden = false;
        const body = confirmPanel.querySelector('[data-confirm-email-body]');
        if (body) body.textContent = messages.confirmEmailBody.replace('{email}', email);
      }
      if (submitBtn) submitBtn.disabled = false;
      if (submitLabel) submitLabel.textContent = defaultLabel;
      return;
    }

    window.location.href = redirectTo;
  });
}
