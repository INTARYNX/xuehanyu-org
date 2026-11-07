// =========================================================================
// PROGRESS — daily activity, goal and streak.
// Pure logic (state in, state out); persistence is a thin wrapper below.
// State: { goal, days: { 'YYYY-MM-DD': count } } — local calendar days.
// "Activity" is one answered card or one lesson marked as reviewed.
// =========================================================================
const Progress = (() => {
  const KEY = 'xuehanyu.progress.v1';
  const DEFAULT_GOAL = 10;
  const KEEP_DAYS = 400;

  const pad = n => String(n).padStart(2, '0');

  /** Local calendar day of a timestamp, e.g. '2026-11-07'. */
  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** The calendar day before a day key (DST-safe: works on y/m/d, not on ms). */
  function prevDay(key) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
  }

  function empty() {
    return { goal: DEFAULT_GOAL, days: {} };
  }

  /** Returns the state with `n` more activities on the day of `now`. */
  function record(state, n = 1, now = Date.now()) {
    const s = { goal: state?.goal || DEFAULT_GOAL, days: { ...(state?.days || {}) } };
    const k = dayKey(now);
    s.days[k] = (s.days[k] || 0) + n;
    const keys = Object.keys(s.days).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete s.days[old];
    return s;
  }

  function today(state, now = Date.now()) {
    return (state?.days || {})[dayKey(now)] || 0;
  }

  /**
   * Consecutive active days. Today does not have to be active yet: a streak
   * is still alive until the end of the day after the last active one.
   */
  function streak(state, now = Date.now()) {
    const days = state?.days || {};
    let k = dayKey(now);
    if (!days[k]) k = prevDay(k);
    let n = 0;
    while (days[k] > 0) { n++; k = prevDay(k); }
    return n;
  }

  /** Share of today's goal, 0..1. */
  function goalRatio(state, now = Date.now()) {
    const goal = state?.goal || DEFAULT_GOAL;
    return Math.min(1, today(state, now) / goal);
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object' && raw.days) return { ...empty(), ...raw };
    } catch {}
    return empty();
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  /** Records activity and persists it; returns the new state. */
  function add(n = 1, now = Date.now()) {
    const s = record(load(), n, now);
    save(s);
    return s;
  }

  return { dayKey, prevDay, empty, record, today, streak, goalRatio, load, save, add, DEFAULT_GOAL };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
