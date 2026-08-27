import { supabase } from '../db/supabase.js';

/** @returns {Promise<import('@supabase/supabase-js').Session|null>} */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * @param {{email: string, password: string, displayName: string, country?: string}} params
 */
export function signUp({ email, password, displayName, country }) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, country: country || null } },
  });
}

/** @param {{email: string, password: string}} params */
export function signIn({ email, password }) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
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
