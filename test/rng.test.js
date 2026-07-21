// ===========================================================================
// THE SEEDING PRIMITIVES.
//
// Small, and the reason they get their own file: a run that cannot be replayed
// exactly cannot be debugged at all. The map moves with the mission date, so
// "the window was cheaper last time" has to be either true or provably false.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { rand, withSeed, shuffled, seeded } from "../src/rng.js";
import { newSim } from "../src/sim.js";

describe("seeding", () => {
  it("restores the previous generator even when the body throws", () => {
    // The bug this prevents: an exception inside a seeded block leaves the game
    // permanently deterministic, and nothing anywhere reports it.
    const before = rand();
    expect(() => withSeed(1, () => { throw new Error("boom"); })).toThrow("boom");
    const after = rand();
    expect(after).not.toBe(before);
    expect(withSeed(7, rand)).toBe(withSeed(7, rand));
  });

  it("the same seed gives the same shuffle and the same run", () => {
    expect(withSeed(3, () => shuffled([1, 2, 3, 4, 5, 6, 7, 8])))
      .toEqual(withSeed(3, () => shuffled([1, 2, 3, 4, 5, 6, 7, 8])));
    expect(newSim(999, "easy").board).toEqual(newSim(999, "easy").board);
  });

  it("different seeds diverge", () => {
    const boards = new Set([1, 2, 3, 4, 5, 6].map((s) => newSim(s, "easy").board.join(",")));
    expect(boards.size).toBeGreaterThan(1);
  });

  it("shuffled does not mutate its input", () => {
    const src = [1, 2, 3, 4, 5];
    withSeed(1, () => shuffled(src));
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("the generator stays in range", () => {
    const g = seeded(12345);
    for (let i = 0; i < 500; i++) {
      const v = g();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
