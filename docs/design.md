# SOLBOUND

**A single-player economic strategy game set in the real solar system.**

You begin with one ship, some money, and an umbilical to Earth. You end as part
of the reason people can live out here at all.

> *Everything is bound to Sol.*

---

## 0. How to read this

This is the master design document. It supersedes `docs/design-survey-era.md`,
which described the photo-safari game this project started as; that document is
kept because the survey layer survives and its playtest findings are still
valid, but where the two disagree, **this one wins**.

Sections marked **BUILT** exist and are under test. Sections marked **GAP** are
the work. Sections marked **LATER** are deliberately deferred and should not be
started early, however tempting.

### Provenance

This design is the synthesis of three independent passes: the survey-era
document written against this codebase, a "DELTA-V" brief, and a "SOLBOUND"
brief — the latter two written without ever seeing the code.

All three independently arrived at: the real solar system as the board, delta-v
as the central cost, moving planets, learn-by-playing rather than by quizzing,
no manual piloting, time acceleration with meaningful windows, ISRU as the
keystone economic lesson, a pure simulation core separated from presentation,
seeded determinism, saves early, and scope as the project's mortal risk.

**Treat that convergence as settled.** It is not consensus by imitation; three
passes reached it separately. Do not relitigate it.

Where they differed, the calls made here are recorded in §12.

---

## 1. The central principle

> **Knowledge becomes capability.**
>
> information → decision → movement → risk → resources → capability → access to
> greater opportunities

This chain must hold identically in the first hour and the fiftieth. Early, it
is *"water is cheap here and dear there, and I can just afford the trip."* Late,
it is *"I understand why outer-system volatiles decide who can expand, so I am
building the infrastructure that decides it."* The numbers grow. The player's
agency grows. **The game underneath does not change.**

The second principle, which constrains every system:

> **The map is delta-v, not distance.**

How far apart two places are in kilometres barely matters. What matters is the
velocity change required to move between them, and when the geometry permits it
cheaply. Ceres is far and cheap to land on. Mercury is near and brutally
expensive. "Far" and "hard" are different words, and learning that is the single
most useful thing this game can teach.

---

## 2. Design pillars

1. **Delta-v is destiny.** Every decision is priced in velocity and timed by
   orbital geometry. The map *is* the physics.
2. **Reality is the optimal strategy.** The game never instructs. It makes
   sourcing propellant in space win, makes windows matter, makes the outer
   system dark and cold — so the player derives the lessons by trying to
   profit. Knowledge sticks because it is load-bearing.
3. **Model consequences, not processes.** We care that leaving a gravity well is
   expensive. We do not need the player to fly a multi-stage launch. We care
   that geometry changes opportunity. We do not need the player solving Lambert
   problems.
4. **You start alone and end as infrastructure.** One ship → a network. The
   scale of decisions grows because the player's organisation grows, not
   because the player is pretending to be a pilot and a government at once.
5. **Approachability is the differentiator.** The nearest existing game to this
   concept is Terra Invicta, which is widely described as one of the most
   opaque strategy games made. The unfilled niche is not "does this exist" but
   **"does an approachable version exist."** Hard constraint: *every system
   explicable in one sentence; no screen showing more than about eight numbers.*
6. **Honesty over spectacle.** Where the game simplifies, it simplifies legibly,
   and it says which of its claims are measured, abstracted, or speculative.
7. **Every milestone is fun by itself.** No "it'll be good once X lands."

---

## 3. The three loops

**Moment (seconds–minutes) — "commit to a trip."** See an opportunity, check
what the ship can actually reach, weigh leaving now against waiting for the
window, commit, advance time. *This is the atom of the game.* If it is not
enjoyable, nothing above it matters. **BUILT and playtested — the player went
both ways on the wait-vs-go decision, which is the only evidence that a choice
mechanic works.**

**Session (30–90 min) — "close a loop."** Prospect a body, stand up extraction,
refine, run a route that pays for itself or feeds a build, reinvest. A session
ends when something is self-sustaining that was not before.

**Campaign (many sessions) — "become infrastructure."** Expand from cislunar
space outward. Each frontier is a step change in energy and delta-v; sunlight
falls as 1/r², so past Mars solar power stops being an option and the outer
system gates itself naturally. Ends when the umbilical to Earth is severed —
see §5.

---

## 4. The player arc

```
ship operator → ship owner → small commercial operator → multi-ship enterprise
→ industrial concern → fleet operator → infrastructure developer
→ participant in a solar civilisation
```

This arc is the answer to a question the earlier drafts struggled with: how does
one game serve both a child and a systems player? **It does not need two modes.
The difficulty ramp and the fantasy are the same curve.** A young player starts
where everyone starts, with one ship and one decision, and stops climbing
wherever they like. Nothing is hidden behind a mode select.

---

## 5. The economy: dependency, not arbitrage

**This is the most important amendment to the source briefs, and it makes the
game better rather than merely more accurate.**

Classic trading games run on speculation — buy low, haul, sell high. That
assumes transport is cheap enough for price differences to beat it. At 5.6 km/s
and eight months to Mars, with roughly 72% of the departing vehicle being
propellant, **that is false for essentially every bulk commodity.** A game
committed to honest physics cannot also run on interplanetary arbitrage in ore.

The honest version is stronger:

> What actually crosses the solar system is **high value per kilogram and
> impossible to make locally** — electronics, pharmaceuticals, reactor parts,
> precision instruments, seed industrial tooling. Everything heavy must be made
> where it is used, or it does not happen at all.

So the early game is **running the umbilical**: colonies cannot survive without
imports, and you are the supply line. And the campaign is about **severing it**.
Every production chain you stand up is one fewer thing that must be shipped.

That reframes the whole game:
- **Trade is a symptom of dependency, and the win is curing it.** ISRU stops
  being a tech unlock and becomes the victory condition.
- It teaches the actual economics of spaceflight instead of a shopkeeping
  fantasy dressed in spacesuits.
- It gives the campaign a shape: the map starts with one arrow pointing outward
  from Earth and ends as a web that does not need Earth.

Speculation survives as spice, not spine — and it is powered by physics rather
than by a random-number generator (see §7).

**Markets** track production, consumption, inventory, storage, base price,
current price, and import dependency. Prices respond to supply and demand with
**damping and bounds from the first commit** — emergent economies love to
hyperinflate or collapse, and retrofitting stability is far harder than building
it in.

**Events are systemic, never arbitrary.** Not *"random event: −100 credits"*
but *"a refinery failed at Ceres; refined-metal prices are climbing and
construction has stalled."* The consequences should be derivable by a player who
understands the system, which is exactly the reward loop we want.

---

## 6. Geography produces economics

Locations matter because of what they physically are. Resource families map to
real bodies:

| Resource | Where | Why it decides things |
|---|---|---|
| **Water ice** | Lunar polar shadows, C-type asteroids, Ceres, comets, outer moons | Propellant, air, drinking water, radiation shielding. One resource, four needs. The keystone. |
| **Metals & regolith** | M-type asteroids, Luna, Mars | Structure, parts, solar cells. Bulk industry — must be made locally. |
| **Volatiles** (CO₂, N₂, CH₄) | Mars, Titan, Triton | Life support, propellant feedstock, chemistry. Titan's air is mostly nitrogen. |
| **Sunlight** | Falls as 1/r² | ~1/27th of Earth's at Jupiter, ~1/90th at Saturn. Past Mars you need fission. This gates the outer system by itself. |

Facts that are already game mechanics, needing no invention:

- **Delta-v ≠ distance.** Ceres is further than the Moon and cheaper to leave.
  Phobos and Deimos are the best depots in the inner system because they have
  almost no gravity well.
- **Aerobraking is free braking.** Mars, Venus and Titan are cheaper to arrive
  at than airless bodies of similar depth.
- **Jupiter's magnetosphere is lethal.** Io sits inside it; Callisto mostly
  outside. That single fact decides where people can live in that system.
- **You overheat in space, you do not freeze.** Radiators are a module, and the
  surprise every player gets wrong first.
- **Nothing recycles at 100%.** The shortfall is the true cost of keeping
  someone alive, and it compounds with distance.

---

## 7. Information is a resource — and it travels at light speed

Market data does not arrive instantly. It propagates at *c*, which this codebase
already computes: about 6 minutes round trip to Mars at closest approach, over
an hour to Jupiter, more than eight hours to Pluto.

Consequences that cost nothing to implement and change everything:

- A price you are looking at from the outer system is **months stale**. Acting
  on it is a bet, not a calculation.
- **This is where speculation legitimately lives.** You are not outsmarting a
  shopkeeper; you are betting that a shortage you heard about eight months ago
  has not been solved yet.
- Better relay infrastructure is a purchasable advantage — buying *fresher
  information* is a genuinely novel upgrade path.
- The difficulty curve is the speed of light rather than a knob we invented, and
  the emotional arc — the further out you go, the more alone you are — comes
  free with it.

Partially **BUILT**: `lightTimeSeconds()` and `askEarthHours()` exist and are
tested. **GAP**: nothing consumes them economically yet.

---

## 8. Ships

Hulls impose physical constraints; modules provide capability. The player's ship
should feel like *theirs*, without the game becoming a fitting spreadsheet.

Meaningful choices: more cargo or more propellant · efficiency or thrust · armour
or payload · mining gear or hold space · laboratory or passenger cabins · guns or
range. Avoid `ENGINE II: +20% SPEED`; every module should trade something away.

**Propulsion is under the hood, never a design screen.** `propulsion.js`
computes mass ratios, propellant fractions and payload fractions — that is
*engine*. What the player sees is a consequence:

> *Freighter — reaches Mars with 40 t of cargo. Cannot reach Jupiter.*

...with the underlying fact available when it is interesting (*"72% of this ship
is propellant"*), as an explanation, never a dial. This is the "bird's-eye, not
design-your-own-rocket" line, and it is a hard boundary.

### The propulsion eras — the campaign's real spine

Unlike a conventional tech tree, **each era redraws the map rather than
adjusting numbers on it.** This is the thing no comparable game does, and the
campaign should be built around it.

| Era | Drive | What changes |
|---|---|---|
| **Chemical** | Methalox, hydrolox | You are a slave to synodic windows. Brutal mass ratios. |
| **Nuclear thermal** | NERVA-class | Double the exhaust velocity. Impossible trips become merely hard. |
| **Nuclear electric** | Ion | No impulsive burn at all — you spiral. **Windows stop mattering.** |
| **Fusion torch** | *speculative* | Brachistochrone. Days, not years. |

**BUILT** and tested, including the honesty: everything through nuclear electric
is flown or engineered in detail today. The torch drive is not, and the game
says why rather than hiding it — 1 g across 1 AU costs ~2,400 km/s, demanding a
mass ratio around 10¹⁰ even at generous assumptions. That is not an engineering
gap, it is an impossibility, which is why every story with a torch drive quietly
invents new physics. The model shows the player that blow-up.

---

## 9. Rivals

**The largest single gap.** Today there is no opposition; the game is a builder.
The player should feel, from the mid-game onward, that *someone else is out
there* — competing, occasionally threatening, always moving.

Rivals should press from several directions, not one:

- **Commercially.** They bid against you on contracts, undercut your routes,
  and buy out supply before you arrive. Losing a contract to a name you
  recognise is the cheapest form of pressure and the first to build.
- **Territorially.** They claim sites. Prospecting a body and finding a rival
  already there is a real loss, and it makes survey work urgent rather than
  leisurely.
- **Politically.** Tariffs, docking rights, licensing. A faction that dislikes
  you makes whole regions expensive rather than closed — pressure without walls.
- **Physically.** Piracy against your routes; blockade of chokepoints. See §10.

Three or four named organisations with asymmetric strengths — a national
programme, a corporation, an independent settlement bloc, a research consortium
— each good at something different, so their pressure feels distinct.

**Deliberately deferred to mid-game.** Competent AI is a large build and easy to
get wrong; the trading floor is small and immediately testable. Rivals arrive
around the multi-ship threshold, when there is something worth contesting. But
the data model should carry an owner from the beginning so nothing needs
retrofitting.

**Their behaviour must be physically constrained.** A rival cannot reinforce a
depot faster than a transfer window allows, and the player should be able to
*see that coming*. Opposition that obeys the same physics is opposition the
player can outthink, which is the whole point.

---

## 10. Combat: get the contract right, build the tactics later

Combat matters but must never eat the game. It is the dangerous consequence of
strategic choices, not an interruption every few minutes.

**The architectural insight that makes this safe:**

> Combat resolution is a **pure function** — `resolve(attacker, defender,
> context) → outcome`. Auto-battle calls it and reports. A tactical mini-game,
> whenever it is built, becomes an interactive way of *playing out that same
> call*, with player decisions perturbing its inputs. Same contract in, same
> consequences out.

This is the identical separation that makes the orbital maths testable. Get the
*interface* right in the auto-resolve version and the tactical layer is
**additive rather than a rewrite** — which is what turns a known content black
hole into an optional module that can be built whenever it is wanted.

What must be true of the interface from day one, because it is what gives a
fight weight:

- **Inputs carry the choices that led here.** Escort composition, whether you
  took the fast expensive trajectory or the cheap slow one, crew quality,
  maintenance state, whether you paid for point defence, how fresh your
  intelligence was.
- **Outputs carry consequences that matter afterwards.** Not win/lose but:
  which subsystems are damaged, what cargo survived, casualties, propellant
  spent evading, how long repairs take and where they can be done, reputation
  movement, whether the route is now considered dangerous.

**Why the physics makes it interesting** — and why it needs no dogfighting: you
cannot fly at an enemy, you must *match orbits*, which costs about as much
delta-v as the journey. So deep-space piracy is economically stupid and
interception happens near ports, where rendezvous is cheap. **Control is
logistical, not territorial** — you cannot blockade the Belt, it is diffuse and
cheap to leave, but whoever holds the depots and the chokepoints holds
everything. That falls directly out of the rocket equation.

**Phase one:** abstract — fight, evade, surrender, negotiate; statistics and
fittings decide it. **Phase two (LATER):** small, readable, turn-based or
pausable engagements of a handful of ships, with subsystem damage and escort
roles. One freighter and two escorts against three raiders is already a real
tactical situation. No capital-ship fleets.

---

## 11. What exists today — gap analysis

The MVP target is: *market → cargo → transfer → travel → arrival → sale →
progression*, on a living orbital map, with saves.

**Roughly half of it is built, and it is the expensive half.** 83 tests passing
across 6 files.

### BUILT

| System | State |
|---|---|
| **Ephemeris** | Real JPL Keplerian elements, all 8 planets + Pluto. Validated against three published opposition dates to 0.22–0.30°, which is the half-day slop from testing dates published to the day. |
| **Transfers** | Hohmann Δv, flight times, phase angles, synodic periods. Reproduces published Earth→Mars figures (259 days, 44°, 5.6 km/s). Real launch windows found by stepping the real ephemeris, so consecutive Mars windows genuinely differ. |
| **Trajectory rendering** | Ships fly the true transfer ellipse, Kepler-solved. Test pins two invariants a straight-line fake would fail: exactly 180° of longitude swept, and visibly faster near the Sun. |
| **Simulation core** | World clock, derived event queue, fleet with independent scheduled departures and arrivals, five time rates, skip-to-next-event, auto-pause on arrival. Pure functions, never mutating. |
| **Propulsion** | Rocket equation, five drives, four eras, feasibility assessment, brachistochrone and spiral models. |
| **Illumination** | Real solar day lengths, seasons from real axial tilt, terminator, sun angle, polar night. Retrograde rotators handled. Render and gameplay paths tested in agreement. |
| **Determinism** | One swappable RNG; `withSeed()` restores even when its body throws. |
| **Three-level map** | Orrery → system → body, with four real public-domain USGS/NASA plates and a fetch pipeline that checks projection and records licences. |
| **Survey layer** | Clue-driven photographic assignments — see §13. |

### GAP — the work, in order

1. **Money, cargo, markets, buy/sell.** The entire economic layer. Nothing
   exists.
2. **Save/load.** Nothing persists. Must not be deferred — the simulation is
   already interconnected enough that retrofitting will hurt.
3. **Ship hulls, modules, fitting.** One hard-coded ship type today.
4. **Sites and stations.** Bodies exist; *places on them you can dock at, trade
   with and build on* do not.
5. **Production chains and ISRU.**
6. **Missions and contracts.**
7. **Rivals** (§9).
8. **Infrastructure** — depots, refineries, shipyards.
9. **Combat**, abstract first (§10).

### Known debt

- **Content is a draft.** The 18 hand-written features carry facts written from
  memory. A visible notice says so in the app. They must be regenerated from
  primary sources before anyone learns from them.
- **`DELTA_V_FROM_LEO` is invented** — labelled in code as "ordering, not
  quotes". For an economy game the delta-v map *is* the map; it needs real
  sourced edges. **Both external briefs independently flagged this.**
- **Ephemeris horizon is 2050.** Standish Table 1 is valid 1800–2050, and the
  campaign's end date is currently a data limit dressed as a game rule. A
  multi-century arc needs the 3000 BC–3000 AD tables and their correction terms.
- **Rotational phase is not epoch-anchored.** Day *length* and *season* are
  real; which meridian faces the Sun on a given date is not. The game may teach
  the former and must not claim the latter.

---

## 12. Decisions made, and what they cost

| Question | Call | Trade |
|---|---|---|
| Lead loop | **Space Trader floor first** — one ship, one market pair, one decision | Slower to the 4X fantasy; far faster to something testable |
| Rivals | **Mid-game, pressing from four angles** (§9) | No opposition in the early hours; buys a shippable game much sooner |
| Trade model | **Dependency, not arbitrage** (§5) | Loses the shopkeeper fantasy; gains the real economics and a campaign shape |
| Combat | **Pure-function resolution, auto first, tactics later** (§10) | No spectacle early; makes the tactical layer additive rather than a rewrite |
| Pacing | **Advance-to-next-decision**, continuous time underneath | Not literally turn-based. At a one-month turn an Earth→Jupiter transfer is 32 empty turns — turn-based renames the waiting problem rather than solving it. Keeping orbits animated preserves the lesson: watching Earth catch Mars *teaches* the synodic period. |
| Renderer | **Keep SVG/React** | Canvas/Pixi was proposed by an external brief; it has no DOM nodes, so no focus, no ARIA, no keyboard, no screen reader. We have dozens of objects, not thousands. Accessibility beats sprite throughput here. |
| Physics | **Patched-conic / analytic Kepler** | No Lagrange points or perturbations. Unanimous across all three briefs. |
| Interstellar | **Sol only; do not preclude it** | Location hierarchy stays `system → body → site` so it is not architecturally impossible later. |

**Naming.** The game is **SOLBOUND**. The repository, package and deployed URL
remain `wanderer` for now — renaming breaks a live public link and gains nothing
today. Migrate when there is a reason to.

---

## 13. The survey layer keeps its place

The photographic survey game is **built, playable, and stays** — as the opening
hours and as the prospecting mechanic.

> **You cannot build where you have not surveyed.**

Imaging reveals slope and landing hazard; spectroscopy identifies volatiles and
ore; thermal mapping finds the shadowed cold traps where ice survives; repeat
imaging over time reveals activity. The light-angle mechanic already built stops
being a scoring flourish and becomes an instrument constraint — a raking sun
shows relief, an overhead sun washes it flat, exactly as real imaging campaigns
plan for.

That makes the earliest, gentlest loop in the game *also* the tech tree of the
latest one. Nothing is a throwaway tutorial.

---

## 14. Scope control

Ask of every proposed feature:

1. Does it deepen travel, trade, risk, ship capability, geographic
   understanding, or economic development?
2. Does the player make an **interesting decision** because of it? If it only
   adds bookkeeping, simplify it.
3. Could the same strategic consequence come from a simpler simulation? Then use
   the simpler one.
4. Does it teach something **by affecting play**? Then it is especially
   valuable.

**Cut or defer without hesitation:** N-body physics, manual piloting,
multiplayer, deep faction politics, individual crew relationships, capital-ship
fleet battles, He-3 fusion economics, interstellar travel.

---

## 15. Risks

- **Scope is the mortal risk, not technology.** Taken maximally this is an
  EVE + KSP + Civ hybrid — hundreds of person-years. The only way it ships is
  the vertical-slice ladder, and treating the first three slices as *the game*.
- **The economy will misbehave.** Supply/demand loops collapse or hyperinflate.
  Damping and bounds go in with the first market, not later.
- **Combat can eat the project.** Holding it as a pure resolution function with
  an optional front-end is the scope defence. Hold that line.
- **Rivals can become unfair rather than hard.** They must obey the same physics
  and the same information lag the player does. An opponent that teleports
  reinforcements is not difficulty, it is a bug with a personality.
- **Complexity can strangle it.** The niche is *approachable*. If a screen needs
  a spreadsheet, we have lost the thing that differentiates this from the game
  that already exists.
- **Accuracy debt is a real liability** in something a child might learn from.
  See §16.

---

## 16. Accuracy policy

Three categories, and the game says which is which:

- **Fact** — measured or established. Orbital elements, day lengths, delta-v
  edges, resource presence. Sourced, tested where testable, never invented.
- **Abstraction** — a game system standing in for a real process. Refining
  recipes, price models, extraction rates, combat resolution. Honest about being
  tuned for play.
- **Speculation** — invented futures. Settlement scale, fusion drives, any
  22nd-century politics. Labelled, so "educational" never becomes "misleading".

Never invent a number casually. If it cannot be sourced, it is speculation and
must be marked as such.

---

## 17. Immediate roadmap

**Now — the economic floor.** Money, cargo, a handful of sites with markets,
buy/sell, and save/load. Small geography to start: Earth orbit, Luna, and one
more. Answers the only question that matters yet: *is committing to a trip under
real constraints enjoyable?*

**Then, in order:** ship hulls and fitting → production chains and ISRU →
missions and contracts → rivals → infrastructure → abstract combat → outer
system → tactical combat module.

**In parallel, whenever convenient:** the real delta-v graph, the 3000 AD
ephemeris tables, and regenerating the content from primary sources.
