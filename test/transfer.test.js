// ===========================================================================
// TRANSFER ACCURACY — the second load-bearing test in this repo.
//
// The transfer model decides what the game teaches about the most
// counterintuitive fact in spaceflight: that "far" and "hard" are different
// words, and that waiting is usually cheaper than hurrying. If the model is
// merely plausible, the game teaches confident nonsense — and a child has no
// way to catch it.
//
// So these check against the textbook Earth→Mars and Earth→Venus figures, which
// are published everywhere and which nobody derived from this code.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  hohmann, synodicDays, circularSpeed, windowPenalty, transferOptions, nextWindow, askEarthHours, transferPosition,
} from "../src/transfer.js";

const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const R_MARS = 1.523679, R_VENUS = 0.723332, R_JUP = 5.2044;

describe("Hohmann transfers reproduce the published numbers", () => {
  it("Earth is doing 29.8 km/s", () => {
    expect(circularSpeed(1)).toBeCloseTo(29.78, 1);
  });

  it("Earth → Mars: 259 days, 44° phase, ~5.6 km/s", () => {
    const t = hohmann(1, R_MARS);
    // The canonical figures for a minimum-energy Mars transfer.
    expect(t.days).toBeGreaterThan(255).toBeLessThan(263);
    expect(t.phaseDeg).toBeGreaterThan(43).toBeLessThan(46);
    expect(t.dv).toBeGreaterThan(5.5).toBeLessThan(5.7);
  });

  it("Earth → Venus: ~146 days, and the target must be BEHIND you", () => {
    const t = hohmann(1, R_VENUS);
    expect(t.days).toBeGreaterThan(140).toBeLessThan(152);
    // Going inward, you arrive on the far side of the Sun and Venus must start
    // behind you. A sign error here would send every inner-system player to the
    // wrong side of the solar system, and the number would still look sensible.
    expect(t.phaseDeg).toBeLessThan(0);
    expect(t.phaseDeg).toBeGreaterThan(-60);
  });

  it("synodic periods match the almanac", () => {
    expect(synodicDays(1, R_MARS)).toBeCloseTo(779.9, 0);   // Mars, ~2 years 50 days
    expect(synodicDays(1, R_VENUS)).toBeCloseTo(583.9, 0);  // Venus, ~19 months
    expect(synodicDays(1, R_JUP)).toBeCloseTo(398.9, 0);     // Jupiter, ~13 months
  });

  it("the injection burn to Jupiter is the familiar 8.8 km/s", () => {
    // The figure everyone quotes for "going to Jupiter" is the DEPARTURE burn
    // that puts you on the transfer ellipse — dv1, not the total. The total
    // also includes matching Jupiter's orbital speed on arrival, which real
    // missions get for free from Jupiter's own gravity instead.
    expect(hohmann(1, R_JUP).dv1).toBeCloseTo(8.79, 1);
    expect(hohmann(1, R_JUP).dv).toBeGreaterThan(14).toBeLessThan(15);
  });

  it("total Δv PEAKS near 15.5 AU and then falls — Neptune is cheaper than Uranus", () => {
    // The single most counterintuitive result in the file, and it is real: for a
    // two-burn Hohmann transfer the total Δv is maximised at r2/r1 ≈ 15.58, then
    // decreases. Push the target far enough away and the departure burn tends to
    // escape velocity while the arrival burn tends to zero, because the target's
    // own orbital speed is so low there is barely anything left to match.
    //
    // This test exists because the first version of it asserted a monotonic
    // increase — the naive expectation — and the CODE was right. Worth keeping
    // as content: "it takes less fuel to reach Neptune than Uranus" is true,
    // teachable, and nobody believes it at first.
    const at = (r) => hohmann(1, r).dv;
    let peakR = 0, peakDv = 0;
    for (let r = 2; r <= 45; r += 0.1) if (at(r) > peakDv) { peakDv = at(r); peakR = r; }
    expect(peakR).toBeGreaterThan(15).toBeLessThan(16);

    // Rising below the peak...
    expect(at(9.58)).toBeGreaterThan(at(5.20));
    expect(at(15.5)).toBeGreaterThan(at(9.58));
    // ...falling above it.
    expect(at(30.07)).toBeLessThan(at(19.19));
    expect(at(39.48)).toBeLessThan(at(30.07));
  });
});

describe("the window is the decision", () => {
  it("leaving at the wrong time always costs more, never less", () => {
    expect(windowPenalty(0)).toBe(1);
    for (const off of [10, 45, 90, 180]) expect(windowPenalty(off)).toBeGreaterThan(1);
    // Monotonic — a player must never be rewarded for worse geometry.
    const p = [0, 30, 60, 90, 120, 150, 180].map(windowPenalty);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
    expect(windowPenalty(180)).toBeLessThan(2.5);
  });

  it("waiting for the window is never more expensive than going now", () => {
    // The whole lesson, asserted. If this ever inverts, the game is teaching
    // the opposite of the truth.
    for (const m of [1, 4, 7, 10]) {
      const o = transferOptions("earth", "mars", utc(2030, m, 1));
      expect(o.window.dv).toBeLessThanOrEqual(o.goNow.dv + 1e-9);
    }
  });

  it("Earth → Mars windows recur about every 26 months", () => {
    const first = nextWindow("earth", "mars", utc(2030, 1, 1));
    const second = nextWindow("earth", "mars", new Date(first.date.getTime() + 30 * 86400000));
    const gap = (second.date - first.date) / 86400000;
    // Real consecutive Mars windows run roughly 760–800 days apart; they are not
    // identical, because the orbits are eccentric. Stepping the real ephemeris
    // is what picks that up.
    expect(gap).toBeGreaterThan(740).toBeLessThan(820);
  });

  it("a window always exists within one synodic period", () => {
    for (const target of ["venus", "mars", "jupiter", "saturn"]) {
      const o = transferOptions("earth", target, utc(2031, 3, 9));
      expect(o.window.waitDays).toBeLessThanOrEqual(Math.ceil(o.synodicDays) + 2);
    }
  });
});

describe("asking Earth a question", () => {
  it("round trip is twice the one-way light time, and brutal out past Jupiter", () => {
    expect(askEarthHours("earth", utc(2030, 1, 1))).toBe(0);
    const mars = askEarthHours("mars", utc(2030, 1, 1));
    expect(mars).toBeGreaterThan(0.1).toBeLessThan(1.5);   // 6 min to 45 min round trip
    const pluto = askEarthHours("pluto", utc(2030, 1, 1));
    expect(pluto).toBeGreaterThan(8);                       // over 8 hours, each way ~4.5
  });
});

describe("where the ship actually is", () => {
  it("starts on the departure orbit and ends on the arrival orbit", () => {
    for (const [r1, r2] of [[1, 1.524], [1, 5.204], [1, 0.723], [5.204, 1.524], [1, 1]]) {
      const start = transferPosition(r1, r2, 40, 0);
      const end = transferPosition(r1, r2, 40, 1);
      expect(start.r).toBeCloseTo(r1, 6);
      expect(end.r).toBeCloseTo(r2, 6);
      expect(start.lon).toBeCloseTo(40, 6);
    }
  });

  it("sweeps exactly 180° of longitude, outbound or inbound", () => {
    // A Hohmann transfer is half an ellipse, so this is exact — and it is the
    // same fact that makes the departure phase angle work out. If a change ever
    // breaks it, the arc drawn on the orrery has stopped being the real orbit.
    for (const [r1, r2] of [[1, 1.524], [1, 30.07], [9.58, 1], [1, 0.387]]) {
      expect(transferPosition(r1, r2, 200, 1).lon).toBeCloseTo(20, 6); // 200 + 180
    }
  });

  it("moves fastest near the Sun — Kepler's second law, visibly", () => {
    // Outbound to Jupiter: the first tenth of the trip should cover far more
    // longitude than the last tenth, because the ship is deep in the Sun's well
    // at the start and crawling at aphelion by the end. A linear interpolation
    // between endpoints — the version this replaced — would make these equal,
    // and would teach a child that spacecraft cruise at constant speed.
    const at = (f) => transferPosition(1, 5.204, 0, f).lon;
    const first = at(0.1) - at(0);
    const last = at(1) - at(0.9);
    expect(first).toBeGreaterThan(last * 3);
  });

  it("never leaves the band between the two orbits", () => {
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const p = transferPosition(1, 9.58, 0, f);
      expect(p.r).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(p.r).toBeLessThanOrEqual(9.58 + 1e-9);
    }
  });
});
