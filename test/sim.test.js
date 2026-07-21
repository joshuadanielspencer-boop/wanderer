// ===========================================================================
// THE SIMULATION — clock, fleet, and the events that resolve themselves.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  newSim, advance, nextEvent, orderTransfer, standDown, craftPosition, craftPath,
  shoot, simStatus, START_DATE, END_DATE, SHIP_FUEL, BOARD_SIZE, RATES,
} from "../src/sim.js";

const DAY = 86400000;
const order = (s, ship, to, which = "window") => orderTransfer(s, ship, to, which);

describe("a fresh simulation", () => {
  it("starts docked at Earth with a full board", () => {
    const s = newSim(1, "easy");
    expect(s.t).toBe(START_DATE);
    expect(s.craft).toHaveLength(3);
    expect(s.craft.every((c) => c.status === "docked" && c.at === "earth")).toBe(true);
    expect(s.board).toHaveLength(BOARD_SIZE);
    expect(nextEvent(s)).toBeNull();   // nothing is scheduled yet
  });

  it("is reproducible from its seed", () => {
    expect(newSim(42, "easy").board).toEqual(newSim(42, "easy").board);
  });

  it("offers a genuine pause", () => {
    expect(RATES[0].days).toBe(0);
  });
});

describe("the clock", () => {
  it("does nothing when nothing is scheduled", () => {
    const s = newSim(1, "easy");
    const { sim, fired } = advance(s, START_DATE + 500 * DAY);
    expect(fired).toHaveLength(0);
    expect(sim.t).toBe(START_DATE + 500 * DAY);
    expect(sim.craft.every((c) => c.status === "docked")).toBe(true);
  });

  it("fires departure then arrival, in order, and spends fuel at the BURN", () => {
    let s = order(newSim(1, "easy"), "ship-0", "mars");
    const leg = s.craft[0].leg;
    expect(s.craft[0].status).toBe("waiting");
    // Waiting must not have cost anything yet — the ship hasn't lit the engine,
    // and a scheduled departure has to stay cancellable at no charge.
    expect(s.craft[0].fuel).toBe(SHIP_FUEL);

    ({ sim: s } = advance(s, leg.departT));
    expect(s.craft[0].status).toBe("transit");
    expect(s.craft[0].fuel).toBeCloseTo(SHIP_FUEL - leg.dv, 6);

    ({ sim: s } = advance(s, leg.arriveT));
    expect(s.craft[0].status).toBe("docked");
    expect(s.craft[0].at).toBe("mars");
    expect(s.craft[0].leg).toBeNull();
  });

  it("crosses several events in one jump without losing any", () => {
    // The fast-forward case: 120 days a second can leap a departure AND an
    // arrival in a single frame. A single-pass advance would silently drop one
    // and leave a ship in transit forever.
    let s = newSim(1, "easy");
    s = order(s, "ship-0", "mars");
    s = order(s, "ship-1", "venus");
    const { sim, fired } = advance(s, END_DATE);
    expect(fired.length).toBe(4);                       // 2 departures + 2 arrivals
    expect(sim.craft[0].at).toBe("mars");
    expect(sim.craft[1].at).toBe("venus");
    expect(sim.craft.every((c) => c.status !== "transit")).toBe(true);
  });

  it("arriving at the same instant as departing is still ordered correctly", () => {
    let s = order(newSim(3, "easy"), "ship-0", "mars");
    const { sim } = advance(s, s.craft[0].leg.arriveT);
    expect(sim.craft[0].status).toBe("docked");
    expect(sim.craft[0].fuel).toBeLessThan(SHIP_FUEL);  // the burn still happened
  });

  it("nextEvent finds the EARLIEST across the whole fleet", () => {
    let s = newSim(1, "easy");
    s = order(s, "ship-0", "saturn");   // long
    s = order(s, "ship-1", "venus");    // short
    const e = nextEvent(s);
    const all = s.craft.filter((c) => c.leg).map((c) => c.leg.departT);
    expect(e.t).toBe(Math.min(...all));
  });
});

describe("orders", () => {
  it("refuses a transfer the ship cannot afford", () => {
    let s = newSim(1, "easy");
    s = { ...s, craft: s.craft.map((c, i) => i === 0 ? { ...c, fuel: 1 } : c) };
    const after = order(s, "ship-0", "saturn");
    expect(after.craft[0].status).toBe("docked");   // unchanged
    expect(after.craft[0].leg).toBeNull();
  });

  it("refuses to send a ship where it already is", () => {
    const s = order(newSim(1, "easy"), "ship-0", "earth");
    expect(s.craft[0].leg).toBeNull();
  });

  it("standing down before the burn is free", () => {
    let s = order(newSim(1, "easy"), "ship-0", "mars");
    s = standDown(s, "ship-0");
    expect(s.craft[0].status).toBe("docked");
    expect(s.craft[0].fuel).toBe(SHIP_FUEL);
  });

  it("a ship already in transit cannot be retargeted", () => {
    let s = order(newSim(1, "easy"), "ship-0", "mars");
    ({ sim: s } = advance(s, s.craft[0].leg.departT));
    const leg = s.craft[0].leg;
    s = order(s, "ship-0", "venus");
    expect(s.craft[0].leg).toEqual(leg);   // untouched
  });

  it("ships fly independently — one waiting does not hold up another", () => {
    let s = newSim(1, "easy");
    s = order(s, "ship-0", "saturn");
    s = order(s, "ship-1", "mars");
    ({ sim: s } = advance(s, s.craft[1].leg.arriveT));
    expect(s.craft[1].at).toBe("mars");
    expect(s.craft[0].status).not.toBe("docked");   // still out there
  });
});

describe("where the ships are drawn", () => {
  it("a docked ship has no heliocentric position of its own", () => {
    const s = newSim(1, "easy");
    expect(craftPosition(s.craft[0], s.t)).toBeNull();
  });

  it("a ship in transit starts on its origin orbit and ends on its target's", () => {
    let s = order(newSim(1, "easy"), "ship-0", "jupiter");
    ({ sim: s } = advance(s, s.craft[0].leg.departT));
    const { departT, arriveT, r1, r2 } = s.craft[0].leg;
    expect(craftPosition(s.craft[0], departT).r).toBeCloseTo(r1, 6);
    expect(craftPosition(s.craft[0], arriveT).r).toBeCloseTo(r2, 6);
    // ...and is genuinely between them in the middle, not teleporting.
    const mid = craftPosition(s.craft[0], (departT + arriveT) / 2).r;
    expect(mid).toBeGreaterThan(r1);
    expect(mid).toBeLessThan(r2);
  });

  it("the drawn route is a continuous arc", () => {
    let s = order(newSim(1, "easy"), "ship-0", "mars");
    const path = craftPath(s.craft[0], 40);
    expect(path).toHaveLength(41);
    expect(path[0].r).toBeCloseTo(s.craft[0].leg.r1, 6);
    expect(path[40].r).toBeCloseTo(s.craft[0].leg.r2, 6);
  });
});

describe("the job board", () => {
  it("a matching shot scores and refills the board", () => {
    const s = newSim(1, "easy");
    const target = s.board[0];
    const r = shoot(s, target, "easy");
    expect(r.hit).toBe(true);
    expect(r.points).toBe(100);
    expect(r.sim.board).toHaveLength(BOARD_SIZE);      // refilled from the queue
    expect(r.sim.board).not.toContain(target);
    expect(r.sim.completed).toContain(target);
  });

  it("any craft's shot resolves against the WHOLE board", () => {
    // The point of a fleet: you send ships at what you think the clues mean, and
    // anything you find that matches an open job counts, whoever found it.
    const s = newSim(1, "easy");
    const r = shoot(s, s.board[2], "hard");
    expect(r.hit).toBe(true);
    expect(r.points).toBe(190);
  });

  it("shooting something nobody asked for scores nothing and changes nothing", () => {
    const s = newSim(1, "easy");
    const r = shoot(s, "olympus-mons-not-a-real-id", "easy");
    expect(r.hit).toBe(false);
    expect(r.sim).toBe(s);
  });

  it("the board shrinks once the queue is dry, and the run ends when it empties", () => {
    let s = newSim(1, "easy");
    let guard = 0;
    while (s.board.length && guard++ < 100) s = shoot(s, s.board[0], "easy").sim;
    expect(s.board).toHaveLength(0);
    expect(simStatus(s)).toBe("complete");
  });
});

describe("the charter", () => {
  it("runs out at 2050", () => {
    const s = newSim(1, "easy");
    expect(simStatus(s)).toBe("running");
    expect(simStatus({ ...s, t: END_DATE })).toBe("expired");
  });

  it("an empty tank is not a loss — an idle ship is just idle", () => {
    // Deliberately NOT a fail state. With a fleet, one stranded hull is a
    // setback; ending the game for it would punish experimenting.
    const s = newSim(1, "easy");
    const broke = { ...s, craft: s.craft.map((c) => ({ ...c, fuel: 0 })) };
    expect(simStatus(broke)).toBe("running");
  });
});
