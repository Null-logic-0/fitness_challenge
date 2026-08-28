import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  getPendingResult: vi.fn(() => null),
}));

import { signIn, signUp, getPendingResult } from './auth.js';
import { initAuthForm } from './auth-form.js';

const messages = {
  invalidCredentials: 'Invalid credentials',
  emailInUse: 'Email in use',
  weakPassword: 'Weak password',
  genericError: 'Something went wrong',
  submitting: 'Submitting...',
  pendingResultNotice: 'You have {total} reps pending',
  confirmEmailBody: 'Check {email} to confirm',
};

function setLocation({ search = '', origin = 'https://5minchallenge.com', pathname = '/en/login' } = {}) {
  delete window.location;
  window.location = { search, origin, pathname, href: '' };
}

function buildLoginFixture() {
  setLocation();
  document.body.innerHTML = `
    <div id="root" data-mode="login" data-messages='${JSON.stringify(messages)}' data-default-redirect="/en/dashboard">
      <p data-pending-notice hidden></p>
      <a data-switch-link href="/en/register">Register</a>
      <form>
        <input name="email" value="a@b.com" />
        <input name="password" type="password" value="secret123" />
        <button data-submit-btn type="submit"><span data-submit-label>Log in</span></button>
      </form>
      <p data-error hidden></p>
    </div>`;
  return document.getElementById('root');
}

function buildRegisterFixture() {
  setLocation();
  document.body.innerHTML = `
    <div id="root" data-mode="register" data-messages='${JSON.stringify(messages)}' data-default-redirect="/en/dashboard">
      <p data-pending-notice hidden></p>
      <div data-confirm-email hidden><p data-confirm-email-body></p></div>
      <form hidden>
        <input name="email" value="a@b.com" />
        <input name="password" type="password" value="secret123" />
        <input name="displayName" value=" Luka " />
        <input name="country" value=" GE " />
        <input name="ageRange" value="25-34" />
        <input name="gender" value="men" />
        <button data-submit-btn type="submit"><span data-submit-label>Sign up</span></button>
      </form>
      <p data-error hidden></p>
    </div>`;
  document.querySelector('form').hidden = false;
  return document.getElementById('root');
}

function submit(root) {
  const form = root.querySelector('form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('initAuthForm — pending result notice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the notice with the total when a pending result exists', () => {
    getPendingResult.mockReturnValue({ pullUps: 40, dips: 50 });
    const root = buildLoginFixture();
    initAuthForm(root);
    const notice = root.querySelector('[data-pending-notice]');
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('You have 90 reps pending');
  });

  it('leaves the notice hidden when there is no pending result', () => {
    getPendingResult.mockReturnValue(null);
    const root = buildLoginFixture();
    initAuthForm(root);
    expect(root.querySelector('[data-pending-notice]').hidden).toBe(true);
  });
});

describe('initAuthForm — redirect propagation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends ?redirect to the switch link when present in the URL', () => {
    setLocation({ search: '?redirect=%2Fen%2Fsubmit' });
    document.body.innerHTML = `
      <div id="root" data-mode="login" data-messages='${JSON.stringify(messages)}'>
        <a data-switch-link href="/en/register">Register</a>
        <form><input name="email" /><input name="password" /></form>
      </div>`;
    initAuthForm(document.getElementById('root'));
    expect(document.querySelector('[data-switch-link]').getAttribute('href')).toBe('/en/register?redirect=%2Fen%2Fsubmit');
  });

  it('does not touch the switch link when there is no redirect param', () => {
    const root = buildLoginFixture();
    initAuthForm(root);
    expect(root.querySelector('[data-switch-link]').getAttribute('href')).toBe('/en/register');
  });
});

describe('initAuthForm — login submit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to the default redirect on success with no ?redirect param', async () => {
    signIn.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    const root = buildLoginFixture();
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(signIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' });
    expect(window.location.href).toBe('/en/dashboard');
  });

  it('redirects to the ?redirect target when present, overriding the default', async () => {
    setLocation({ search: '?redirect=%2Fen%2Fsubmit' });
    signIn.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    document.body.innerHTML = `
      <div id="root" data-mode="login" data-messages='${JSON.stringify(messages)}' data-default-redirect="/en/dashboard">
        <form>
          <input name="email" value="a@b.com" />
          <input name="password" value="secret123" />
        </form>
      </div>`;
    const root = document.getElementById('root');
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(window.location.href).toBe('/en/submit');
  });

  it.each([
    ['Invalid login credentials', 'Invalid credentials'],
    ['User already registered', 'Email in use'],
    ['Password should be at least 6 characters', 'Weak password'],
    ['Some unrelated failure', 'Something went wrong'],
  ])('maps error message %j to %j and re-enables the form', async (raw, mapped) => {
    signIn.mockResolvedValue({ error: { message: raw } });
    const root = buildLoginFixture();
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    const errorEl = root.querySelector('[data-error]');
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toBe(mapped);
    expect(root.querySelector('[data-submit-btn]').disabled).toBe(false);
    expect(root.querySelector('[data-submit-label]').textContent).toBe('Log in');
    expect(window.location.href).toBe('');
  });
});

describe('initAuthForm — register submit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes trimmed profile fields to signUp', async () => {
    signUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    const root = buildRegisterFixture();
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
      displayName: 'Luka',
      country: 'GE',
      ageRange: '25-34',
      category: 'men',
    });
    expect(window.location.href).toBe('/en/dashboard');
  });

  it('shows the confirm-email panel instead of redirecting when signUp returns no session', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const root = buildRegisterFixture();
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('form').hidden).toBe(true);
    const panel = root.querySelector('[data-confirm-email]');
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('[data-confirm-email-body]').textContent).toBe('Check a@b.com to confirm');
    expect(root.querySelector('[data-submit-btn]').disabled).toBe(false);
    expect(window.location.href).toBe('');
  });

  it('shows a mapped error and re-enables the form when signUp fails', async () => {
    signUp.mockResolvedValue({ error: { message: 'already exists' } });
    const root = buildRegisterFixture();
    initAuthForm(root);
    submit(root);
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-error]').textContent).toBe('Email in use');
    expect(root.querySelector('form').hidden).toBe(false);
  });
});
