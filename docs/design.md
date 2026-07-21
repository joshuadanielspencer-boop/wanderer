# WANDERER — a world photo safari, in the solar system

> *planet*, from Greek **planētēs** — "wanderer". The name of the genre is also
> the lesson.

A design document for a **new game in a new repo**, built on Shutterbug's proven
bones but not coupled to it. Two halves:

- **Part 1 — The base layer.** Shutterbug's loop, relocated to the solar system.
  A complete, shippable game on its own. This is the buildable plan.
- **Part 2 — The full game.** Stations, an economy, decades of program history —
  the *For All Mankind* / *Expanse* path. This is brainstorm, not a build order.

**Decisions already made** (2026-07-21):

| Question | Answer |
|---|---|
| Codebase | **New repo, copy the good bones.** No shared package, no coupling. Shutterbug stays finished. |
| Audience | **One game that grows with the kids.** Survey mode is the on-ramp; the economy is what they graduate into. Nothing gets a spreadsheet UI. |
| Sim depth | **Simplified but honest.** Real orbital periods, real relative positions, real delta-v ordering, real transfer windows — from small tables, not integrated trajectories. |

> ⚠ **Every fact in this document is a design sketch, not verified content.**
> Shutterbug's rule 2 carries over unchanged: nothing ships until it's checked
> against a reliable source. The examples below are here to show the *shape* of
> the content, and several of them will need correcting.

**Status:** Part 1's **phase 0 is built** — see `README.md`. The ephemeris, the
three-level map ladder, the mission calendar, and the feature-card content shape
all work and are tested. Everything else below is still plan.

---

# Part 1 — The base layer

## 1.1 The mapping

Shutterbug's spine is a three-level spatial deduction: **continent → country →
city pin**, gated by a clue that reveals less as difficulty rises. The solar
system offers exactly three nested levels, which is the whole reason this works.

| Shutterbug | Wanderer | Count in v1 |
|---|---|---|
| Continent (7) | **System** — Sun, Mercury, Venus, Earth, Mars, the Belt, Jupiter, Saturn, Uranus, Neptune, Kuiper | 11 |
| Country | **Body** — the planet itself, or one of its moons | ~30 |
| City pin | **Feature** — a named surface feature at real lat/lon | ~150 |
| Subject to photograph | The feature itself | — |
| Category (14) | **Feature type**, curated from IAU descriptor terms | 14 |
| Local greeting | **Name origin** — see §1.3, this is the good one | — |
| Travel days | **Delta-v budget + mission calendar** (two resources) | — |
| Last-leg money | Propellant | — |
| Robinson world map | **Orrery view** (log-radius plan view of the system) | — |
| Continent relief plate | **Body view** (equirectangular USGS/NASA mosaic) | — |
| Country layer | **System view** (a planet and its moons) | — |

Everything else — profiles, passport, collections, spaced repetition, the
homecoming quiz, the four modes — transfers with the nouns swapped.

**The one structural difference, and it's a big one:** Shutterbug's map is
static. Ours moves. Decide this on day one, because it invalidates the "map is
art" assumption everywhere downstream.

## 1.2 The content pipeline — this is the unlock

`gen-geography.mjs` pulls rivers and lakes from Natural Earth. Its direct
counterpart already exists and is better:

**The IAU Gazetteer of Planetary Nomenclature** ([USGS
Astrogeology](https://planetarynames.wr.usgs.gov/AdvancedSearch)) is every named
feature on every body the IAU has approved since 1919. CSV export. Per feature it
carries:

- name, target body, and system
- **latitude and longitude** (planetocentric or planetographic, your choice)
- **diameter in km**
- **feature type** — 90+ descriptor terms (mons, crater, vallis, planitia, chasma,
  rupes, patera, sulci, macula, regio, …)
- approval status and **approval date**
- **origin of the name, and its cultural/ethnic classification**
- the reference the name came from

That last pair is the surprise. It means the game's cultural content is a
*column in the source data*, not something we invent. See §1.3.

The rest of the pipeline:

| Shutterbug script | Wanderer script | Source |
|---|---|---|
| `gen-geography.mjs` | `gen-features.mjs` | IAU Gazetteer CSV → `src/data/features.js` |
| `make-relief.mjs` | `make-body-plate.mjs` | [USGS Astropedia](https://astrogeology.usgs.gov/search) global mosaics (Mars MOLA/HRSC, Moon LRO WAC, Mercury MESSENGER MDIS, Dawn at Ceres/Vesta, Galileo at the Galilean moons, Cassini at Titan/Enceladus, New Horizons at Pluto/Charon) |
| Wikimedia photo hunt | `fetch-photos.mjs` | [images.nasa.gov](https://images.nasa.gov) — **public domain**, no attribution puzzle |
| `imperial-first.mjs` | `units.mjs` | see §1.7 |
| — | **new:** JPL [approximate Keplerian elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html) (valid 1800–2050) | one small table, deterministic, offline |

Licensing is *easier* than Shutterbug, not harder — USGS and NASA imagery is
overwhelmingly public domain. Two traps to write into the content rules:

- **ESA / JAXA / Roscosmos images are not automatically free.** ESA's default is
  CC BY-SA 3.0 IGO. Cassini and Huygens are joint NASA/ESA missions, so a Titan
  image needs checking, not assuming.
- Some of the prettiest outer-planet images are **amateur reprocessings** of raw
  mission data. Often CC-licensed and often gorgeous, but the licence is the
  processor's, not NASA's.

## 1.3 The greeting analog — name origins

Shutterbug's best small idea is that every place teaches you something about the
people who live there. There are no people out here. The replacement is better
than a substitute — it's the same idea, one step abstracted:

**Every feature on every body is named according to a per-body theme, chosen by
the IAU, and the theme is almost always drawn from human culture.**

- **Mercury's craters** — artists, writers, and composers. Beethoven, Tolstoy,
  Bashō, Chekhov, Sor Juana.
- **Venus** — very nearly everything is named for women, real and mythological.
  Maxwell Montes is the sole exception, named before the rule existed.
- **Io** — fire and thunder gods from every culture on Earth, plus Dante's
  *Inferno*. Loki, Pele, Prometheus, Tvashtar, Amirani.
- **Europa** — Celtic deities and characters from the Europa myth. Pwyll,
  Conamara.
- **Titan** — mountains from Tolkien; plains from Asimov's *Foundation*; seas
  from sea monsters. **Kraken Mare** is a real lake of liquid methane named after
  a Norwegian sea monster.
- **Enceladus** — the *Arabian Nights*. Damascus Sulcus, Baghdad Sulcus, Cairo
  Sulcus — the "tiger stripes" that vent water into space.
- **Uranus's moons** — Shakespeare and Alexander Pope. Miranda, Ariel, Titania.
- **Pluto** — explorers, underworld gods, and space pioneers. Tombaugh Regio,
  Sputnik Planitia, Hillary and Norgay Montes.
- **Charon** — fictional explorers. Mordor Macula, Kubrick Mons.

So each feature card carries a **name card** in the slot where Shutterbug puts a
greeting:

```
KRAKEN MARE — Titan
Named for the Kraken, a sea monster from Norwegian folklore.
Every sea on Titan carries the name of a sea monster.
```

It's verifiable (the gazetteer ships the reference), it's a different culture
every time, and it quietly teaches that the naming of the solar system was a
human argument that people won. A kid who plays this learns who Bashō was
because a hole in Mercury is named after him.

## 1.4 The category set

Fourteen, curated down from the IAU's 90+ descriptor terms, chosen to be
kid-legible and to spread across bodies (a category with members on only one
moon can't carry a category mission — Shutterbug's `missions.js` fairness rules
transfer verbatim, including the bug they exist to prevent).

| Key | Name | Examples |
|---|---|---|
| `crater` | Impact Crater | Tycho, Herschel (Mimas), Copernicus |
| `basin` | Great Basin | Hellas, Caloris, South Pole–Aitken |
| `mons` | Mountain | Olympus Mons, Maxwell Montes, Boösaule |
| `vallis` | Canyon & Valley | Valles Marineris, Baltis Vallis |
| `chasma` | Chasm & Rift | Ithaca Chasma, Valhalla |
| `rupes` | Cliff & Scarp | Verona Rupes, Discovery Rupes |
| `planum` | Plain & Plateau | Sputnik Planitia, Amazonis |
| `volcano` | Volcano | Loki Patera, Tvashtar, Ahuna Mons |
| `mare` | Sea & Lake | Mare Tranquillitatis, Kraken Mare, Ontario Lacus |
| `linea` | Cracks & Grooves | Europa's lineae, Enceladus's tiger stripes, Ganymede's sulci |
| `regio` | Region | Tombaugh Regio, Cthulhu Macula |
| `storm` | Storm & Sky | Great Red Spot, Saturn's hexagon, Great Dark Spot |
| `ring` | Ring & Gap | Cassini Division, Encke Gap, the F ring |
| `landing` | Landing Site | Tranquility Base, Bradbury Landing, Octavia E. Butler Landing |

Shutterbug's three "kinds" (built / natural / living) become three that describe
*what made the thing*:

- **struck** — something hit it (crater, basin)
- **restless** — the world did it to itself: heat, ice, tides, wind (everything else)
- **ours** — we did it (landing sites, and the names)

`landing` is the sleeper category. Every landing site is a human story with a
date, a crew or a robot, and a reason that spot was chosen — and it's the bridge
into Part 2, where choosing where to land becomes the whole game.

## 1.5 The clue ladder

Identical structure, identical enforcement test:

| Tier | Shutterbug | Wanderer |
|---|---|---|
| easy | names continent **and** country | names the system **and** the body |
| medium | names country, hides continent | names the body, hides which planet it orbits |
| hard | names neither | pure physical and naming context |

Worked example, Verona Rupes:

- **easy** — "In the Uranus system, on the little moon Miranda. A cliff so tall
  that if you stepped off the top, you'd fall for about twelve minutes before you
  landed."
- **medium** — "On Miranda. The tallest cliff we know of anywhere. The moon was
  named by an astronomer who loved Shakespeare, and so was the cliff."
- **hard** — "A world that looks like it was smashed and glued back together
  badly. Somewhere on it, a wall of ice miles high — in gravity so weak that the
  fall would be survivable in a good suit."

## 1.6 Travel — delta-v, windows, and light lag

Shutterbug spends **travel days**, and its Adventurer tier adds a time-vs-money
choice on the last leg. That exact shape survives, with better physics under it.

**Two resources.**

- **Delta-v** — the fuel budget for the run. Bodies sit on a delta-v graph, and
  the ordering is the lesson: Ceres is *further* than the Moon but *cheaper* to
  land on and leave. Mercury is close and brutally expensive because it's deep in
  the Sun's well. Aerobraking at Mars, Venus, and Titan is nearly free. Kids learn
  that **"far" and "hard" are different words**, which is the single most
  counterintuitive true thing about spaceflight.
- **The calendar** — the mission date, advancing in weeks and months.

**Transfer windows.** The orrery shows real relative positions for the mission
date. A transfer is cheap only when the geometry is right. Waiting costs *time*;
going now costs *delta-v*. This is the same trade Shutterbug's last-leg chooser
already makes and playtested well — but here it's the actual physics, and it
makes the calendar load-bearing.

It also means **the answer can be "when", not just "where"**: Saturn's rings go
edge-on and vanish; Mars has a dust-storm season; an eclipse happens on a
schedule. A clue can be a date.

**Light lag — the mechanic that only exists here.**

Your mentor is on Earth. Their messages arrive late, by the real one-way light
time for your current distance:

| Where you are | One-way light time |
|---|---|
| The Moon | 1.3 seconds |
| Mars | 3–22 minutes |
| Jupiter | 33–53 minutes |
| Saturn | 1.2–1.7 hours |
| Pluto | ~4.5 hours |

Near Earth, your mentor is chatty and helps instantly. At Neptune, you ask for a
hint and it arrives *next turn*. **The difficulty curve is the speed of light**,
not a knob we invented — and the emotional arc (the further you go, the more
alone you are, the more the messages that do arrive matter) is *For All Mankind*
exactly.

Which solves the companion problem elegantly: the **ship's AI is aboard**, so it
talks in real time when Earth can't. As you travel outward the human voice fades
and the ship's voice takes over. Mr O, but the systems and the story say the same
thing.

## 1.7 Units — rule 3 in space

Imperial-first breaks down at 2.8 billion miles. The amendment:

1. **Human-scale measurements stay imperial-first.** "A cliff 12 miles high
   (20 km)." "A crater 50 miles across (80 km)."
2. **Orbital distances use AU**, with a miles gloss on first mention per screen.
   "Saturn is 9.6 AU from the Sun — nine and a half times as far as we are."
3. **Every feature carries an `earthComparison` field, and it is not optional.**
   "Two and a half times the height of Everest." "Wider than the United States."
   "As deep as four Grand Canyons stacked." This is the best teaching device the
   setting has, and making it a required field means it can't be forgotten.

Same discipline as Shutterbug: one conversion script, run once, tested — because
150 hand conversions is how a teaching tool ends up with one wrong number in it.

## 1.8 The three map views

The largest technical item. All three are plan-view or equirectangular, which is
mercifully simpler than Robinson.

**1. Orrery view** — replaces the world map. Sun-centred, top-down, **log-scaled
radius** so Mercury through Neptune fit one screen without the inner planets
piling into a dot. Planets at their real angular positions for the mission date,
from the JPL approximate elements. Clicking a planet picks a "continent". Overlay
the delta-v cost from where you are, and the next transfer window.

**2. System view** — replaces the country layer. One planet with its major moons
in orbit, plus rings, same log-radius trick. Jupiter and Saturn are rich enough to
be their own boards; Mercury and Venus have no moons, so they skip this layer
entirely (Shutterbug already handles a variable-depth ladder via
`usesCountryLayer` — same idea).

**3. Body view** — replaces the relief plate. Equirectangular mosaic of the body
with feature pins at real lat/lon. Optionally an orthographic globe for the
arrival beat, then flatten to equirect to play.

**Asset budget warning.** Shutterbug ships one 8192×4096 relief plate. We need
~30 body plates. At 2048×1024 JPEG, call it 250 KB each → 7–8 MB. That's
acceptable for a PWA but not free: precache the inner system, lazy-load the outer
system on first visit. Decide the tiling scheme before generating 30 plates, not
after.

## 1.9 What lifts from Shutterbug essentially unchanged

- **`profiles.js`** — profiles, bests, spaced repetition, passport
  export/import. Domain-agnostic; swap nouns.
- **`rng.js`** — verbatim, including `withSeed()`. Seeded reproducibility matters
  *more* here, because a moving map plus one stray `Math.random()` makes runs
  silently non-reproducible.
- **`art.js`** — the registry pattern. Game key → badge file, so art lands
  without touching UI code.
- **`missions.js`** — the category-mission fairness rules, whole. "Photograph any
  volcano in the Jupiter system" must only offer bodies that actually hold one
  *on our list*. Same bug, same fix.
- **The test suite's philosophy** — unique ids, in-range coords, licence fields
  present, reveal-ladder enforced, units enforced. Plus two new invariants:
  every feature's lat/lon must be inside its body's map bounds, and every
  `earthComparison` must be non-empty.
- **All four modes.** Assignments → **Assignments**. Grand Tour → **Grand Tour**.
  Explore → **Freeflight**. Journeys → **Missions Flown**, and this one gets
  *better*: retrace Voyager 2's actual Grand Tour, Apollo 8's Christmas orbit,
  Cassini's Grand Finale, New Horizons, a Mars rover's real driven traverse.
  Ordered, unskippable, the shape of the journey is the lesson — exactly what
  Journeys already does, with routes nobody disputes.
- **The homecoming quiz** at the end of every scored run.

## 1.10 The frame story

Shutterbug's frame — an old traveller lends you the camera he can no longer carry
— is load-bearing and should not be reinvented, just recast. The strongest
version:

**The camera is a spare flight unit.** Built for a probe that never launched,
kept for forty years by the engineer who built it, and she's giving it to you.
She spent her career looking at the outer planets through hardware she made and
never left the building. Now the camera goes.

That keeps every beat that works — someone who did the work, can't go now, is
sending you, and the object in your hands is theirs — and adds the light-lag
grief for free.

## 1.11 Build order

Rough sizing. Shutterbug is ~19,700 lines; Part 1 lands somewhere similar.

| Phase | What | Done when |
|---|---|---|
| **0. Spike** | Prove the orrery. Render the log-radius plan view with real positions for a date, one body plate, six features, click through system → body → feature. | You can click from the Sun to Olympus Mons. |
| **1. Data** | `gen-features.mjs` off the gazetteer CSV; `make-body-plate.mjs` for ~10 inner bodies; NASA image fetch; the schema in §1.12 frozen. | `features.js` exists and `npm test` guards it. |
| **2. Maps** | All three views, real art, pins, labels, keyboard navigation. | Every body in the data has a playable map. |
| **3. Loop** | Assignment → clue → orrery → system → body → shoot → fact → next. The whole game with fake resources. | It's a game. |
| **4. Resources** | Delta-v graph, calendar, transfer windows, light lag. | The clock and the fuel gauge both bite. |
| **5. Meta** | Profiles, passport, collections, spaced repetition, the four modes, homecoming quiz. | Feature parity with Shutterbug. |
| **6. Polish** | Art, sound, the mentor's story arc, the ship's voice. | Ship it. |

**Content targets for v1:** 11 systems · ~30 bodies · ~150 features. The
gazetteer supplies thousands of candidates with coordinates already attached, so
the work is *curation and clue-writing*, not research — which is the good kind of
work and the kind that can happen in parallel with the code.

## 1.12 Feature schema sketch

```js
{
  id: "olympus-mons",            // unique slug
  name: "Olympus Mons",
  body: "Mars",                  // → BODIES registry
  system: "Mars",                // → SYSTEMS registry (the "continent")
  lat: 18.65, lon: -133.8,       // real, from the gazetteer
  category: "mons",
  tags: ["volcano", "tallest"],
  diameterKm: 610,

  subject: "The tallest volcano in the solar system",
  easy:   "...",                 // names system + body
  medium: "...",                 // names body only
  hard:   "...",                 // names neither

  fact: "...",                   // verified, rule 2
  earthComparison: "Two and a half times the height of Everest, and as wide as Arizona.",
  confidence: "measured",        // measured | inferred | hypothesis  ← see §2.9

  nameOrigin: {                  // the "greeting" slot
    text: "Named for Mount Olympus, home of the Greek gods.",
    theme: "Martian volcanoes carry the names of sacred mountains.",
    culture: "Greek",
  },

  photo: { src, credit, license, licenseUrl, source },  // NASA PD, usually
  visited: null,                 // first imaged by, and when
}
```

---

# Part 1.5 — What the first playtest changed

Joshua played the vertical slice on **2026-07-21**. Three findings, and they
reshaped the build order. Recorded here rather than left in chat, for the same
reason Shutterbug keeps `design-notes.md`.

## 1.5.1 The verdict on the core bet

**The launch-window decision is interesting** — he went both ways on it, which is
the only evidence that matters for a choice mechanic. A choice you always answer
the same way is a tax, not a decision.

**The timescales read as epic, not tedious.** Runs ending in 2044 landed as
awe rather than boredom. That is a green light for keeping honest Hohmann
transfers instead of inventing a fast drive.

## 1.5.2 Parallel missions are what RESCUE the tension

The most important thing the playtest surfaced, and it is a trap we were walking
into.

Add time controls — fast-forward, skip-to-next-event — and **waiting for a launch
window stops costing anything.** It becomes a button press. The entire trade the
slice is built on (propellant against time) quietly evaporates, because
subjective time is free.

**Parallel missions put the cost back.** Waiting is only expensive if that ship
could have been doing something else. With three craft under way and a fourth in
dock, "wait 19 months for the cheap window" means 19 months of that hull earning
nothing while the Mars shuttle turns three cycles. That is a real opportunity
cost, and it is the calculation actual agencies make.

> **Therefore: time controls and parallel missions must ship together.** Time
> controls alone trivialise waiting. Parallel missions alone are unbearable
> without fast-forward. Neither is safe to build on its own.

It also dissolves a wart the slice already has: run length varying from two to
five because the dice sent you to Saturn. With a fleet you fill the charter with
parallel work instead.

Architecturally this is the big one — the game stops being a turn-based sequence
and becomes a **continuous simulation with an event queue**. Better done before
more content, because it redefines what a run is.

## 1.5.3 Light lag bites when you zoom IN, not out

Lag felt like decoration in the slice, and the reason is a scale mismatch worth
stating plainly:

> Transit is **months**. Lag is **hours**. Hours do not register against months.
> **Light lag is invisible at the interplanetary scale and absolute at the
> operational scale.**

An operation takes seconds to minutes. Against that, hours of lag is total. So
the mechanic is not "your hint arrives late" — it is **"you are not there, and
you cannot be."** Four ways to cash that in, best bet first:

**1. Commit-blind operations.** You do not perform an action at range; you write
a plan, send it, and it executes without you. Mars entry, descent and landing
takes about seven minutes against 4–22 minutes of one-way lag — the landing is
over before Earth knows it began. ("The seven minutes of terror" is not drama;
nobody can intervene, ever.) You choose descent profile, camera pointing and
abort conditions, then watch. Difficulty scales with distance automatically, with
no knob to tune.

**2. Rover driving as batch commands.** Real Mars rovers are not joysticked — the
team sends a day's plan and reads the results tomorrow. Study yesterday's images,
write today's route, find out tomorrow whether you drove into a sand trap.

**3. The one-pass flyby.** One encounter, pre-programmed months ahead, exactly as
New Horizons did at Pluto. Point the camera wrong and you get nothing, and you
learn that four hours later.

**4. Stale advice, not merely late advice.** At Neptune a message you receive was
written 4.1 hours ago about a situation that has changed; your mentor is
answering a question you no longer have. Costs nothing to implement — it is a
display choice — and it is the whole *For All Mankind* emotional engine.

Two things fall out for free:
- **Autonomy becomes a real upgrade path**, which is literally why spacecraft
  carry autonomous systems, and it slots into Part 2's tech tree.
- **The ship's AI stops being flavour and becomes necessary** — it is the only
  real-time voice available out there. As you travel outward the human voice
  fades and the ship's takes over because physics says so, not because we wrote
  it that way.

⚠ **Kid-mode caveat.** Commit-blind is frustrating for a nine-year-old. Lag is
displayed and taught in the lower tiers and never punishes; it takes the wheel
only in the higher ones.

## 1.5.4 Body maps are the missing rung, and the terminator is the fusion point

The deduction chain currently has a hole. System → body is a real choice. Body →
feature is *"click the only pin."* In Shutterbug the equivalent step — which city
on this continent — is the most satisfying part of the game. Here it does not yet
exist.

Real imagery plus more features is what makes that a step. Five consequences:

1. **Terrain becomes the clue.** A hard clue can describe what something *looks
   like* and you find it by reading the map. A different skill from recall, and
   the most genuinely "photo safari" thing in the game.
2. **The terminator — build this first.** A real map, plus the date, plus the
   body's rotation gives a day/night line, and **you cannot photograph the night
   side.** Arriving at the right place at the wrong local time becomes a failure.
   This is the piece that fuses everything: it takes the calendar we already have
   and makes it matter at the operational scale — the same scale where lag lives.
   The two mechanics reinforce each other.
3. **Sun angle for detail.** Low sun means long shadows and visible relief; local
   noon is flat and useless. Every real imaging campaign plans around this, so
   the best photograph is the right subject at the right sun angle — a scoring
   dimension rather than pass/fail.
4. **Seasons.** Martian dust-storm season, Saturn's rings going edge-on, polar
   caps growing and shrinking. All real, all on schedules the sim already knows.
5. **Instrument quality as progression.** A coarse plate at first; better optics
   reveal finer detail and unlock finer targets. Ties straight into Part 2.

And the structural payoff: **the body map is where the two halves of the game
meet.** It is the last rung of the kid-mode deduction *and* the siting board for
the strategy layer, where a base's location depends on real terrain, polar ice,
flat ground, and proximity to a resource. Real imagery pays for itself twice.

## 1.5.5 Revised build order

1. **The simulation layer** — clock, event queue, time controls, parallel craft.
   Everything hangs off it.
2. **Plates + terminator** — the cheapest way to make the new clock visibly
   matter.
3. **The gazetteer pipeline** — once we know what the game needs from content.
4. Commit-blind operations, as a higher-difficulty tier.

---

# Part 2 — Brainstorm: the fuller game

Not a build order. A map of where this can go, given that it has to stay
*one game that grows with the kids*.

## 2.1 The thesis

> **The geography IS the economy.**
>
> Every strategic decision in the full game should be a fact about the solar
> system wearing a costume.

That single constraint is what stops this becoming two games bolted together. If
a mechanic can't be traced back to a true thing about a real place, it doesn't go
in.

## 2.2 The facts that are already game mechanics

| True thing | What it becomes |
|---|---|
| **Water ice is everywhere but unevenly** — Ceres, Europa, Enceladus, Saturn's rings (nearly pure water ice), comets, permanently shadowed lunar polar craters | Water is propellant *and* air *and* drink *and* radiation shielding. One resource, four needs, geographically sorted. Half the economy comes free. |
| **Solar power falls off as 1/r²** | Solar works out to about Mars. Past that you need nuclear — and plutonium-238 is genuinely scarce enough to have cancelled real missions. The outer system depends on a supply chain from the inner. Trade routes, forced by physics. |
| **Delta-v ≠ distance** | Ceres is far and cheap; the Moon is near and expensive; Phobos and Deimos are the best fuel depots in the inner system. Value is not proximity. |
| **Gravity wells define politics** | Earth and Mars can *make* things; the Belt can *supply* things; the Belt is cheap to leave and expensive to invade. That's not fiction, that's the rocket equation. |
| **Volatiles are sorted by geography** | Nitrogen: Titan (its air is mostly N₂) and Triton. Methane: Titan's lakes. Metals: M-type asteroids. Each is a place you must *go* to. |
| **Jupiter's magnetosphere is lethal** | Io sits inside it; Callisto sits mostly outside. So Callisto, not Io, is where you can actually put people — which is exactly what NASA's own outer-planets study concluded. A siting decision that is a science fact. |
| **In space you overheat, you don't freeze** | Radiators are a module, and they're the surprise every player gets wrong first. |
| **Tidal locking, day length, eclipses** | Solar power schedules, comms windows, and timed events. |

## 2.3 Fuse the halves: the photo IS the prospecting

The most important structural idea in Part 2, and it should be decided early even
though it's built late:

**You cannot build at a place you have not photographed.**

Survey unlocks the site. Photograph Enceladus's tiger stripes → the plume becomes
a water source. Photograph Psyche → metals. Photograph a shadowed lunar crater →
polar ice.

This means **the kid mode's loop is literally the strategy game's tech tree**.
There's no bolt-on. A nine-year-old playing the photo game and a fourteen-year-old
playing the program game are pressing the same buttons for different reasons, and
the older one still has to go and look at things. That's how one game grows with
the kids.

## 2.4 Stations, kept legible

A station is a handful of **modules**, each solving one survival problem:

- **Spin** — gravity, or accept microgravity and take the bone-loss penalty
- **Shield** — mass (water or regolith) between the crew and the sky
- **Air** — a closed loop, plants, the CO₂ problem
- **Water** — recycling percentage; the loop is never 100%
- **Power** — solar array area, or a reactor
- **Heat** — radiators
- **Berth** — throughput, how much can come and go
- **Crew** — people, who eat and who have jobs

Every module has mass. Mass has to get there. Getting there costs delta-v.
Delta-v costs propellant. Propellant comes from ice. The loop closes on itself
and every link in it teaches something true.

**Hard design rule: never more than six to eight numbers on screen.** The
question a player asks should be *"do we have enough water?"*, not *"what's my
ISRU throughput coefficient?"* Legibility beats fidelity every single time, and
the moment this game needs a spreadsheet it has stopped being the game we chose
to build.

## 2.5 The *For All Mankind* layer — time and program

- **Play in decades, not days.** A mission takes years. The calendar *is* the
  game, which the transfer-window system already established in Part 1.
- **Missions are proposals.** Commit crew, mass, and a launch window years out —
  then live with the decision when the window arrives and the world has changed.
- **Named personnel who age.** Specialists, careers, retirements, losses. This is
  FAM's entire emotional engine and it costs almost nothing mechanically.
- **Generational stakes.** Kids born off Earth. The late reveal that the first
  person born on Mars can never safely visit Earth — their bones grew in a third
  of a gravity. Geography written onto a body.
- **Rival programs, not war.** For this audience the right conflict register is a
  *race*: reach a site first, or get second-place science. Competition with real
  stakes and nobody shooting.
- **Two campaigns, one map.** Start in 1969 with a different branch point, or
  start from the real present and go forward.

## 2.6 The *Expanse* layer — for when they're older

- **Three cultures, no villains.** Earth has mass and history. Mars has industry
  and ideology. The Belt has labour and scarcity. Every one of them is right
  about something.
- **The scarcity that bites is air and water, not money.**
- **Belters' bodies.** Grown in low g, unable to take a gravity well. The same
  fact as §2.5's Mars-born kids, told from underneath.
- **Trade with real transit times.** A shipment ordered is a shipment that
  arrives in eleven months, into a situation you can't predict.
- Keep it humane. The Expanse's better half is about *who gets to breathe*, not
  about shooting, and that half is entirely teachable to a twelve-year-old.

## 2.7 Mechanics that only exist because it's space

Worth listing, because these are free differentiation — none of them have an
Earth-geography equivalent:

1. **Light lag as the difficulty curve** (§1.6).
2. **The map's answer changes with the calendar** — transfer windows.
3. **Delta-v ≠ distance** — "far" and "hard" come apart.
4. **The sky is a clock** — you can tell the date from where the moons are.
5. **Eclipses and occultations** as scheduled, predictable events you can plan a
   shot around.
6. **Everything you photograph is somewhere no human has ever stood.**
7. **Scale you can feel** — a log-radius orrery that un-log-scales on demand, to
   show a kid exactly how much of the solar system is nothing.

## 2.8 Modes, extended

| Mode | Kid | Grown |
|---|---|---|
| **Assignments** | The photo safari | Contract survey work with a deadline |
| **Grand Tour** | Choose your own route | Optimise a real multi-flyby trajectory |
| **Freeflight** | Wander, no clock | Sandbox with the economy on |
| **Missions Flown** | Retrace Voyager 2, Apollo 8, Cassini | Same, plus "could you have done better?" |
| **Program** | — | Build a space program across decades |
| **Homecoming** | The review quiz, unchanged | Unchanged |

## 2.9 Risks, honestly

- **Scope is the whole risk.** Part 2 is three to five times Part 1. **Ship Part 1
  as a complete, finished game first**, and it must be genuinely fun with zero
  economy in it. If it isn't, the economy won't save it.
- **Planetary science moves.** Europa's plumes, Pluto's subsurface ocean, Venus's
  phosphine — all contested or revised within a decade. Hence the `confidence`
  field: *measured* / *inferred* / *hypothesis*, and **the card says which**.
  Shutterbug's `journeys.js` already invented `certainty` for exactly this reason
  (documented vs. traditional sites), so it's a proven pattern, not a new one.
- **The dynamic map contaminates everything.** Positions change, so nothing can be
  baked. Decide the position-caching and determinism story in phase 0.
- **The orrery must not become a screensaver.** It's beautiful and it will be
  tempting to animate it forever. The player has to see, at a glance, where
  everything is and what it costs to get there.
- **Non-NASA imagery licensing** (§1.2). One wrong assumption about an ESA image
  is one takedown.
- **Don't lose the camera.** The moment the economy is more interesting than
  going and looking at things, this stops being Shutterbug's descendant and
  becomes a worse version of a game that already exists.

---

## Naming

**Wanderer** is the lead — *planet* means "wanderer", so the title teaches the
concept before the game starts, and it fits a player who travels rather than
conquers. Alternatives: **Orrery**, **Long Light**, **Slow Light**, **Farside**,
**The Grand Tour**.
