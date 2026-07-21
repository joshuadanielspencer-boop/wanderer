# Wanderer — a solar system photo safari

> *planet*, from Greek **planētēs** — "wanderer".

Shutterbug's game, relocated to the solar system: read the clue, travel to the
right world, photograph the right place, learn something true. Read
[`docs/design.md`](docs/design.md) first — it is the whole plan, in two parts.

**Current state:** the map, a playable slice, a fleet under a drivable clock, and
day/night on real mission imagery.

```bash
npm install
npm run dev     # → http://localhost:5273/
npm test        # the ephemeris accuracy suite
```

## Play

Click **Take the charter**. You get three ships, a board of assignments, and
twenty-two years. Pick a ship, click a world, and choose: leave now and fight
the geometry, or wait for the launch window and pay the minimum. Waiting is
cheaper — and costs you a hull sitting idle, which is the whole point of having
more than one.

Then drive the clock: pause, 6 hours a second, 3 days, 20 days, 120 days, or
skip straight to the next arrival. Ships fly real transfer ellipses while the
planets keep moving around them.

At a world, you can only photograph what is **in daylight**. Click a dark site
and the game offers to wait for sunrise.

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

## What the slice adds

Real Hohmann transfers (`src/transfer.js`), verified against the published
Earth→Mars figures: 259 days of flight, a 44° phase angle at departure, 5.6 km/s,
and a 780-day synodic period. Every travel decision offers **leave now** versus
**wait for the window**, priced honestly, with a diagram of why.

Three pressures, not one: **propellant**, the **charter** (a career is finite),
and the clue itself.

Two things the slice taught us that were not obvious:

- **Δv to the outer planets peaks near 15.5 AU and then falls.** It takes *less*
  fuel to reach Neptune than Uranus. Nobody believes this at first; it is the
  classic r₂/r₁ ≈ 15.58 result and it is now a test.
- **Cost is synodic period, not distance.** Jupiter and Saturn align for a
  minimum-energy transfer only once every ~20 years, so a Jupiter → Saturn
  assignment could open with a 16-year wait before a 10-year flight. The run
  planner now flies each run as it plans it and refuses anything the calendar
  forbids. (Same fact that made Voyager's Grand Tour a once-in-176-years chance.)

Run length is therefore **not always five** — it is as many assignments as the
charter allows. Where you are sent determines how much you can do, which is the
honest answer.

## The fleet and the clock

Time controls and parallel ships are **one feature, not two**. Add fast-forward
alone and waiting for a window becomes a button press — the propellant-against-
time trade evaporates. A second hull sitting idle is what puts the cost back.
(`docs/design.md` §1.5.2.)

Ships are drawn on the **actual transfer ellipse**, Kepler-solved. A straight
line would have been three lines of code and a lie: spacecraft do not fly at
planets, they fall around the Sun to meet them. Two invariants a lerp would
fail are tested — a Hohmann transfer sweeps exactly 180° of longitude, and the
ship visibly moves faster near the Sun than at aphelion.

## Day and night

You cannot photograph the dark side. What is true here, and what is not:

- **True — the rate.** Every solar day is real. Mars is 24h 39m 35s, Titan is
  sixteen Earth days, Venus's day is longer than its year, Io turns in under
  two. Retrograde rotators sweep the other way, because on Venus the Sun rises
  in the west.
- **True — the season.** Sub-solar latitude swings with the real axial tilt over
  the body's real year: Jupiter has no seasons worth the name, Uranus's poles
  get decades of continuous daylight, and polar night is real.
- **Not yet true — the phase.** Which meridian faces the Sun on a given date is
  not tied to a real epoch. So the game teaches day length and season, and never
  claims a named site is dark on a specific real date. Anchoring it needs the
  IAU rotational elements.

A low raking sun scores +50 (long shadows show relief); an overhead sun scores
−25 (the landscape washes flat). Every real imaging campaign is planned around
exactly this.

## Body plates

`node scripts/fetch-plates.mjs` pulls global equirectangular mosaics — currently
**Mars, Mercury, Europa and Enceladus**, all public domain, 1.5 MB total. Every
entry in that script's manifest was licence-checked by hand, and the header
records what is deliberately absent and why. Two real traps it documents:

- **Titan's** best global mosaic on Commons is *Attribution*, not public domain —
  Cassini is a joint NASA/ESA mission and ESA's default is CC BY-SA 3.0 IGO.
- **"Callisto Hemispherical Globes"** is 2:1 and is two circles on a black
  field, not a cylindrical map. It passes an automated aspect check and would
  put every pin somewhere it isn't. A human has to look at each plate once.

## What it does NOT have

No profiles, no passport, no art, no sound, no PWA, and only eighteen
hand-written features. The content pipeline (phase 1) is the next big piece.

## Accuracy

`npm test` checks the physics against **independently published values**, never
against itself:

- **Ephemeris** — the Mars, Jupiter and Saturn oppositions of 2024–25, Earth's
  perihelion and aphelion distances, every sidereal period, and Pluto's 1979–99
  excursion inside Neptune's orbit. Opposition agreement is **0.22°–0.30°**,
  which is the half-day slop from testing dates published to the day, not table
  error.
- **Transfers** — the textbook Earth→Mars and Earth→Venus figures, and the
  Earth–Mars / Earth–Venus / Earth–Jupiter synodic periods to the day.
- **Runs** — that every seeded run is winnable inside both the tank and the
  charter. This one has already caught a real bug: runs were finishing in 2275.
- **The simulation** — that fast-forward never drops an event, that a ship in
  transit cannot be retargeted, and that standing down before the burn is free.
- **Illumination** — published day lengths, that exactly half a world is lit at
  any moment, that polar night happens, and that the drawn terminator agrees
  with the rule the game enforces. A pin that *looks* lit but refuses the shot
  would be the worst bug available here.

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
  transfer.js      Hohmann transfers, launch windows, light lag. What it costs to go.
  run.js           The run: assignments, propellant, charter. Pure and testable.
  rng.js           The one RNG. Seeded runs are reproducible.
  sim.js           Clock, fleet, events, job board. Pure and testable.
  illumination.js  Day/night, seasons, sun angle. What you can photograph.
  orrery.js        Projection: AU → pixels, with an honest log/linear toggle.
  wanderer.jsx     The UI — three views, a fleet panel, time controls.
  data/
    bodies.js      Systems, moons, delta-v. The board.
    features.js    The places you photograph. Will become GENERATED.
public/plates/     Global equirectangular body maps (PD; see fetch-plates.mjs).
scripts/
  fetch-plates.mjs      Licence-checked manifest → downloaded, re-encoded plates.
  make-body-plate.mjs   Same job from a local file, for the giant USGS GeoTIFFs.
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
