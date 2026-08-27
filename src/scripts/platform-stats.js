import { supabase } from '../db/supabase.js';
import { formatNumber } from '../utils/format.js';

/**
 * Fills in `[data-stat]` tiles anywhere under `root` from the
 * `platform_stats` view (see supabase/migrations/0002_platform_stats.sql
 * and 0003_engineer_stats.sql) — used by both the stats grid and the
 * "train like an engineer" pipeline, since both draw from the same
 * platform-wide numbers. Tiles render "—" server-side and stay that way if
 * the query fails, rather than falling back to made-up numbers.
 * @param {HTMLElement} root
 */
export async function initPlatformStats(root) {
  const lang = root.dataset.lang;
  const { data } = await supabase.from('platform_stats').select('*').single();
  if (!data) return;

  const values = {
    athletes: data.athletes,
    attempts: data.attempts,
    currentRecord: data.current_record,
    averageScore: data.average_score,
    averageBaseline: data.average_baseline,
  };

  Object.entries(values).forEach(([key, value]) => {
    const el = root.querySelector(`[data-stat="${key}"]`);
    if (el && value != null) el.textContent = formatNumber(lang, value);
  });
}
