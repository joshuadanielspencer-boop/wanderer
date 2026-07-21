// ===========================================================================
// EPHEMERIS ACCURACY — the one test that matters most in this repo.
//
// Every other system (transfer windows, delta-v quotes, light lag, "the rings
// are edge-on this year") reads its geometry from ephemeris.js. A bug there is
// the worst kind: the orrery still looks like a solar system, the planets still
// go round, and every number the game teaches is quietly wrong.
//
// So this doesn't test the code against itself. It tests it against real,
// independently published events — opposition dates from observational
// almanacs, which nobody derived from Standish's tables.
//
// WHY OPPOSITIONS: at opposition, Earth lies on the straight line from the Sun
// to the planet, so the two heliocentric ecliptic longitudes must be equal. That
// exercises two bodies at once, in the exact quantity (longitude) the game's
// transfer windows depend on, and no plausible-looking sign error survives it.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  heliocentric, elongation, periodDays, lightTimeSeconds, wrap360, ELEMENTS,
} from "../src/ephemeris.js";

const utc = (y, m, d, h = 0) => new Date(Date.UTC(y, m - 1, d, h));

/** Difference between two ecliptic longitudes, as a signed angle in (-180,180]. */
const lonDiff = (a, b) => {
  const d = wrap360(a - b);
  return d > 180 ? d - 360 : d;
};

describe("oppositions — checked against published dates", () => {
  // Sources: Mars 2025-01-16 and Jupiter 2024-12-07 (JPL "What's Up", EarthSky);
  // Saturn 2025-09-20/21 (Fiske Planetarium). Oppositions happen at an instant,
  // and these are published to the day, so testing at 12:00 UT keeps the worst
  // case half a day of relative motion.
  //
  // Mars is the tightest of the three: Earth and Mars close on each other at
  // roughly 0.5°/day near opposition, so half a day is ~0.25° of longitude
  // before any table error at all. The tolerances below are that geometry, not
  // slack for a sloppy implementation.
  const cases = [
    { planet: "mars",    date: utc(2025, 1, 16, 12), tol: 0.5 },
    { planet: "jupiter", date: utc(2024, 12, 7, 12), tol: 0.5 },
    { planet: "saturn",  date: utc(2025, 9, 21, 0),  tol: 0.5 },
  ];

  for (const { planet, date, tol } of cases) {
    it(`${planet}: Earth and ${planet} share a heliocentric longitude`, () => {
      const e = heliocentric("earth", date).lon;
      const p = heliocentric(planet, date).lon;
      expect(Math.abs(lonDiff(e, p))).toBeLessThan(tol);
    });
  }
});

describe("orbits are the real orbits", () => {
  // Earth's perihelion is in the first week of January, aphelion in the first
  // week of July, and the distances are 0.9833 au and 1.0167 au. A sign error in
  // the Kepler solve reverses these and nothing else notices.
  it("Earth is closest to the Sun in January, furthest in July", () => {
    const jan = heliocentric("earth", utc(2025, 1, 4)).r;
    const jul = heliocentric("earth", utc(2025, 7, 4)).r;
    expect(jan).toBeCloseTo(0.9833, 3);
    expect(jul).toBeCloseTo(1.0167, 3);
    expect(jan).toBeLessThan(jul);
  });

  it("sidereal periods match the published years", () => {
    // Days. Mercury 87.97, Earth 365.26, Mars 686.98, Jupiter 4332.59,
    // Saturn 10759.22, Uranus 30685.4, Neptune 60189, Pluto 90560.
    const expected = {
      mercury: 87.97, earth: 365.26, mars: 686.98, jupiter: 4332.59,
      saturn: 10759.22, uranus: 30685.4, neptune: 60189, pluto: 90560,
    };
    for (const [key, days] of Object.entries(expected)) {
      // Within 0.5% — Kepler's third law from a mean semi-major axis will not
      // reproduce a published period exactly, and does not need to.
      expect(Math.abs(periodDays(key) - days) / days).toBeLessThan(0.005);
    }
  });

  it("each planet stays inside its own perihelion/aphelion band for a full orbit", () => {
    // Walks a whole orbit in 200 steps and checks r never leaves a(1±e). Catches
    // an eccentricity applied to the wrong axis, which a single-date test misses.
    for (const key of Object.keys(ELEMENTS)) {
      const a = ELEMENTS[key].a[0], e = ELEMENTS[key].e[0];
      const P = periodDays(key);
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < 200; i++) {
        const d = new Date(Date.UTC(2000, 0, 1) + (P * i / 200) * 86400000);
        const r = heliocentric(key, d).r;
        min = Math.min(min, r); max = Math.max(max, r);
      }
      expect(min).toBeGreaterThan(a * (1 - e) * 0.999);
      expect(max).toBeLessThan(a * (1 + e) * 1.001);
      // And it really is eccentric — Pluto and Mercury must not come out round.
      if (e > 0.05) expect(max - min).toBeGreaterThan(a * e);
    }
  });

  it("Pluto crosses inside Neptune's orbit, as it did 1979–1999", () => {
    // The famous one, and a good end-to-end check on the outer elements.
    expect(heliocentric("pluto", utc(1989, 9, 5)).r)
      .toBeLessThan(heliocentric("neptune", utc(1989, 9, 5)).r);
    expect(heliocentric("pluto", utc(2025, 1, 1)).r)
      .toBeGreaterThan(heliocentric("neptune", utc(2025, 1, 1)).r);
  });
});

describe("derived quantities the game leans on", () => {
  it("light lag matches the published one-way times", () => {
    // Design doc §1.6 quotes these to the player, so they have to be true.
    const marsMin = 3 * 60, marsMax = 23 * 60;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 800; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000); // ~2.2 years
      const t = lightTimeSeconds("earth", "mars", d);
      lo = Math.min(lo, t); hi = Math.max(hi, t);
    }
    expect(lo).toBeGreaterThan(marsMin);
    expect(hi).toBeLessThan(marsMax);

    // Pluto: about 4.5 hours one way at its current ~35 au from Earth.
    const pluto = lightTimeSeconds("earth", "pluto", utc(2026, 7, 21)) / 3600;
    expect(pluto).toBeGreaterThan(4).toBeLessThan(5.5);
  });

  it("elongation is symmetric and bounded", () => {
    const d = utc(2026, 7, 21);
    expect(elongation("earth", "mars", d)).toBeCloseTo(elongation("mars", "earth", d), 10);
    for (const k of Object.keys(ELEMENTS)) {
      const a = elongation("earth", k, d);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(180);
    }
  });

  it("is deterministic — the same date gives the same answer", () => {
    // The whole seeded-run story depends on this. A cached position that drifts
    // makes every run subtly non-reproducible, which is exactly the bug
    // Shutterbug's rng.js tests exist to prevent.
    const d = utc(2031, 3, 14);
    expect(heliocentric("saturn", d)).toEqual(heliocentric("saturn", d));
  });
});
