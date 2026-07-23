// ===========================================================================
// SITES — the places you can actually dock, trade and eventually build.
//
// A body is a world. A SITE is somewhere on or above it with people, a market
// and a reason to exist. Bodies are astronomy; sites are economics.
//
// WHAT EACH SITE'S ECONOMY IS DERIVED FROM, not decorated with:
//   `produces`   what local geography and industry actually yield
//   `consumes`   what the population and industry actually need
//   `makes`      the tiers it can manufacture — this is the dependency ladder
//
// A site that consumes what it cannot make is DEPENDENT, and that dependency is
// the trade route. Severing it is the campaign (docs/design.md §5). So these
// lists are not flavour: `produces` minus `consumes` IS the market, and the
// tiers in `makes` decide what must be imported forever until someone builds a
// factory.
//
// ⚠ SPECULATION, AND LABELLED AS SUCH (design.md §16). No permanent settlement
// exists anywhere but low Earth orbit. Populations, station names and industrial
// capacity here are invented for play. What is NOT invented is WHY each site
// sits where it does — every location is chosen for a real physical reason,
// recorded in `why`, and those reasons are the teaching content.
// ===========================================================================

export const SITES = [
  // ---- EARTH SYSTEM -----------------------------------------------------
  {
    id: "leo", name: "Gateway Station", body: "earth", system: "earth",
    kind: "orbital", population: 400, owner: "consortium",
    why: "Low Earth orbit: the top of the deepest gravity well anyone routinely climbs. "
       + "Everything from Earth passes through here, which is exactly why it is expensive.",
    produces: [],
    consumes: ["food", "lifesupport", "propellant"],
    makes: ["advanced", "industrial", "refined"],   // Earth's industry, one lift away
    imports: [],
    dvFromEarth: 0,
    note: "Your home port. Everything is available and nothing is cheap.",
  },
  {
    id: "shackleton", name: "Shackleton Base", body: "luna", system: "earth",
    kind: "surface", population: 90, owner: "consortium",
    why: "The lunar south pole. Crater floors here have not seen sunlight in two billion years, "
       + "so water ice survives in them — while the crater RIM gets almost continuous sun for power. "
       + "Ice and sunlight within a few miles of each other is why this specific spot matters.",
    produces: ["ice", "regolith", "propellant"],
    consumes: ["food", "machinery", "electronics", "medical"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "medical", "food"],
    dvFromEarth: 5.9,
    note: "Propellant made at the top of a shallow well. This is what changes the map.",
  },

  // ---- MARS SYSTEM ------------------------------------------------------
  {
    id: "phobos-depot", name: "Phobos Depot", body: "phobos", system: "mars",
    kind: "orbital", population: 25, owner: "corporate",
    why: "Phobos has effectively no gravity well — you land and leave for almost nothing. "
       + "That makes it the cheapest place in the Mars system to keep fuel, and possibly "
       + "the best depot in the inner solar system.",
    produces: ["ice", "propellant"],
    consumes: ["food", "lifesupport", "machinery", "electronics"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "food", "medical"],
    dvFromEarth: 4.3,
    note: "Cheaper to reach than the Moon's surface, and cheaper still to leave.",
  },
  {
    id: "jezero-station", name: "Jezero Station", body: "mars", system: "mars",
    kind: "surface", population: 210, owner: "agency",
    why: "Beside a dried river delta, where water once pooled. Subsurface ice, clay minerals, "
       + "and an atmosphere that is 95% CO₂ — which a machine can turn into oxygen and methane. "
       + "Mars is the only place off Earth where a colony can make its own fuel from the air.",
    produces: ["volatiles", "ice", "regolith", "food"],
    consumes: ["machinery", "electronics", "reactorparts", "medical", "parts"],
    makes: ["refined", "industrial"],
    imports: ["electronics", "reactorparts", "medical", "instruments"],
    dvFromEarth: 4.6,
    note: "Can feed itself and fuel itself. Cannot yet build itself.",
  },

  // ---- THE BELT ---------------------------------------------------------
  {
    id: "ceres-port", name: "Ceres Port", body: "ceres", system: "belt",
    kind: "surface", population: 140, owner: "independent",
    why: "Ceres is roughly a quarter water by mass and its escape velocity is about 510 m/s — "
       + "you can practically walk off it. Far from the Sun, and yet cheaper to land on and "
       + "leave than our own Moon. 'Far' and 'hard' are different words, and Ceres is the proof.",
    produces: ["ice", "propellant", "ore", "volatiles"],
    consumes: ["food", "machinery", "electronics", "medical", "reactorparts"],
    makes: ["refined"],
    imports: ["electronics", "machinery", "medical", "reactorparts", "food"],
    dvFromEarth: 5.0,
    note: "The water tower of the solar system, and almost free to leave.",
  },
  {
    id: "psyche-works", name: "Psyche Works", body: "psyche", system: "belt",
    kind: "surface", population: 60, owner: "corporate",
    why: "An asteroid that appears to be largely exposed metal — possibly the stripped core of "
       + "a shattered protoplanet. Iron and nickel at the surface, no digging required.",
    produces: ["ore", "metal", "regolith"],
    consumes: ["food", "lifesupport", "electronics", "medical", "propellant"],
    makes: ["refined"],
    imports: ["food", "lifesupport", "electronics", "medical"],
    dvFromEarth: 5.6,
    note: "Metal in quantity, and nothing else at all. Everything a person needs is imported.",
  },

  // ---- JUPITER SYSTEM ---------------------------------------------------
  {
    id: "callisto-station", name: "Callisto Station", body: "callisto", system: "jupiter",
    kind: "surface", population: 45, owner: "agency",
    why: "The only Galilean moon far enough out to sit mostly clear of Jupiter's radiation belt. "
       + "Io is bathed in a dose that would kill a person in a day; Callisto is survivable. "
       + "That single fact is why crewed-Jupiter studies keep choosing this moon and no other.",
    produces: ["ice", "propellant", "regolith"],
    consumes: ["food", "lifesupport", "electronics", "reactorparts", "medical", "machinery"],
    makes: ["refined"],
    imports: ["food", "electronics", "reactorparts", "medical", "machinery", "instruments"],
    dvFromEarth: 7.5,
    note: "Sunlight here is 1/27th of Earth's. Everything runs on imported reactors.",
  },
];

export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]));
export const sitesOnBody = (bodyId) => SITES.filter((s) => s.body === bodyId);
export const sitesInSystem = (systemId) => SITES.filter((s) => s.system === systemId);

export const OWNERS = {
  consortium:  { name: "Orbital Consortium", note: "The Earth-side partnership that runs the lift." },
  agency:      { name: "Joint Agency",       note: "Public science and exploration, slow and thorough." },
  corporate:   { name: "Kestrel Industrial", note: "Extraction and logistics, and no patience at all." },
  independent: { name: "Independent",        note: "Settled by the people who work there." },
};
