// ===========================================================================
// TRANSFERS — what it costs to go, and when you should leave.
//
// This is the module that makes the calendar matter. In Shutterbug, travel cost
// a flat number of days. Here it costs propellant AND time, the two trade
// against each other, and the exchange rate depends on where the planets happen
// to be — which is the single most important true thing about spaceflight and
// the reason the map has to move.
//
// THE MATHS IS REAL. Hohmann transfers between circular coplanar orbits: the
// textbook two-burn minimum-energy transfer, computed from the vis-viva
// equation. It reproduces the published Earth→Mars numbers (259 days of flight,
// a 44° phase angle at departure, 5.6 km/s of heliocentric Δv, a 780-day
// synodic period) — test/transfer.test.js checks exactly that, because a
// transfer model that is merely plausible would teach a child confident
// nonsense.
//
// WHAT IS SIMPLIFIED, AND SAID OUT LOUD:
//   • Orbits are treated as circular and coplanar for the transfer itself.
//     Real mission planners use a porkchop plot and a Lambert solver. For Earth
//     and Mars the error is a few percent; for Pluto's 17° inclination it is
//     much worse, and the game should never quote these as mission figures.
//   • Departing off the ideal phase angle is charged by a penalty CURVE rather
//     than by solving the actual off-optimal trajectory. The curve's shape is
//     invented; what it gets right is the direction and the rough magnitude —
//     leaving early always costs more, and leaving very early costs a lot more.
//   • Δv here is HELIOCENTRIC only: the cost of changing your orbit around the
//     Sun. It excludes climbing out of Earth's well and capturing at the far
//     end. data/bodies.js carries those separately.
// ===========================================================================

import { heliocentric, wrap360, ELEMENTS, centuriesSinceJ2000 } from "./ephemeris.js";

/**
 * Semi-major axis of a body's orbit, AU.
 *
 * Not the same as its distance right now, and the difference is a bug I already
 * made once: synodicDays() was being fed instantaneous radii, so Mars — whose
 * distance from the Sun swings between 1.38 and 1.67 AU — appeared to have a
 * synodic period that changed by months depending on when you asked. A synodic
 * period is a property of two ORBITS, so it has to come from the orbits.
 */
export function semiMajor(key, date = new Date(Date.UTC(2000, 0, 1))) {
  const el = ELEMENTS[key];
  return el.a[0] + el.a[1] * centuriesSinceJ2000(date);
}

const AU_PER_YEAR_TO_KMS = 4.74057;      // 1 AU/yr in km/s
const V_CIRC_1AU = 2 * Math.PI * AU_PER_YEAR_TO_KMS; // 29.785 km/s, Earth's speed
const DAY = 86400000;

/** Circular orbital speed at r astronomical units, in km/s. */
export const circularSpeed = (au) => V_CIRC_1AU / Math.sqrt(au);

/** Orbital period at semi-major axis a (AU), in years. Kepler's third law. */
export const periodYears = (au) => Math.pow(au, 1.5);

/**
 * The minimum-energy (Hohmann) transfer between two circular orbits.
 *
 * @param {number} r1 departure orbit radius, AU
 * @param {number} r2 arrival orbit radius, AU
 * @returns {{dv, dv1, dv2, days, phaseDeg}}
 *   dv       total heliocentric Δv, km/s
 *   days     flight time (half the transfer ellipse's period)
 *   phaseDeg how far AHEAD of you the target must be when you leave. Negative
 *            means it must be behind — which is the case for every inbound
 *            transfer, and is the detail that makes going to Venus feel
 *            different from going to Mars.
 */
export function hohmann(r1, r2) {
  const aT = (r1 + r2) / 2;                 // transfer ellipse semi-major axis
  const tYears = periodYears(aT) / 2;       // you fly half of it

  const v1 = circularSpeed(r1);
  const v2 = circularSpeed(r2);

  // vis-viva at each end of the transfer ellipse
  const dv1 = v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2)));

  // While you coast, the target moves. It must arrive where you will arrive, so
  // it has to start short of that point by however far it travels en route.
  const targetSweep = 360 * (tYears / periodYears(r2));
  const phaseDeg = ((180 - targetSweep + 540) % 360) - 180; // wrap to (-180,180]

  return {
    dv: Math.abs(dv1) + Math.abs(dv2),
    dv1, dv2,
    days: tYears * 365.256,
    phaseDeg,
  };
}

/** How often the same departure geometry comes round again, in days. */
export function synodicDays(r1, r2) {
  const T1 = periodYears(r1), T2 = periodYears(r2);
  if (Math.abs(T1 - T2) < 1e-9) return Infinity;
  return Math.abs(1 / (1 / T1 - 1 / T2)) * 365.256;
}

/**
 * The penalty for leaving before the geometry is right.
 *
 * ⚠ INVENTED CURVE — see the header. Real off-optimal transfers are solved with
 * Lambert's problem; this is a stand-in that behaves correctly (monotonic, worst
 * at opposition to the ideal phase, ~2.2× at the extreme) so the player learns
 * the true lesson — waiting is cheap, impatience is expensive — without the game
 * claiming a precision it hasn't earned.
 */
export function windowPenalty(offByDeg) {
  const off = Math.min(180, Math.abs(offByDeg)) / 180;
  return 1 + 1.2 * off * off;
}

/**
 * Everything the player needs to decide, for a transfer from `fromKey` to
 * `toKey` departing on `date`.
 *
 * Returns both branches of the choice the game is really about:
 *   goNow — leave immediately, pay the penalty
 *   window — wait for the geometry, pay the minimum
 */
export function transferOptions(fromKey, toKey, date) {
  const A = heliocentric(fromKey, date);
  const B = heliocentric(toKey, date);
  const base = hohmann(A.r, B.r);

  // Where the target actually is relative to us, right now.
  const actualPhase = ((wrap360(B.lon - A.lon) + 540) % 360) - 180;
  const offBy = ((actualPhase - base.phaseDeg + 540) % 360) - 180;

  const window = nextWindow(fromKey, toKey, date);

  return {
    idealPhaseDeg: base.phaseDeg,
    actualPhaseDeg: actualPhase,
    offByDeg: offBy,
    // From the ORBITS, not from today's distances — see semiMajor().
    synodicDays: synodicDays(semiMajor(fromKey, date), semiMajor(toKey, date)),
    goNow: {
      dv: base.dv * windowPenalty(offBy),
      days: base.days,
      departs: date,
    },
    window: {
      dv: base.dv,
      days: base.days,
      departs: window.date,
      waitDays: window.waitDays,
    },
  };
}

/**
 * The next date on which the departure geometry is right.
 *
 * Walks forward day by day looking for the phase error to change sign. Crude,
 * and deliberately so: a closed-form solution would have to assume circular
 * orbits, whereas stepping the real ephemeris picks up the eccentricity that
 * makes consecutive Mars windows genuinely different from each other. A few
 * thousand Kepler solves is nothing, and it happens once per travel decision.
 */
export function nextWindow(fromKey, toKey, date, maxDays = 20000) {
  const errAt = (d) => {
    const A = heliocentric(fromKey, d), B = heliocentric(toKey, d);
    const ideal = hohmann(A.r, B.r).phaseDeg;
    const actual = ((wrap360(B.lon - A.lon) + 540) % 360) - 180;
    return ((actual - ideal + 540) % 360) - 180;
  };

  let prev = errAt(date);
  if (Math.abs(prev) < 0.5) return { date, waitDays: 0 };

  for (let i = 1; i <= maxDays; i++) {
    const d = new Date(date.getTime() + i * DAY);
    const e = errAt(d);
    // A sign change across a small step is the crossing. The large-jump guard
    // rejects the ±180 wrap, which is not a window.
    if (Math.sign(e) !== Math.sign(prev) && Math.abs(e - prev) < 90) {
      return { date: d, waitDays: i };
    }
    prev = e;
  }
  return { date, waitDays: 0 }; // no window found: treat as "go now"
}

/** Round-trip light time to Earth, in hours — how long a question takes. */
export function askEarthHours(fromKey, date) {
  if (fromKey === "earth") return 0;
  const A = heliocentric("earth", date), B = heliocentric(fromKey, date);
  const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
  return (d * 149597870.7 * 2) / 299792.458 / 3600;
}
