// ===========================================================================
// THE ONE RANDOM NUMBER GENERATOR.
//
// Lifted from Shutterbug, contract intact, because the bug it prevents is worse
// here. In Shutterbug a stray Math.random() made a run non-reproducible. Here
// the map itself moves with the mission date, so a run that can't be replayed
// exactly can't be debugged at all — "the window was cheaper last time" would
// be unfalsifiable.
//
// Nothing in this codebase may call Math.random() directly. Everything goes
// through rand(), which is swappable by withSeed().
// ===========================================================================

let impl = Math.random;

/** A float in [0,1). The only source of randomness in the game. */
export const rand = () => impl();

/** An integer in [0, n). */
export const randInt = (n) => Math.floor(rand() * n);

/** A random element. */
export const pick = (arr) => arr[randInt(arr.length)];

/** Fisher–Yates, seeded. Returns a new array. */
export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** mulberry32 — small, fast, and good enough for picking assignments. */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run `fn` with a seeded generator, then put the previous one back.
 *
 * The try/finally is the whole point and is tested: if `fn` throws and we don't
 * restore, the game silently continues on the seeded generator forever and
 * every later "random" choice is deterministic in a way nobody asked for.
 */
export function withSeed(seed, fn) {
  const prev = impl;
  impl = seeded(seed);
  try {
    return fn();
  } finally {
    impl = prev;
  }
}
