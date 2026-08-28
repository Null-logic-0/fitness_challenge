import { supabase } from '../db/supabase.js';

/** @returns {Promise<import('@supabase/supabase-js').Session|null>} */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * @param {{email: string, password: string, displayName: string, country?: string, ageRange?: string, category?: 'open'|'men'|'women'}} params
 */
export function signUp({ email, password, displayName, country, ageRange, category }) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        country: country || null,
        age_range: ageRange || null,
        category: category || 'open',
      },
    },
  });
}

/** @param {{email: string, password: string}} params */
export function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

/**
 * Updates auth-level user metadata (display_name/country) so the navbar and
 * anywhere else reading `session.user.user_metadata` stays in sync with a
 * profile edit made on the settings page — without this, the old name would
 * keep showing until the next full login.
 * @param {{displayName?: string, country?: string}} params
 */
export function updateAuthMetadata({ displayName, country }) {
  return supabase.auth.updateUser({ data: { display_name: displayName, country } });
}

/** @param {string} newPassword */
export function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

/** @param {(session: import('@supabase/supabase-js').Session|null) => void} callback */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ---------------------------------------------------------------------------
// Pending result: a just-completed attempt from a signed-out visitor,
// preserved across the register/login round-trip so they don't have to
// repeat the 5-minute challenge just to save it.
// ---------------------------------------------------------------------------
const PENDING_RESULT_KEY = '5min-pending-result';

/** @param {{pullUps: number, dips: number}} result */
export function savePendingResult(result) {
  try {
    localStorage.setItem(PENDING_RESULT_KEY, JSON.stringify({ ...result, savedAt: Date.now() }));
  } catch {
    /* storage unavailable — the CTA still links to register/login, it just won't autofill */
  }
}

export function getPendingResult() {
  try {
    const raw = localStorage.getItem(PENDING_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingResult() {
  try {
    localStorage.removeItem(PENDING_RESULT_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Pending invite: an invite token an unauthenticated visitor tried to
// accept, preserved across the register/login round-trip.
// ---------------------------------------------------------------------------
const PENDING_INVITE_KEY = '5min-pending-invite';

/** @param {string} token */
export function savePendingInvite(token) {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function getPendingInvite() {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* ignore */
  }
}
