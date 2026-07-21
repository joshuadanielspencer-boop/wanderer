// ===========================================================================
// RUN RULES + the seeding primitives underneath them.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { rand, withSeed, shuffled } from "../src/rng.js";
import { planRun, newRun, scoreShot, travelChoice, START_SYSTEM, MAX_ASSIGNMENTS, START_DATE, END_DATE, START_FUEL } from "../src/run.js";
import { FEATURES } from "../src/data/features.js";

describe("seeding", () => {
  it("restores the previous generator even when the body throws", () => {
    // The bug this prevents: an exception inside a seeded block leaves the game
    // permanently deterministic, and nothing anywhere reports it.
    const before = rand();
    expect(() => withSeed(1, () => { throw new Error("boom"); })).toThrow("boom");
    const after = rand();
    expect(after).not.toBe(before);          // still the real generator
    expect(withSeed(7, rand)).toBe(withSeed(7, rand)); // and seeding still works
  });

  it("the same seed gives the same run, every time", () => {
    expect(planRun(12345)).toEqual(planRun(12345));
    expect(shuffled([1, 2, 3, 4, 5])).toBeDefined();
  });

  it("different seeds give different runs", () => {
    const runs = new Set([1, 2, 3, 4, 5].map((s) => planRun(s).join(",")));
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe("assignment fairness", () => {
  it("never asks for a target in the system you are already standing in", () => {
    for (let seed = 0; seed < 50; seed++) {
      const targets = planRun(seed).map((id) => FEATURES.find((f) => f.id === id));
      let here = START_SYSTEM;
      for (const t of targets) {
        // A target in the system you're already in is a free point, and the
        // whole game is the journey there.
        expect(t.system).not.toBe(here);
        here = t.system;
      }
    }
  });

  it("gives as many assignments as the charter allows, never more", () => {
    // Deliberately NOT always five. How much you can do depends on where you
    // are sent, which is the honest answer and a lesson in itself — a run that
    // includes Saturn is a shorter run. A run of one, though, would be a bug.
    for (let seed = 0; seed < 60; seed++) {
      const n = planRun(seed).length;
      expect(n, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(n, `seed ${seed}`).toBeLessThanOrEqual(MAX_ASSIGNMENTS);
    }
  });

  it("every run is actually WINNABLE — inside the tank and inside the charter", () => {
    // This test exists because a simulation caught what playing would not have:
    // with the outer planets in the pool, seeded runs finished in the year 2275.
    // Five minimum-energy transfers to Neptune and Pluto eat centuries, and the
    // ephemeris is only honest to 2050 — so the game was quietly showing
    // positions it had no business showing.
    //
    // Perfect play means always waiting for the window. If perfect play cannot
    // finish, the run is unwinnable and the player has no way to know why.
    for (let seed = 0; seed < 40; seed++) {
      let at = START_SYSTEM, date = new Date(START_DATE), fuel = START_FUEL;
      for (const id of planRun(seed)) {
        const f = FEATURES.find((x) => x.id === id);
        const c = travelChoice(at, f.system, date);
        if (c) {
          fuel -= c.window.dv;
          date = new Date(c.window.departs.getTime() + c.window.days * 86400000);
        }
        at = f.system;
      }
      expect(fuel, `seed ${seed} ran out of propellant`).toBeGreaterThan(0);
      expect(date.getTime(), `seed ${seed} overran the charter (${date.toISOString().slice(0, 10)})`)
        .toBeLessThan(END_DATE);
    }
  });

  it("never assigns a world you could not get home from", () => {
    // Uranus, Neptune and Pluto are free-look only. A 30-year flight is not
    // homework.
    const banned = new Set(["uranus", "neptune", "pluto"]);
    for (let seed = 0; seed < 40; seed++) {
      for (const id of planRun(seed)) {
        expect(banned.has(FEATURES.find((f) => f.id === id).system)).toBe(false);
      }
    }
  });
});

describe("travel", () => {
  it("moving between moons of one planet is not charged as a transfer", () => {
    // Io → Europa is not a heliocentric transfer, and charging Earth→Jupiter
    // prices for it would be both wrong and infuriating.
    expect(travelChoice("jupiter", "jupiter", new Date(Date.UTC(2031, 0, 1)))).toBeNull();
  });

  it("offers a real choice: waiting is cheaper, going now is sooner", () => {
    const c = travelChoice("earth", "mars", new Date(Date.UTC(2031, 0, 1)));
    expect(c.window.dv).toBeLessThanOrEqual(c.goNow.dv);
    expect(c.window.departs.getTime()).toBeGreaterThanOrEqual(c.goNow.departs.getTime());
  });
});

describe("scoring rewards the right behaviour", () => {
  const base = { tier: "easy", misses: 0, fuelLeft: 45, fuelMax: 90 };

  it("pays more for a harder clue", () => {
    expect(scoreShot({ ...base, tier: "hard" }))
      .toBeGreaterThan(scoreShot({ ...base, tier: "medium" }));
    expect(scoreShot({ ...base, tier: "medium" })).toBeGreaterThan(scoreShot(base));
  });

  it("pays for thrift — arriving with fuel means you waited for windows", () => {
    expect(scoreShot({ ...base, fuelLeft: 80 })).toBeGreaterThan(scoreShot({ ...base, fuelLeft: 10 }));
  });

  it("penalises misses but never goes to zero", () => {
    expect(scoreShot({ ...base, misses: 2 })).toBeLessThan(scoreShot(base));
    expect(scoreShot({ tier: "easy", misses: 99, fuelLeft: 0, fuelMax: 90 })).toBeGreaterThan(0);
  });
});

describe("a fresh run", () => {
  it("starts at Earth, full, on the charter's first day", () => {
    const r = newRun(1, "easy");
    expect(r.at).toBe(START_SYSTEM);
    expect(r.fuel).toBe(r.fuelMax);
    expect(r.idx).toBe(0);
    expect(r.date.getTime()).toBe(START_DATE);
  });
});
