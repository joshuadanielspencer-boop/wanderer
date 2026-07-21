# Wanderer — a solar system photo safari

> *planet*, from Greek **planētēs** — "wanderer".

Shutterbug's game, relocated to the solar system: read the clue, travel to the
right world, photograph the right place, learn something true. Read
[`docs/design.md`](docs/design.md) first — it is the whole plan, in two parts.

**This repo currently contains phase 0 only: the spike.** It is not the game.

```bash
npm install
npm run dev     # → http://localhost:5273/
npm test        # the ephemeris accuracy suite
```

## What the spike proves

1. **The orrery is real.** Planet positions come from JPL's published Keplerian
   elements (`src/ephemeris.js`), not from decoration. Run the clock and the
   planets move on their true periods. Wind back to 16 January 2025 and Earth
   sits exactly between the Sun and Mars, because that is when the real Mars
   opposition was.
2. **The three-level ladder works** as navigation — system → body → feature, the
   direct counterpart of Shutterbug's continent → country → city.
3. **The map's answer changes with the calendar.** Distance, light lag, and which
   target is worth going to are all different in March than in November. That is
   the mechanic the whole resource layer is built on.
4. **The content shape holds** — clue ladder, fact, Earth comparison, name
   origin, confidence flag.

## What it does NOT have

No run loop, no scoring, no profiles, no passport, no art, no sound, no PWA, no
delta-v spending, no transfer-window enforcement. Phases 3–6.

## Accuracy

`npm test` checks the ephemeris against **independently published events** — the
Mars, Jupiter, and Saturn oppositions of 2024–25, Earth's perihelion and
aphelion distances, every planet's sidereal period, and Pluto's 1979–99 excursion
inside Neptune's orbit. Current opposition agreement is **0.22°–0.30°**, which is
the half-day slop from testing dates published to the day, not table error.

This matters more than it looks. A broken ephemeris still draws a solar system
that goes round, and every number the game teaches would be quietly wrong.

## The two project rules that carry over from Shutterbug, unchanged

1. **All content lives in `src/data/`**, never inline in a component.
2. **Every fact must be accurate and verifiable** before it ships. This is a
   teaching tool for children.

⚠ The content currently in `src/data/` is **spike content, hand-written from
memory**. The numbers are textbook values and the name origins are real, but
none of it has been checked one-by-one against a primary source yet. Before any
of it reaches a child it gets regenerated from the IAU Gazetteer and verified.
See the header of each data file for the authority to check against.

## Layout

```
src/
  ephemeris.js     JPL Keplerian elements + Kepler solve. The file everything stands on.
  orrery.js        Projection: AU → pixels, with an honest log/linear toggle.
  wanderer.jsx     The spike UI — three views.
  data/
    bodies.js      Systems, moons, delta-v. The board.
    features.js    The places you photograph. Will become GENERATED.
scripts/
  make-body-plate.mjs   Published mosaic → game plate. You download; it resizes.
test/
  ephemeris.test.js     The accuracy suite.
docs/
  design.md        The plan. Part 1 = this game. Part 2 = where it can go.
```

## Body plates

`public/plates/<body>.jpg` — global equirectangular mosaics, 2:1. **None are
committed yet**, so the body view draws a flat placeholder and says so. See the
header of `scripts/make-body-plate.mjs` for which USGS/NASA products to fetch and
the licence trap to watch for (Cassini products are joint NASA/ESA, and ESA's
default is not public domain).
