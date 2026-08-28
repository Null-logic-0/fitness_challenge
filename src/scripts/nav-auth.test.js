import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock('../db/supabase.js', () => ({ supabase: { from: vi.fn() } }));

import { getSession, signOut, onAuthStateChange } from './auth.js';
import { supabase } from '../db/supabase.js';
import { initNavAuth } from './nav-auth.js';

function buildFixture() {
  document.body.innerHTML = `
    <nav>
      <div data-auth-state="guest"></div>
      <div data-auth-state="user"></div>
      <span data-user-name></span>
      <span data-user-initial></span>
      <a data-admin-only>Admin</a>
      <button data-action="logout">Log out</button>
    </nav>`;
}

function adminBuilder(isAdmin) {
  return {
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    single: vi.fn(() => Promise.resolve({ data: { is_admin: isAdmin } })),
  };
}

describe('initNavAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildFixture();
  });

  it('shows the guest nav and hides the admin link when signed out', async () => {
    getSession.mockResolvedValue(null);
    initNavAuth();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-auth-state="guest"]').hidden).toBe(false);
    expect(document.querySelector('[data-auth-state="user"]').hidden).toBe(true);
    expect(document.querySelector('[data-admin-only]').hidden).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('shows the signed-in nav with the display name and initial when signed in', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com', user_metadata: { display_name: 'Luka' } } });
    supabase.from.mockReturnValue(adminBuilder(false));
    initNavAuth();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-auth-state="user"]').hidden).toBe(false);
    expect(document.querySelector('[data-auth-state="guest"]').hidden).toBe(true);
    expect(document.querySelector('[data-user-name]').textContent).toBe('Luka');
    expect(document.querySelector('[data-user-initial]').textContent).toBe('L');
  });

  it('falls back to email when there is no display_name', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com', user_metadata: {} } });
    supabase.from.mockReturnValue(adminBuilder(false));
    initNavAuth();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-user-name]').textContent).toBe('a@b.com');
    expect(document.querySelector('[data-user-initial]').textContent).toBe('A');
  });

  it('reveals the admin link only once profiles.is_admin resolves true', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com', user_metadata: { display_name: 'Luka' } } });
    supabase.from.mockReturnValue(adminBuilder(true));
    initNavAuth();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(document.querySelector('[data-admin-only]').hidden).toBe(false);
  });

  it('re-renders when onAuthStateChange fires with a new session', async () => {
    getSession.mockResolvedValue(null);
    initNavAuth();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-auth-state="user"]').hidden).toBe(true);

    supabase.from.mockReturnValue(adminBuilder(false));
    const handler = onAuthStateChange.mock.calls[0][0];
    handler({ user: { id: 'u2', email: 'x@y.com', user_metadata: {} } });
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('[data-auth-state="user"]').hidden).toBe(false);
  });

  it('signs out and reloads the page when the logout button is clicked', async () => {
    getSession.mockResolvedValue(null);
    signOut.mockResolvedValue(undefined);
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, writable: true, configurable: true });
    initNavAuth();
    await Promise.resolve();

    document.querySelector('[data-action="logout"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(signOut).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});
