import { getSession, savePendingInvite } from './auth.js';
import { acceptInvite } from './invite.js';

/**
 * Wires the invite landing page's "Accept challenge" button. The token is
 * always stashed in localStorage first — challenge.js picks it up and
 * (re-)calls accept_invite once a session exists, and submission.js marks
 * the invite completed once the invitee actually submits a result. That
 * covers both the already-signed-in path and the register-then-return path.
 * @param {HTMLElement} button
 * @param {{token: string, challengePath: string, registerPath: string}} config
 */
export function initInviteLanding(button, config) {
  button.addEventListener('click', async () => {
    savePendingInvite(config.token);
    button.disabled = true;

    const session = await getSession();
    if (session) {
      await acceptInvite(config.token);
      window.location.href = config.challengePath;
      return;
    }

    window.location.href = `${config.registerPath}?redirect=${encodeURIComponent(config.challengePath)}`;
  });
}
