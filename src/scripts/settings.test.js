import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({
  getSession: vi.fn(),
  updateAuthMetadata: vi.fn(),
  updatePassword: vi.fn(),
}));
vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));

import { getSession, updateAuthMetadata, updatePassword } from './auth.js';
import { supabase } from '../db/supabase.js';
import { initSettings } from './settings.js';

const labels = {
  profileSaveError: 'Could not save profile',
  passwordMismatch: 'Passwords do not match',
  passwordSaveError: 'Could not update password',
};

function setLocation({ pathname = '/en/settings' } = {}) {
  delete window.location;
  window.location = { pathname, href: '' };
}

function buildFixture() {
  setLocation();
  document.body.innerHTML = `
    <div id="root" data-labels='${JSON.stringify(labels)}' data-login-path="/en/login">
      <div data-state="loading"></div>
      <div data-state="error" hidden><button data-action="retry">Retry</button></div>
      <div data-state="content" hidden>
        <form data-profile-form>
          <input name="displayName" />
          <input name="country" />
          <select name="ageRange">
            <option value="18-24">18-24</option>
            <option value="25-34">25-34</option>
          </select>
          <select name="gender">
            <option value="open">Open</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
          <button type="submit">Save</button>
        </form>
        <p data-profile-error hidden></p>
        <p data-profile-success hidden></p>

        <form data-password-form>
          <input name="newPassword" type="password" />
          <input name="confirmPassword" type="password" />
          <button type="submit">Update password</button>
        </form>
        <p data-password-error hidden></p>
        <p data-password-success hidden></p>
      </div>
    </div>`;
  return document.getElementById('root');
}

function profileBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => resolve(result),
  };
  return builder;
}

function submitForm(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('initSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to login with a redirect param when signed out', async () => {
    getSession.mockResolvedValue(null);
    initSettings(buildFixture());
    await Promise.resolve();
    await Promise.resolve();

    expect(window.location.href).toBe('/en/login?redirect=%2Fen%2Fsettings');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('loads the profile into the form and shows the content state', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(profileBuilder({
      data: { display_name: 'Luka', country: 'GE', age_range: '25-34', category: 'men' },
      error: null,
    }));
    const root = buildFixture();
    initSettings(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
    expect(root.querySelector('[name="displayName"]').value).toBe('Luka');
    expect(root.querySelector('[name="country"]').value).toBe('GE');
    expect(root.querySelector('[name="ageRange"]').value).toBe('25-34');
    expect(root.querySelector('[name="gender"]').value).toBe('men');
  });

  it('leaves ageRange at its default when the profile has none set', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(profileBuilder({
      data: { display_name: '', country: '', age_range: null, category: null },
      error: null,
    }));
    const root = buildFixture();
    initSettings(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[name="ageRange"]').value).toBe('18-24');
    expect(root.querySelector('[name="gender"]').value).toBe('open');
  });

  it('shows the error state when the profile fails to load, and retry reloads it', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(profileBuilder({ data: null, error: { message: 'boom' } }));
    const root = buildFixture();
    initSettings(root);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="error"]').hidden).toBe(false);

    supabase.from.mockReturnValue(profileBuilder({
      data: { display_name: 'Luka', country: 'GE', age_range: '25-34', category: 'men' },
      error: null,
    }));
    root.querySelector('[data-action="retry"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.querySelector('[data-state="content"]').hidden).toBe(false);
  });

  describe('profile form submit', () => {
    async function setupLoaded() {
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      supabase.from.mockReturnValue(profileBuilder({
        data: { display_name: 'Luka', country: 'GE', age_range: '25-34', category: 'men' },
        error: null,
      }));
      const root = buildFixture();
      initSettings(root);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      return root;
    }

    it('saves the trimmed profile fields and shows success', async () => {
      const root = await setupLoaded();
      const updateBuilder = { update: vi.fn(function () { return this; }), eq: vi.fn(() => Promise.resolve({ error: null })) };
      supabase.from.mockReturnValue(updateBuilder);
      updateAuthMetadata.mockResolvedValue({ error: null });

      root.querySelector('[name="displayName"]').value = ' New Name ';
      root.querySelector('[name="country"]').value = ' US ';
      submitForm(root.querySelector('[data-profile-form]'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(updateBuilder.update).toHaveBeenCalledWith({
        display_name: 'New Name',
        country: 'US',
        age_range: '25-34',
        category: 'men',
      });
      expect(updateAuthMetadata).toHaveBeenCalledWith({ displayName: 'New Name', country: 'US' });
      expect(root.querySelector('[data-profile-success]').hidden).toBe(false);
      expect(root.querySelector('[data-profile-error]').hidden).toBe(true);
    });

    it('shows an error when the profile update fails', async () => {
      const root = await setupLoaded();
      const updateBuilder = { update: vi.fn(function () { return this; }), eq: vi.fn(() => Promise.resolve({ error: { message: 'boom' } })) };
      supabase.from.mockReturnValue(updateBuilder);
      updateAuthMetadata.mockResolvedValue({ error: null });

      submitForm(root.querySelector('[data-profile-form]'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(root.querySelector('[data-profile-error]').hidden).toBe(false);
      expect(root.querySelector('[data-profile-error]').textContent).toBe('Could not save profile');
      expect(root.querySelector('[data-profile-success]').hidden).toBe(true);
    });

    it('shows an error when the auth metadata update fails even if the profile row saved', async () => {
      const root = await setupLoaded();
      const updateBuilder = { update: vi.fn(function () { return this; }), eq: vi.fn(() => Promise.resolve({ error: null })) };
      supabase.from.mockReturnValue(updateBuilder);
      updateAuthMetadata.mockResolvedValue({ error: { message: 'boom' } });

      submitForm(root.querySelector('[data-profile-form]'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(root.querySelector('[data-profile-error]').hidden).toBe(false);
    });
  });

  describe('password form submit', () => {
    async function setupLoaded() {
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      supabase.from.mockReturnValue(profileBuilder({
        data: { display_name: 'Luka', country: 'GE', age_range: '25-34', category: 'men' },
        error: null,
      }));
      const root = buildFixture();
      initSettings(root);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      return root;
    }

    it('shows a mismatch error and does not call updatePassword when the two fields differ', async () => {
      const root = await setupLoaded();
      root.querySelector('[name="newPassword"]').value = 'abc12345';
      root.querySelector('[name="confirmPassword"]').value = 'different';

      submitForm(root.querySelector('[data-password-form]'));
      await Promise.resolve();

      expect(updatePassword).not.toHaveBeenCalled();
      expect(root.querySelector('[data-password-error]').hidden).toBe(false);
      expect(root.querySelector('[data-password-error]').textContent).toBe('Passwords do not match');
    });

    it('updates the password, resets the form, and shows success on match', async () => {
      const root = await setupLoaded();
      updatePassword.mockResolvedValue({ error: null });
      root.querySelector('[name="newPassword"]').value = 'abc12345';
      root.querySelector('[name="confirmPassword"]').value = 'abc12345';

      submitForm(root.querySelector('[data-password-form]'));
      await Promise.resolve();
      await Promise.resolve();

      expect(updatePassword).toHaveBeenCalledWith('abc12345');
      expect(root.querySelector('[data-password-success]').hidden).toBe(false);
      expect(root.querySelector('[name="newPassword"]').value).toBe('');
    });

    it('shows an error when updatePassword fails', async () => {
      const root = await setupLoaded();
      updatePassword.mockResolvedValue({ error: { message: 'boom' } });
      root.querySelector('[name="newPassword"]').value = 'abc12345';
      root.querySelector('[name="confirmPassword"]').value = 'abc12345';

      submitForm(root.querySelector('[data-password-form]'));
      await Promise.resolve();
      await Promise.resolve();

      expect(root.querySelector('[data-password-error]').hidden).toBe(false);
      expect(root.querySelector('[data-password-error]').textContent).toBe('Could not update password');
    });
  });
});
