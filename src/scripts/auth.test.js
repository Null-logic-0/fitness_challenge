import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

import { supabase } from '../db/supabase.js';
import {
  getSession,
  signUp,
  signIn,
  signOut,
  updateAuthMetadata,
  updatePassword,
  onAuthStateChange,
  savePendingResult,
  getPendingResult,
  clearPendingResult,
  savePendingInvite,
  getPendingInvite,
  clearPendingInvite,
} from './auth.js';

describe('getSession', () => {
  it('unwraps data.session from the Supabase response', async () => {
    const fakeSession = { user: { id: 'u1' } };
    supabase.auth.getSession.mockResolvedValue({ data: { session: fakeSession } });
    expect(await getSession()).toBe(fakeSession);
  });

  it('returns null when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await getSession()).toBeNull();
  });
});

describe('signUp', () => {
  it('passes email/password through and nests profile fields under options.data', () => {
    signUp({ email: 'a@b.com', password: 'secret123', displayName: 'Luka', country: 'GE', ageRange: '25-34', category: 'men' });
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
      options: { data: { display_name: 'Luka', country: 'GE', age_range: '25-34', category: 'men' } },
    });
  });

  it('defaults category to "open" when not provided', () => {
    signUp({ email: 'a@b.com', password: 'secret123', displayName: 'Luka' });
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: expect.objectContaining({ category: 'open' }) } }),
    );
  });

  it('normalizes an empty country/ageRange to null rather than an empty string', () => {
    signUp({ email: 'a@b.com', password: 'secret123', displayName: 'Luka', country: '', ageRange: '' });
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: expect.objectContaining({ country: null, age_range: null }) } }),
    );
  });
});

describe('signIn', () => {
  it('delegates to signInWithPassword', () => {
    signIn({ email: 'a@b.com', password: 'secret123' });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' });
  });
});

describe('signOut', () => {
  it('delegates to supabase.auth.signOut', () => {
    signOut();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

describe('updateAuthMetadata', () => {
  it('updates display_name and country via updateUser', () => {
    updateAuthMetadata({ displayName: 'New Name', country: 'US' });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { display_name: 'New Name', country: 'US' } });
  });
});

describe('updatePassword', () => {
  it('updates only the password field', () => {
    updatePassword('newpassword123');
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
  });
});

describe('onAuthStateChange', () => {
  it('unwraps (event, session) into just session for the callback', () => {
    const callback = vi.fn();
    onAuthStateChange(callback);
    const registeredHandler = supabase.auth.onAuthStateChange.mock.calls[0][0];
    const fakeSession = { user: { id: 'u1' } };
    registeredHandler('SIGNED_IN', fakeSession);
    expect(callback).toHaveBeenCalledWith(fakeSession);
  });
});

describe('pending result storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips pull-ups/dips and stamps a savedAt time', () => {
    const before = Date.now();
    savePendingResult({ pullUps: 41, dips: 51 });
    const result = getPendingResult();
    expect(result.pullUps).toBe(41);
    expect(result.dips).toBe(51);
    expect(result.savedAt).toBeGreaterThanOrEqual(before);
  });

  it('returns null when nothing is pending', () => {
    expect(getPendingResult()).toBeNull();
  });

  it('clears the pending result', () => {
    savePendingResult({ pullUps: 1, dips: 2 });
    clearPendingResult();
    expect(getPendingResult()).toBeNull();
  });

  it('returns null instead of throwing on malformed JSON in storage', () => {
    localStorage.setItem('5min-pending-result', 'not-json{{{');
    expect(getPendingResult()).toBeNull();
  });
});

describe('pending invite storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a token', () => {
    savePendingInvite('abc123');
    expect(getPendingInvite()).toBe('abc123');
  });

  it('returns null when nothing is pending', () => {
    expect(getPendingInvite()).toBeNull();
  });

  it('clears the pending invite', () => {
    savePendingInvite('abc123');
    clearPendingInvite();
    expect(getPendingInvite()).toBeNull();
  });
});
