// ===========================================================================
// PROPULSION — the rocket equation and the drive eras.
//
// The most load-bearing physics in the game now that the economy rests on it.
// If the mass ratios are wrong, every strategic conclusion a player draws —
// where depots belong, whether in-situ propellant is worth building, whether a
// mission is possible at all — is wrong with them, and plausibly so.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  DRIVES, exhaustVelocity, massRatio, propellantFraction, propellantFor,
  deltaVAvailable, payloadFraction, isFeasible, brachistochrone, spiral,
  acceleration, drivesAvailable, assess,
} from "../src/propulsion.js";

describe("the rocket equation", () => {
  it("turns specific impulse into exhaust velocity", () => {
    // The best chemistry there is comes out at ~4.4 km/s. Every hard limit in
    // the inner system traces back to this number.
    expect(exhaustVelocity(450)).toBeCloseTo(4.41, 2);
    expect(exhaustVelocity(380)).toBeCloseTo(3.73, 2);
    expect(exhaustVelocity(850)).toBeCloseTo(8.34, 2);
  });

  it("Earth → Mars on hydrolox is about 72% propellant", () => {
    // 5.6 km/s heliocentric at 450 s. The canonical worked example.
    expect(massRatio(5.6, 450)).toBeCloseTo(3.58, 1);
    expect(propellantFraction(5.6, 450) * 100).toBeGreaterThan(70).toBeLessThan(74);
  });

  it("is EXPONENTIAL, not linear — the whole point", () => {
    // A linear gauge (the model this replaced) would make doubling the Δv cost
    // double the propellant. It squares the mass ratio instead. If this ever
    // reads as linear, the game is teaching the opposite of the truth.
    const one = massRatio(5, 450), two = massRatio(10, 450);
    expect(two).toBeCloseTo(one * one, 5);
    expect(two / one).toBeGreaterThan(2);
  });

  it("round-trips: the Δv you can buy is the Δv the tanks give back", () => {
    const dry = 20, dv = 6.2, isp = 380;
    const prop = propellantFor(dry, dv, isp);
    expect(deltaVAvailable(dry + prop, dry, isp)).toBeCloseTo(dv, 9);
  });

  it("approaches all-propellant asymptotically and never misbehaves", () => {
    // Physics says the propellant fraction rises toward 1 and never reaches it.
    // Float64 disagrees: at 1000 km/s the mass ratio is ~1e98, so 1 − 1/1e98
    // rounds to exactly 1. That is a limit of the number type, not of the model,
    // and it is safe — the value saturates at 1 rather than exceeding it or
    // going NaN. What matters for the game is that it is monotonic and bounded.
    expect(propellantFraction(30, 450)).toBeLessThan(1);
    expect(propellantFraction(30, 450)).toBeGreaterThan(propellantFraction(20, 450));
    for (const dv of [50, 200, 1000, 1e6]) {
      const f = propellantFraction(dv, 450);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeLessThanOrEqual(1);
    }
    expect(deltaVAvailable(10, 10, 450)).toBe(0);      // no propellant, no Δv
    expect(deltaVAvailable(5, 10, 450)).toBe(0);       // nonsense input, not NaN
  });
});

describe("what is actually possible", () => {
  it("a single chemical stage cannot do 15 km/s", () => {
    // The reason multi-stage rockets and orbital depots exist at all.
    expect(isFeasible(15, 450)).toBe(false);
    expect(payloadFraction(15, 450)).toBeLessThan(0);   // cannot lift its own tanks
  });

  it("nuclear thermal turns an impossible trip into a merely hard one", () => {
    // Same 12 km/s. Chemistry cannot; a reactor can. This is what an era change
    // BUYS, expressed as a fact rather than a tech-tree bonus.
    expect(isFeasible(12, DRIVES.hydrolox.isp)).toBe(false);
    expect(isFeasible(12, DRIVES.ntr.isp)).toBe(true);
  });

  it("ion drives make deep-space Δv almost free — in propellant, not in time", () => {
    expect(payloadFraction(20, DRIVES.nep.isp)).toBeGreaterThan(0.5);
    // ...but the acceleration is a rounding error, which is the trade.
    expect(acceleration(DRIVES.nep, 100)).toBeLessThan(0.01);
    expect(acceleration(DRIVES.methalox, 100)).toBeGreaterThan(10);
  });

  it("grades a trip in words a player can act on", () => {
    expect(assess(3, DRIVES.hydrolox).verdict).toBe("comfortable");
    expect(assess(15, DRIVES.hydrolox).feasible).toBe(false);
    expect(assess(15, DRIVES.hydrolox).verdict).toBe("impossible in one stage");
    expect(assess(5.6, DRIVES.hydrolox).propellantPct).toBeGreaterThan(70);
  });
});

describe("trajectories the eras unlock", () => {
  it("1 g across 1 AU is three days — and 2,400 km/s", () => {
    // The Expanse's whole premise, and its whole problem, in two numbers.
    const b = brachistochrone(1, 1);
    expect(b.days).toBeGreaterThan(2.7).toBeLessThan(3.0);
    expect(b.dvKms).toBeGreaterThan(2300).toBeLessThan(2500);
  });

  it("and the rocket equation says that torch drive is fiction", () => {
    // The honest version of a tech tree: the game does not pretend this is an
    // engineering gap. At a very generous 10,000 s the mass ratio is ~5e10 —
    // more propellant than the ship could be made of, by ten orders of
    // magnitude. Every story with a torch drive invents new physics for it, and
    // the game should show the player exactly why.
    const b = brachistochrone(1, 1);
    expect(massRatio(b.dvKms, DRIVES.torch.isp)).toBeGreaterThan(1e9);
    expect(DRIVES.torch.speculative).toBe(true);
    // Everything below fusion is real, built, or engineered in detail.
    for (const d of Object.values(DRIVES)) {
      if (d.era !== "fusion") expect(d.speculative).toBe(false);
    }
  });

  it("brachistochrone time scales as the square root of distance", () => {
    // Four times as far is only twice as long — the reason a torch drive
    // collapses the solar system rather than merely shrinking it.
    const a = brachistochrone(1, 0.3), b = brachistochrone(4, 0.3);
    expect(b.days / a.days).toBeCloseTo(2, 1);
  });

  it("a low-thrust spiral costs the difference in orbital speeds", () => {
    // Earth → Mars: 5.7 km/s spiralling vs 5.6 impulsive, so nearly a wash.
    expect(spiral(1, 1.524, 1e-4).dvKms).toBeCloseTo(5.65, 1);
    // Earth → Jupiter: 16.7 vs 14.4, so the spiral is meaningfully worse — but
    // at ten times the exhaust velocity it still wins on mass by a mile.
    expect(spiral(1, 5.204, 1e-4).dvKms).toBeCloseTo(16.7, 0);
    expect(payloadFraction(16.7, DRIVES.nep.isp))
      .toBeGreaterThan(payloadFraction(14.4, DRIVES.hydrolox.isp));
  });

  it("spiralling takes longer the gentler the push", () => {
    expect(spiral(1, 1.524, 1e-4).days).toBeGreaterThan(spiral(1, 1.524, 1e-3).days);
    expect(spiral(1, 1.524, 0).days).toBe(Infinity);
  });
});

describe("the campaign timeline", () => {
  it("unlocks eras in order, and starts with chemistry only", () => {
    const at = (y) => drivesAvailable(y).map((d) => d.id);
    expect(at(2030).sort()).toEqual(["hydrolox", "methalox"]);
    expect(at(2050)).toContain("ntr");
    expect(at(2050)).not.toContain("nep");
    expect(at(2080)).toContain("nep");
    expect(at(2250)).toContain("torch");
  });

  it("every drive gets faster or more efficient than the one before it", () => {
    const order = ["methalox", "hydrolox", "ntr", "nep", "torch"];
    for (let i = 1; i < order.length; i++) {
      expect(DRIVES[order[i]].isp).toBeGreaterThan(DRIVES[order[i - 1]].isp);
    }
  });
});
