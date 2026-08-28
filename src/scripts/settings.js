import { getSession, updateAuthMetadata, updatePassword } from './auth.js';
import { supabase } from '../db/supabase.js';

/**
 * Wires up the settings page: loads the current profile into the form,
 * saves display name / country / age range back to profiles (allowed by
 * the profiles_update_own RLS policy) while also syncing auth user
 * metadata so the navbar reflects a name change immediately, and updates
 * the password via Supabase Auth directly (no current-password check —
 * Supabase's own updateUser() doesn't require or enforce one for an
 * already-authenticated session, so asking for it here would be theater).
 * @param {HTMLElement} root
 */
export function initSettings(root) {
  const labels = JSON.parse(root.dataset.labels);
  const loginPath = root.dataset.loginPath;

  const states = {
    loading: root.querySelector('[data-state="loading"]'),
    error: root.querySelector('[data-state="error"]'),
    content: root.querySelector('[data-state="content"]'),
  };
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
  }

  const profileForm = root.querySelector('[data-profile-form]');
  const profileError = root.querySelector('[data-profile-error]');
  const profileSuccess = root.querySelector('[data-profile-success]');

  const passwordForm = root.querySelector('[data-password-form]');
  const passwordError = root.querySelector('[data-password-error]');
  const passwordSuccess = root.querySelector('[data-password-success]');

  let userId = null;

  async function loadProfile() {
    showState('loading');
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('display_name, country, age_range, category')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      showState('error');
      return;
    }

    profileForm.displayName.value = profile.display_name ?? '';
    profileForm.country.value = profile.country ?? '';
    if (profile.age_range) profileForm.ageRange.value = profile.age_range;
    profileForm.gender.value = profile.category ?? 'open';
    showState('content');
  }

  root.querySelectorAll('[data-action="retry"]').forEach((btn) => btn.addEventListener('click', loadProfile));

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileError.hidden = true;
    profileSuccess.hidden = true;

    const displayName = profileForm.displayName.value.trim();
    const country = profileForm.country.value.trim();
    const ageRange = profileForm.ageRange.value;
    const category = profileForm.gender.value;
    const submitBtn = profileForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;

    const [{ error: profileErr }, { error: authErr }] = await Promise.all([
      supabase.from('profiles').update({ display_name: displayName, country, age_range: ageRange, category }).eq('id', userId),
      updateAuthMetadata({ displayName, country }),
    ]);

    submitBtn.disabled = false;
    if (profileErr || authErr) {
      profileError.textContent = labels.profileSaveError;
      profileError.hidden = false;
      return;
    }
    profileSuccess.hidden = false;
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordError.hidden = true;
    passwordSuccess.hidden = true;

    const newPassword = passwordForm.newPassword.value;
    const confirmPassword = passwordForm.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      passwordError.textContent = labels.passwordMismatch;
      passwordError.hidden = false;
      return;
    }

    const submitBtn = passwordForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    const { error } = await updatePassword(newPassword);
    submitBtn.disabled = false;

    if (error) {
      passwordError.textContent = labels.passwordSaveError;
      passwordError.hidden = false;
      return;
    }
    passwordForm.reset();
    passwordSuccess.hidden = false;
  });

  getSession().then((session) => {
    if (!session) {
      window.location.href = `${loginPath}?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    userId = session.user.id;
    loadProfile();
  });
}
