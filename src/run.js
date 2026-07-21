// ===========================================================================
// THE RUN — five assignments, a fuel tank, and a calendar.
//
// The slice exists to answer one question the phase-0 spike could not: does the
// delta-v / transfer-window / light-lag layer make this FUN, or merely fiddly?
// Everything here is in service of finding that out cheaply, on the eighteen
// hand-written features we already have, before a hundred and fifty more get
// curated to fill a game nobody has played.
//
// Kept as pure functions so the interesting rules can be tested without a
// browser — the same reason Shutterbug pulled missions.js out of its component.
// ===========================================================================

import { FEATURES } from "./data/features.js";
import { SYSTEM_BY_ID } from "./data/bodies.js";
import { shuffled, withSeed } from "./rng.js";
import { transferOptions } from "./transfer.js";

export const START_SYSTEM = "earth";
export const MAX_ASSIGNMENTS = 5;

/** Starting propellant, km/s of Δv. Tuned by playing, not by theory. */
export const START_FUEL = 90;

export const START_DATE = Date.UTC(2028, 0, 1);

/**
 * The charter ends in 2050, and the run ends with it.
 *
 * This is not a made-up deadline. JPL's Keplerian element table is stated valid
 * for 1800–2050; past that the fit drifts and every position the game shows
 * becomes quietly untrustworthy. The free-look slider already stopped there.
 * The run did not — and a simulation of twelve seeded runs finished in the year
 * 2275, four assignments deep into a solar system the ephemeris could no longer
 * honestly place.
 *
 * Rather than hide that, it becomes the third pressure the player feels, next
 * to fuel and the clue: a career is finite, and Hohmann transfers to the outer
 * system eat decades of it.
 */
export const END_DATE = Date.UTC(2050, 0, 1);

/**
 * Systems a run may send you to.
 *
 * Uranus, Neptune and Pluto are deliberately absent. A minimum-energy transfer
 * to Neptune is a THIRTY-YEAR flight — Voyager 2 took twelve, and it did not
 * stop. You cannot visit them and come home inside one working life, which is
 * true, is worth knowing, and is why every real mission out there has been a
 * flyby by a machine. They stay fully explorable in free-look, where no clock
 * is running; they just cannot be homework.
 */
export const RUN_SYSTEMS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn"];

/** Charter time held back so the last assignment is never a coin flip. */
const RESERVE_DAYS = 200;

/**
 * Pick the assignments for a run.
 *
 * The planner FLIES the run as it plans it, and refuses any assignment that
 * would not fit inside the charter. That single rule replaces a pile of
 * hand-tuned quotas, and it replaces them with the truth.
 *
 * The bug it fixes is worth recording, because no amount of playing would have
 * found it quickly. A first version banned only the far planets, and runs still
 * finished in 2076. The cost is not distance — it is SYNODIC PERIOD. Jupiter
 * and Saturn line up for a minimum-energy transfer only once every twenty
 * years, so a Jupiter → Saturn assignment could open with a sixteen-year wait
 * before a ten-year flight. Twenty-six years, in one hop, from a nineteen-year
 * charter. (It is the same fact that made Voyager's Grand Tour a
 * once-in-176-years opportunity.)
 *
 * So: never assign what cannot be reached in time. The player never sees a
 * hop that the calendar forbids, and never has to learn that rule by losing.
 *
 * The other two rules are inherited from Shutterbug's mission-fairness work:
 * never assign a target in the system you are already standing in, and never
 * the same system twice in a row — the journey is the game.
 */
export function planRun(seed, n = MAX_ASSIGNMENTS) {
  return withSeed(seed, () => {
    const pool = shuffled(FEATURES.filter((f) => RUN_SYSTEMS.includes(f.system)));
    const out = [];
    let here = START_SYSTEM;
    let date = new Date(START_DATE);
    const deadline = END_DATE - RESERVE_DAYS * 86400000;

    // Several passes: a candidate rejected early (wrong system, no time) may be
    // fine later once the date and position have moved on.
    for (let pass = 0; pass < 4 && out.length < n; pass++) {
      for (const f of pool) {
        if (out.length >= n) break;
        if (out.includes(f.id) || f.system === here) continue;

        const c = travelChoice(here, f.system, date);
        let arrive = date;
        if (c) {
          arrive = new Date(c.window.departs.getTime() + c.window.days * 86400000);
          if (arrive.getTime() > deadline) continue;   // the calendar says no
        }
        out.push(f.id);
        here = f.system;
        date = arrive;
      }
    }
    return out;
  });
}

/**
 * The travel decision, for the UI to render.
 *
 * Returns null when the player is already in the system they picked — moving
 * between moons of the same planet is not a heliocentric transfer and must not
 * be charged as one.
 */
export function travelChoice(fromSystem, toSystem, date) {
  if (fromSystem === toSystem) return null;
  const a = SYSTEM_BY_ID[fromSystem], b = SYSTEM_BY_ID[toSystem];
  if (!a?.ephemerisKey || !b?.ephemerisKey) return null;
  return transferOptions(a.ephemerisKey, b.ephemerisKey, date);
}

/** Cost of a wrong shot: propellant burned repositioning, and time lost. */
export const MISS_FUEL = 3;
export const MISS_DAYS = 30;

/**
 * Score one correct shot.
 *
 * Deliberately rewards the two behaviours the game is trying to teach:
 * patience (arriving with fuel left, which means you waited for windows) and
 * confidence (solving a harder clue). It does NOT reward speed — hurrying is
 * the expensive mistake, and a game that paid for it would teach the opposite
 * of the physics.
 */
export function scoreShot({ tier, misses, fuelLeft, fuelMax }) {
  const base = 100;
  const tierBonus = { easy: 0, medium: 40, hard: 90 }[tier] ?? 0;
  const missPenalty = Math.min(base, misses * 35);
  const thrift = Math.round(60 * Math.max(0, fuelLeft / fuelMax));
  return Math.max(10, base + tierBonus - missPenalty + thrift);
}

/** Has the run ended, and why. */
export function runStatus(run) {
  if (run.idx >= run.targets.length) return "complete";
  if (run.fuel <= 0) return "stranded";
  if (run.date.getTime() >= END_DATE) return "expired";
  return "flying";
}

/** The feature currently being asked for. */
export const currentTarget = (run) =>
  FEATURES.find((f) => f.id === run.targets[run.idx]) || null;

export function newRun(seed, tier) {
  return {
    seed,
    tier,
    targets: planRun(seed),
    idx: 0,
    at: START_SYSTEM,
    fuel: START_FUEL,
    fuelMax: START_FUEL,
    date: new Date(START_DATE),
    score: 0,
    misses: 0,
    asked: false,     // one question to mission control per assignment
    history: [],
  };
}
