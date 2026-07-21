// ===========================================================================
// THE SIMULATION — a world clock, a fleet, and events that resolve themselves.
//
// This replaces the turn-based run from the first slice, and it does so for a
// reason the playtest exposed rather than for tidiness (docs/design.md §1.5.2):
//
//   Add fast-forward, and waiting for a launch window stops costing anything.
//   It becomes a button press, and the trade the whole game is built on —
//   propellant against time — quietly evaporates.
//
//   PARALLEL CRAFT PUT THE COST BACK. Waiting is only expensive if that ship
//   could have been doing something else. Three hulls under way and a fourth in
//   dock means "wait 19 months for the cheap window" costs 19 months of that
//   hull earning nothing.
//
// So time controls and a fleet are one feature, not two, and neither is safe to
// ship alone.
//
// NO EVENT QUEUE. Events are DERIVED from craft state rather than stored in a
// list: the next thing that happens is the earliest departure or arrival among
// the fleet. A stored queue would be a second source of truth to keep in sync
// with the craft, and the first thing to drift when a craft is retargeted.
// Deriving costs a loop over a handful of ships and cannot go stale.
// ===========================================================================

import { FEATURES } from "./data/features.js";
import { SYSTEM_BY_ID } from "./data/bodies.js";
import { shuffled, withSeed } from "./rng.js";
import { transferOptions, transferPosition } from "./transfer.js";
import { heliocentric } from "./ephemeris.js";

const DAY = 86400000;

export const START_SYSTEM = "earth";
export const START_DATE = Date.UTC(2028, 0, 1);
export const END_DATE = Date.UTC(2050, 0, 1);

/** Systems a job may send you to. See docs/design.md §1.5 — a thirty-year
 *  one-way flight to Neptune is not an assignment, it is an emigration. */
export const RUN_SYSTEMS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn"];

/** How many jobs are open at once. Enough to give the fleet real choices. */
export const BOARD_SIZE = 4;

/**
 * Clock speeds, in mission-days per real second.
 *
 * The top speed matters more than it looks: a Saturn transfer is six years, and
 * at 120 days/sec that is eighteen seconds of watching the ship crawl round the
 * Sun. Fast enough not to be a chore, slow enough that the player SEES the
 * distance rather than being teleported past it. Skipping straight to the next
 * event is always available for when they don't want to watch at all.
 */
export const RATES = [
  { label: "❚❚", days: 0, name: "Paused" },
  // The slow rate exists for SURFACE work, not for travel. A Martian solar day
  // is 24h 39m; at 3 days a second it flickers past in a third of a second, so
  // waiting for sunrise at a site would be impossible to steer. Six hours a
  // second makes a Martian day about four seconds long — slow enough to watch
  // the terminator cross a landing site.
  { label: "▷", days: 0.25, name: "6 hours a second" },
  { label: "▶", days: 3, name: "3 days a second" },
  { label: "▶▶", days: 20, name: "20 days a second" },
  { label: "▶▶▶", days: 120, name: "120 days a second" },
];

export const SHIP_NAMES = ["Kestrel", "Bellwether", "Long Light", "Farside", "Patience"];

/** Starting propellant per hull, km/s of Δv. */
export const SHIP_FUEL = 60;

export function newSim(seed, tier, ships = 3) {
  const jobs = withSeed(seed, () =>
    shuffled(FEATURES.filter((f) => RUN_SYSTEMS.includes(f.system))).map((f) => f.id));

  return {
    seed, tier,
    t: START_DATE,
    rateIdx: 0,
    craft: Array.from({ length: ships }, (_, i) => ({
      id: `ship-${i}`,
      name: SHIP_NAMES[i % SHIP_NAMES.length],
      status: "docked",
      at: START_SYSTEM,
      fuel: SHIP_FUEL,
      fuelMax: SHIP_FUEL,
      leg: null,
    })),
    board: jobs.slice(0, BOARD_SIZE),   // open assignments, any craft may fill any
    queue: jobs.slice(BOARD_SIZE),      // refills the board as jobs are completed
    completed: [],
    score: 0,
    log: [],
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** The next moment anything happens, or null if the fleet is entirely idle. */
export function nextEvent(sim) {
  let best = null;
  for (const c of sim.craft) {
    if (c.status === "waiting" && c.leg) {
      if (!best || c.leg.departT < best.t) best = { t: c.leg.departT, craftId: c.id, kind: "depart" };
    } else if (c.status === "transit" && c.leg) {
      if (!best || c.leg.arriveT < best.t) best = { t: c.leg.arriveT, craftId: c.id, kind: "arrive" };
    }
  }
  return best;
}

/**
 * Run the world forward to `toT`, firing every event on the way.
 *
 * Returns a NEW sim, plus the list of events that fired so the UI can decide
 * whether to stop and tell the player. Never mutates.
 */
export function advance(sim, toT) {
  let s = { ...sim, craft: sim.craft.map((c) => ({ ...c })) };
  const fired = [];

  // Loop rather than a single pass: a fast-forward step can cross several
  // events at once, and a departure can be immediately followed by an arrival.
  for (let guard = 0; guard < 500; guard++) {
    const e = nextEvent(s);
    if (!e || e.t > toT) break;
    const c = s.craft.find((x) => x.id === e.craftId);

    if (e.kind === "depart") {
      // Propellant is spent at the burn, not on arrival — that is when it
      // physically leaves the tank, and it means a ship that is waiting still
      // has the fuel to be retargeted.
      c.status = "transit";
      c.fuel -= c.leg.dv;
    } else {
      c.status = "docked";
      c.at = c.leg.to;
      c.leg = null;
    }
    s.t = e.t;
    fired.push({ ...e, craftName: c.name, at: c.at });
  }

  s.t = Math.max(s.t, toT);
  return { sim: s, fired };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Send a craft somewhere. `leg` is "goNow" or "window" from transferOptions.
 *
 * The craft goes into `waiting` even for an immediate departure; `advance` then
 * fires the burn. One code path for both, so there is no way for a "leave now"
 * order to skip the fuel deduction that a scheduled one performs.
 */
export function orderTransfer(sim, craftId, toSystem, which) {
  const c = sim.craft.find((x) => x.id === craftId);
  if (!c || c.status === "transit") return sim;

  const from = SYSTEM_BY_ID[c.at], to = SYSTEM_BY_ID[toSystem];
  if (!from?.ephemerisKey || !to?.ephemerisKey || c.at === toSystem) return sim;

  const opts = transferOptions(from.ephemerisKey, to.ephemerisKey, new Date(sim.t));
  const o = opts[which];
  if (o.dv > c.fuel) return sim;

  const departT = o.departs.getTime();
  const p1 = heliocentric(from.ephemerisKey, o.departs);
  const p2 = heliocentric(to.ephemerisKey, new Date(departT + o.days * DAY));

  return {
    ...sim,
    craft: sim.craft.map((x) => x.id !== craftId ? x : {
      ...x,
      status: "waiting",
      leg: {
        from: c.at, to: toSystem,
        departT, arriveT: departT + o.days * DAY,
        dv: o.dv,
        // Frozen at order time so the drawn arc never shifts under the ship.
        r1: p1.r, r2: p2.r, lon1: p1.lon,
      },
    }),
  };
}

/** Cancel a scheduled departure. Free, because the burn hasn't happened. */
export function standDown(sim, craftId) {
  return {
    ...sim,
    craft: sim.craft.map((c) =>
      c.id === craftId && c.status === "waiting" ? { ...c, status: "docked", leg: null } : c),
  };
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

/** Where a craft is right now, heliocentric — or null if it is sitting at a
 *  world (in which case it is drawn on that world's marker instead). */
export function craftPosition(craft, t) {
  if (craft.status !== "transit" || !craft.leg) return null;
  const { departT, arriveT, r1, r2, lon1 } = craft.leg;
  const f = (t - departT) / (arriveT - departT);
  return transferPosition(r1, r2, lon1, f);
}

/** The whole arc a craft will fly, for drawing its route. */
export function craftPath(craft, steps = 60) {
  if (!craft.leg) return [];
  const { r1, r2, lon1 } = craft.leg;
  return Array.from({ length: steps + 1 }, (_, i) => transferPosition(r1, r2, lon1, i / steps));
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------

/** Is this feature one of the open jobs? */
export const jobFor = (sim, featureId) => sim.board.includes(featureId);

/**
 * Photograph something.
 *
 * A shot resolves against the WHOLE board, not against one craft's orders. That
 * is what makes a fleet feel like a fleet: you send ships toward what you think
 * the clues mean, and anything you find that matches an open job counts. It
 * also quietly forgives a misread clue that happened to land somewhere useful,
 * which is a kinder failure mode for a child than "wrong ship, no points".
 */
export function shoot(sim, featureId, tier, lightBonus = 0) {
  if (!sim.board.includes(featureId)) return { sim, hit: false, points: 0 };

  // lightBonus rewards catching a site under a low, raking sun and docks a
  // little for shooting at local noon, when the landscape washes out flat.
  const points = Math.max(10, 100 + ({ easy: 0, medium: 40, hard: 90 }[tier] ?? 0) + lightBonus);
  const board = sim.board.filter((id) => id !== featureId);
  const queue = [...sim.queue];
  if (queue.length) board.push(queue.shift());

  return {
    sim: {
      ...sim,
      board, queue,
      completed: [...sim.completed, featureId],
      score: sim.score + points,
    },
    hit: true,
    points,
  };
}

/** Has the charter ended? The fleet's fuel is not fatal — an idle ship is not
 *  a lost game, it is just an idle ship. Time is the thing that runs out. */
export function simStatus(sim) {
  if (sim.t >= END_DATE) return "expired";
  if (!sim.board.length) return "complete";
  return "running";
}

export const featureById = (id) => FEATURES.find((f) => f.id === id);
