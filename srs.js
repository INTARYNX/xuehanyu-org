// =========================================================================
// SPACED REPETITION — simplified SM-2 with a binary grade (right / wrong).
// Pure logic, no DOM, no storage: quiz.js owns persistence.
// A card is { ease, interval (days), reps, lapses, due (ms epoch) }.
// =========================================================================
const SRS = (() => {
  const DAY = 86400000;
  const MINUTE = 60000;
  const START_EASE = 2.5;
  const MIN_EASE = 1.3;
  const RELEARN_DELAY = 10 * MINUTE;

  function newCard() {
    return { ease: START_EASE, interval: 0, reps: 0, lapses: 0, due: 0 };
  }

  /**
   * Returns the card after one review (the input is never mutated).
   * A success on a card that is not due yet changes nothing, so mashing
   * "I know it" cannot inflate an interval; a failure always applies.
   */
  function grade(card, ok, now = Date.now()) {
    const c = { ...newCard(), ...card };
    if (!ok) {
      c.reps = 0;
      c.interval = 0;
      c.lapses += 1;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
      c.due = now + RELEARN_DELAY;
      return c;
    }
    if (c.reps > 0 && now < c.due) return c;
    c.reps += 1;
    c.interval = c.reps === 1 ? 1
      : c.reps === 2 ? 3
      : Math.max(c.interval + 1, Math.round(c.interval * c.ease));
    c.due = now + c.interval * DAY;
    return c;
  }

  /** True when the card exists and its review date has passed. */
  function isDue(card, now = Date.now()) {
    return !!card && card.due <= now;
  }

  function dueCount(cards, now = Date.now()) {
    let n = 0;
    for (const slug in cards) if (isDue(cards[slug], now)) n++;
    return n;
  }

  /** Cards for words the learner had already marked as known (migration). */
  function seedFromKnown(slugs, now = Date.now()) {
    const cards = {};
    for (const slug of slugs) {
      cards[slug] = { ...newCard(), reps: 1, interval: 1, due: now + DAY };
    }
    return cards;
  }

  return { newCard, grade, isDue, dueCount, seedFromKnown };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
