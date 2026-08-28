import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../db/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock('./auth.js', () => ({ getSession: vi.fn() }));

import { supabase } from '../db/supabase.js';
import { getSession } from './auth.js';
import { createInviteLink, wireInviteButton, acceptInvite, completeInvite } from './invite.js';

function mockInsertBuilder(result) {
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe('createInviteLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an error and does not touch the db when there is no session', async () => {
    getSession.mockResolvedValue(null);
    const result = await createInviteLink({ resultId: 'r1', inviteBasePath: '/en/invite' });
    expect(result.error).toBeInstanceOf(Error);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts inviter_id/result_id and returns a URL built from the token', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const builder = mockInsertBuilder({ data: { token: 'tok123' }, error: null });
    supabase.from.mockReturnValue(builder);

    const result = await createInviteLink({ resultId: 'r1', inviteBasePath: '/en/invite' });

    expect(supabase.from).toHaveBeenCalledWith('invites');
    expect(builder.insert).toHaveBeenCalledWith({ inviter_id: 'u1', result_id: 'r1' });
    expect(result.url).toBe(`${window.location.origin}/en/invite/tok123`);
    expect(result.error).toBeUndefined();
  });

  it('passes a db error straight through', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const fakeError = new Error('insert failed');
    supabase.from.mockReturnValue(mockInsertBuilder({ data: null, error: fakeError }));

    const result = await createInviteLink({ resultId: 'r1', inviteBasePath: '/en/invite' });
    expect(result.error).toBe(fakeError);
    expect(result.url).toBeUndefined();
  });

  it('returns a generic error when there is no error but also no data', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(mockInsertBuilder({ data: null, error: null }));

    const result = await createInviteLink({ resultId: 'r1', inviteBasePath: '/en/invite' });
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('acceptInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the accept_invite RPC with p_token and returns data/error', async () => {
    supabase.rpc.mockResolvedValue({ data: 'ok', error: null });
    const result = await acceptInvite('tok123');
    expect(supabase.rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok123' });
    expect(result).toEqual({ data: 'ok', error: null });
  });
});

describe('completeInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the complete_invite RPC with p_token', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await completeInvite('tok456');
    expect(supabase.rpc).toHaveBeenCalledWith('complete_invite', { p_token: 'tok456' });
  });
});

describe('wireInviteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    delete window.location;
    window.location = { origin: 'https://5minchallenge.com', pathname: '/en/results/abc', href: '' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when the button is null', () => {
    expect(() => wireInviteButton(null, {})).not.toThrow();
  });

  it('redirects to login with a redirect param when signed out, without creating an invite', async () => {
    getSession.mockResolvedValue(null);
    document.body.innerHTML = `<button data-copied-label="Copied!"><span data-copy-label>Invite</span></button>`;
    const button = document.querySelector('button');
    wireInviteButton(button, { resultId: 'r1', inviteBasePath: '/en/invite', loginPath: '/en/login', generatingLabel: 'Generating...' });

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.location.href).toBe('/en/login?redirect=%2Fen%2Fresults%2Fabc');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('generates, copies, and shows the copied label, then reverts after 2.5s', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(mockInsertBuilder({ data: { token: 'tok123' }, error: null }));
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    document.body.innerHTML = `<button data-copied-label="Copied!"><span data-copy-label>Invite</span></button>`;
    const button = document.querySelector('button');
    wireInviteButton(button, { resultId: 'r1', inviteBasePath: '/en/invite', loginPath: '/en/login', generatingLabel: 'Generating...' });

    button.click();
    await vi.runAllTimersAsync();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://5minchallenge.com/en/invite/tok123');
    expect(button.disabled).toBe(false);
    expect(document.querySelector('[data-copy-label]').textContent).toBe('Invite');
  });

  it('reverts the label and re-enables the button when invite creation fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(mockInsertBuilder({ data: null, error: new Error('db error') }));

    document.body.innerHTML = `<button data-copied-label="Copied!"><span data-copy-label>Invite</span></button>`;
    const button = document.querySelector('button');
    wireInviteButton(button, { resultId: 'r1', inviteBasePath: '/en/invite', loginPath: '/en/login', generatingLabel: 'Generating...' });

    button.click();
    await vi.runAllTimersAsync();

    expect(button.disabled).toBe(false);
    expect(document.querySelector('[data-copy-label]').textContent).toBe('Invite');
  });

  it('reverts the label when the clipboard write fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    supabase.from.mockReturnValue(mockInsertBuilder({ data: { token: 'tok123' }, error: null }));
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    document.body.innerHTML = `<button data-copied-label="Copied!"><span data-copy-label>Invite</span></button>`;
    const button = document.querySelector('button');
    wireInviteButton(button, { resultId: 'r1', inviteBasePath: '/en/invite', loginPath: '/en/login', generatingLabel: 'Generating...' });

    button.click();
    await vi.runAllTimersAsync();

    expect(document.querySelector('[data-copy-label]').textContent).toBe('Invite');
  });
});
