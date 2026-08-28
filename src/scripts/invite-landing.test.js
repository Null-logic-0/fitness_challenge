import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auth.js', () => ({ getSession: vi.fn(), savePendingInvite: vi.fn() }));
vi.mock('./invite.js', () => ({ acceptInvite: vi.fn() }));

import { getSession, savePendingInvite } from './auth.js';
import { acceptInvite } from './invite.js';
import { initInviteLanding } from './invite-landing.js';

function buildButton() {
  document.body.innerHTML = `<button id="accept">Accept challenge</button>`;
  return document.getElementById('accept');
}

const config = { token: 'tok123', challengePath: '/en/challenge', registerPath: '/en/register' };

describe('initInviteLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.location;
    window.location = { href: '' };
  });

  it('saves the pending invite and disables the button immediately on click', () => {
    getSession.mockReturnValue(new Promise(() => {})); // never resolves, to inspect the sync part
    const button = buildButton();
    initInviteLanding(button, config);

    button.click();

    expect(savePendingInvite).toHaveBeenCalledWith('tok123');
    expect(button.disabled).toBe(true);
  });

  it('accepts the invite and redirects to the challenge path when already signed in', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    acceptInvite.mockResolvedValue({ data: 'ok' });
    const button = buildButton();
    initInviteLanding(button, config);

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(acceptInvite).toHaveBeenCalledWith('tok123');
    expect(window.location.href).toBe('/en/challenge');
  });

  it('redirects to register with a redirect param, without accepting, when signed out', async () => {
    getSession.mockResolvedValue(null);
    const button = buildButton();
    initInviteLanding(button, config);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(acceptInvite).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/en/register?redirect=%2Fen%2Fchallenge');
  });
});
