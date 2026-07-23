// ===========================================================================
// BODIES — the board. Systems (the "continents") and the worlds inside them.
//
// Project rule 1 carries over from Shutterbug unchanged: all content lives in
// src/data/, never inline in a component. Components render this generically.
//
// ⚠ SPIKE CONTENT. These numbers are the well-published textbook values and are
// right to the precision the game shows, but they have NOT yet been checked
// one-by-one against a primary source, which project rule 2 requires before any
// of it ships to a child. The authorities to check against:
//   • moon orbits + radii — https://ssd.jpl.nasa.gov/sats/elem/  and  /sats/phys_par/
//   • planet physical data — https://ssd.jpl.nasa.gov/planets/phys_par.html
//   • feature names + coordinates — the IAU Gazetteer (see features.js)
// ===========================================================================

// ---------------------------------------------------------------------------
// SYSTEMS — the eleven "continents" of the game.
//
// `ephemerisKey` links to src/ephemeris.js. The two belts have no ephemeris of
// their own; they are drawn as annuli at a representative radius, because that
// is honestly what they are — a region, not a place.
// ---------------------------------------------------------------------------
export const SYSTEMS = [
  {
    id: "sun", name: "The Sun", kind: "star", ephemerisKey: null, auHint: 0,
    color: "#F2B441", radiusKm: 695700,
    blurb: "The only star we can visit. Everything else here is falling around it.",
  },
  {
    id: "mercury", name: "Mercury", kind: "planet", ephemerisKey: "mercury",
    color: "#A8998A", radiusKm: 2439.7, moons: 0,
    blurb: "Close, and therefore expensive: to reach it you must fall a long way down the Sun's gravity well and then stop.",
  },
  {
    id: "venus", name: "Venus", kind: "planet", ephemerisKey: "venus",
    color: "#D9A441", radiusKm: 6051.8, moons: 0,
    blurb: "Earth's twin in size, and nothing like it. Almost every named feature honours a woman.",
  },
  {
    id: "earth", name: "Earth", kind: "planet", ephemerisKey: "earth",
    color: "#3E8FB0", radiusKm: 6371.0, moons: 1,
    blurb: "Home, and the place every message from your mentor starts its journey.",
  },
  {
    id: "mars", name: "Mars", kind: "planet", ephemerisKey: "mars",
    color: "#C1542A", radiusKm: 3389.5, moons: 2,
    blurb: "The tallest volcano and the longest canyon in the solar system are both here.",
  },
  {
    // The belt is a region, but a destination needs a position — so it travels
    // as its largest member. Ceres is 25% of the belt's entire mass, so this is
    // less of a fudge than it looks.
    id: "belt", name: "The Asteroid Belt", kind: "belt", ephemerisKey: "ceres", auHint: 2.77,
    color: "#8A8073", radiusKm: 473,
    blurb: "Not a crowded field of rocks. Millions of objects, and so far apart that spacecraft cross without aiming.",
  },
  {
    id: "jupiter", name: "Jupiter", kind: "planet", ephemerisKey: "jupiter",
    color: "#C9A06B", radiusKm: 69911, moons: 95,
    blurb: "A storm wider than Earth, and a radiation belt that decides where people could ever live.",
  },
  {
    id: "saturn", name: "Saturn", kind: "planet", ephemerisKey: "saturn",
    color: "#D8C08A", radiusKm: 58232, moons: 146,
    blurb: "Rings of nearly pure water ice — which is to say, of drinking water, air, and rocket fuel.",
  },
  {
    id: "uranus", name: "Uranus", kind: "planet", ephemerisKey: "uranus",
    color: "#8FC4C9", radiusKm: 25362, moons: 28,
    blurb: "Tipped on its side. Its moons are named for Shakespeare and Alexander Pope.",
  },
  {
    id: "neptune", name: "Neptune", kind: "planet", ephemerisKey: "neptune",
    color: "#4A6FBF", radiusKm: 24622, moons: 16,
    blurb: "The last planet, and the windiest. Triton orbits it backwards.",
  },
  {
    id: "pluto", name: "Pluto", kind: "dwarf", ephemerisKey: "pluto",
    color: "#C2A98F", radiusKm: 1188.3, moons: 5,
    blurb: "A heart-shaped plain of frozen nitrogen, mapped by a piano-sized camera in 2015.",
  },
  {
    id: "kuiper", name: "The Kuiper Belt", kind: "belt", ephemerisKey: null, auHint: 45,
    color: "#6E7A8A", radiusKm: null,
    blurb: "Where the short-period comets come from, and where the solar system stops being a map and starts being a rumour.",
  },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// MOONS — the "country" layer. Simplified to circular orbits: a real semi-major
// axis and a real sidereal period, with the moon placed by mean motion.
//
// That is the honest simplification. What it gets right is what the game reads:
// relative spacing, relative speed, who is where when, and the resonances you
// can see (Io goes round exactly twice for each Europa orbit, and four times for
// each Ganymede orbit — visible on the system view, and true).
// What it drops — eccentricity, inclination, precession — never surfaces.
//
// `epochLon` is the mean longitude at J2000.0. Set to 0 for the spike: the
// moons' PHASES are not yet real, only their periods and spacings. That is a
// content task, flagged in docs/design.md, and it matters for eclipse clues.
// ---------------------------------------------------------------------------
const moon = (id, name, aKm, periodDays, radiusKm, note) =>
  ({ id, name, aKm, periodDays, radiusKm, epochLon: 0, note });

// Belt bodies. Not moons, but they occupy the same layer of the game's ladder —
// things you visit inside a system. Their orbits are heliocentric and close
// enough to each other that the system view can place them schematically.
export const BELT_BODIES = [
  { id: "ceres", name: "Ceres", aAU: 2.769, radiusKm: 473,
    note: "A dwarf planet, roughly a quarter water by mass. Escape velocity about 510 m/s — you could nearly jump off it." },
  { id: "psyche", name: "Psyche", aAU: 2.923, radiusKm: 111,
    note: "Apparently a largely metallic body: possibly the stripped core of a shattered protoplanet." },
  { id: "vesta", name: "Vesta", aAU: 2.362, radiusKm: 262.7,
    note: "Dry, rocky and differentiated — a survivor of the early solar system with a basaltic crust." },
];

export const MOONS = {
  earth: [
    moon("luna", "The Moon", 384400, 27.3217, 1737.4,
      "The only other world people have stood on."),
  ],
  mars: [
    moon("phobos", "Phobos", 9376, 0.31891, 11.27,
      "Orbits faster than Mars turns, so it rises in the west. The cheapest fuel depot in the inner system."),
    moon("deimos", "Deimos", 23463, 1.26244, 6.2,
      "So small that a hard jump would put you into orbit."),
  ],
  jupiter: [
    moon("io", "Io", 421700, 1.769138, 1821.6,
      "The most volcanically active world we know — and deep inside Jupiter's killing radiation."),
    moon("europa", "Europa", 671034, 3.551181, 1560.8,
      "A shell of ice over a salt ocean with more liquid water than all of Earth's."),
    moon("ganymede", "Ganymede", 1070412, 7.154553, 2634.1,
      "Larger than Mercury, and the only moon with a magnetic field of its own."),
    moon("callisto", "Callisto", 1882709, 16.689018, 2410.3,
      "Far enough out to sit mostly clear of the radiation belt — which is why studies of a crewed Jupiter base keep choosing it."),
  ],
  saturn: [
    moon("mimas", "Mimas", 185539, 0.942422, 198.2,
      "Herschel crater is a third of the moon's width. The impact nearly split it."),
    moon("enceladus", "Enceladus", 237948, 1.370218, 252.1,
      "Vents water into space through cracks named for the Arabian Nights."),
    moon("tethys", "Tethys", 294619, 1.887802, 531.1, "Nearly pure water ice."),
    moon("dione", "Dione", 377396, 2.736915, 561.4, "Ice cliffs, mistaken for wisps until Cassini looked closely."),
    moon("rhea", "Rhea", 527108, 4.518212, 763.8, "Saturn's second largest, and all but airless."),
    moon("titan", "Titan", 1221870, 15.945421, 2574.7,
      "Thick nitrogen air, rivers and seas of liquid methane, and the only other world where rain falls onto a surface."),
    moon("iapetus", "Iapetus", 3560820, 79.3215, 734.5,
      "One hemisphere is bright ice, the other nearly black. It took 300 years to explain."),
  ],
  uranus: [
    moon("miranda", "Miranda", 129900, 1.413479, 235.8,
      "Looks assembled from mismatched pieces. Carries Verona Rupes, the tallest known cliff anywhere."),
    moon("ariel", "Ariel", 190900, 2.520379, 578.9, "The brightest of Uranus's moons."),
    moon("umbriel", "Umbriel", 266000, 4.144177, 584.7, "And the darkest."),
    moon("titania", "Titania", 436300, 8.705872, 788.9, "The largest, named for Shakespeare's fairy queen."),
    moon("oberon", "Oberon", 583500, 13.463239, 761.4, "Scarred and old, out at the edge."),
  ],
  neptune: [
    moon("triton", "Triton", 354759, 5.876854, 1353.4,
      "Orbits backwards, so it was captured, not born here. Geysers of nitrogen erupt from it at 38 K."),
  ],
  pluto: [
    moon("charon", "Charon", 19591, 6.3872, 606,
      "Half Pluto's width. The two are tidally locked to each other — each hangs motionless in the other's sky."),
  ],
};

// ---------------------------------------------------------------------------
// DELTA-V — the cost of going, in km/s from low Earth orbit.
//
// ⚠ THESE ARE ORDERING, NOT QUOTES. They are approximate figures of the kind
// found on standard delta-v maps, included to prove the mechanic. Before this
// ships, each needs a real citation, and the game should never print them to
// three digits as if they were exact.
//
// The lesson they carry IS right, and it is the point of the whole resource
// system: **"far" and "hard" are different words.** Ceres is four times as far
// from the Sun as the Moon is from Earth, and cheaper to land on. Mercury is the
// nearest planet to us for most of the year and the most expensive place in the
// inner system to stop at, because getting there means falling down the Sun's
// well and then having to kill all that speed.
// ---------------------------------------------------------------------------
export const DELTA_V_FROM_LEO = {
  luna: { orbit: 4.1, land: 5.9 },
  mercury: { orbit: 13.2, land: 13.5, note: "Deep in the Sun's well. The most expensive rock in the inner system." },
  venus: { orbit: 3.5, land: 4.0, note: "Cheap to reach: its thick air will do the braking for you." },
  mars: { orbit: 3.8, land: 4.6, note: "Aerobraking makes it cheaper to land on Mars than on our own Moon." },
  phobos: { orbit: 4.3, land: 4.3, note: "Effectively no gravity well. Land and leave for almost nothing." },
  deimos: { orbit: 4.4, land: 4.4 },
  ceres: { orbit: 4.9, land: 5.0, note: "Further than Mars, and easier to leave than the Moon." },
  jupiter: { orbit: 6.3, land: null },
  callisto: { orbit: 6.9, land: 7.5 },
  europa: { orbit: 7.4, land: 9.7, note: "The last stretch is expensive, and the radiation is worse." },
  saturn: { orbit: 7.3, land: null },
  titan: { orbit: 7.6, land: 7.6, note: "Thick air and low gravity: the easiest landing in the outer system." },
  enceladus: { orbit: 8.0, land: 8.2 },
  uranus: { orbit: 8.0, land: null },
  neptune: { orbit: 8.5, land: null },
  triton: { orbit: 8.9, land: 9.2 },
  pluto: { orbit: 9.2, land: 9.4, note: "Flying past is cheap. Stopping is what costs." },
};

// ---------------------------------------------------------------------------
// ROTATION — what makes the day/night terminator move.
//
// `solarDayH` is the SOLAR day (noon to noon), not the sidereal rotation. They
// differ because the body moves along its orbit while it spins: Mars turns on
// its axis in 24h 37m but its solar day is 24h 39m 35s, and Venus's solar day
// (117 Earth days) is nothing like its 243-day retrograde spin. The solar day
// is the one a person standing on the surface would experience, so it is the
// one the game uses and the one worth teaching.
//
// Every big moon here is tidally locked to its planet, so its solar day is its
// orbital period — which is why a day on Titan is sixteen Earth days long and
// a day on Io is under two.
//
// `obliquity` is the axial tilt in degrees, which is what gives a body seasons
// and moves the sub-solar point north and south through its year. Uranus's 98°
// is the reason its poles get 42 years of continuous daylight.
//
// ⚠ RATES ARE REAL; PHASE IS NOT YET ANCHORED. See src/illumination.js — the
// terminator sweeps at the correct speed and features enter and leave daylight
// on the correct cycle, but WHICH meridian faces the Sun on a given calendar
// date is not tied to a real epoch yet. The game may therefore teach day
// length (true) but must never claim a specific date's lighting at a specific
// site (not yet true). Fixing it needs the IAU rotational elements W0 and Ẇ
// plus pole orientation.
// ---------------------------------------------------------------------------
export const ROTATION = {
  mercury: { solarDayH: 4222.6, obliquity: 0.034 },   // solar day ~176 Earth days
  venus:   { solarDayH: 2802.0, obliquity: 177.36 },  // retrograde; day shorter than its year
  earth:   { solarDayH: 24.0,   obliquity: 23.44 },
  mars:    { solarDayH: 24.6597, obliquity: 25.19 },
  jupiter: { solarDayH: 9.925,  obliquity: 3.13 },
  saturn:  { solarDayH: 10.656, obliquity: 26.73 },
  uranus:  { solarDayH: 17.24,  obliquity: 97.77 },
  neptune: { solarDayH: 16.11,  obliquity: 28.32 },
  pluto:   { solarDayH: 153.29, obliquity: 122.53 },

  // Tidally locked moons: solar day = orbital period, from MOONS above.
  luna:      { solarDayH: 29.5306 * 24, obliquity: 23.44, locked: true }, // synodic month
  phobos:    { solarDayH: 0.31891 * 24, obliquity: 25.19, locked: true },
  deimos:    { solarDayH: 1.26244 * 24, obliquity: 25.19, locked: true },
  io:        { solarDayH: 1.769138 * 24, obliquity: 3.13, locked: true },
  europa:    { solarDayH: 3.551181 * 24, obliquity: 3.13, locked: true },
  ganymede:  { solarDayH: 7.154553 * 24, obliquity: 3.13, locked: true },
  callisto:  { solarDayH: 16.689018 * 24, obliquity: 3.13, locked: true },
  mimas:     { solarDayH: 0.942422 * 24, obliquity: 26.73, locked: true },
  enceladus: { solarDayH: 1.370218 * 24, obliquity: 26.73, locked: true },
  tethys:    { solarDayH: 1.887802 * 24, obliquity: 26.73, locked: true },
  dione:     { solarDayH: 2.736915 * 24, obliquity: 26.73, locked: true },
  rhea:      { solarDayH: 4.518212 * 24, obliquity: 26.73, locked: true },
  titan:     { solarDayH: 15.945421 * 24, obliquity: 26.73, locked: true },
  iapetus:   { solarDayH: 79.3215 * 24, obliquity: 26.73, locked: true },
  miranda:   { solarDayH: 1.413479 * 24, obliquity: 97.77, locked: true },
  ariel:     { solarDayH: 2.520379 * 24, obliquity: 97.77, locked: true },
  umbriel:   { solarDayH: 4.144177 * 24, obliquity: 97.77, locked: true },
  titania:   { solarDayH: 8.705872 * 24, obliquity: 97.77, locked: true },
  oberon:    { solarDayH: 13.463239 * 24, obliquity: 97.77, locked: true },
  triton:    { solarDayH: 5.876854 * 24, obliquity: 28.32, locked: true },
  charon:    { solarDayH: 6.3872 * 24, obliquity: 122.53, locked: true },
};

/**
 * How long a day lasts here, said the way a person would say it.
 *
 * Short days carry SECONDS on purpose. Mars's solar day is 24h 39m 35s, and
 * rounding it to "24h 40m" throws away the very thing that makes it worth
 * saying — that it is tantalisingly close to ours, and not the same.
 */
export function saySolarDay(bodyId) {
  const r = ROTATION[bodyId];
  if (!r) return null;
  const h = r.solarDayH;
  if (h < 48) {
    const total = Math.round(h * 3600);
    const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
    return ss ? `${hh}h ${mm}m ${ss}s` : `${hh}h ${mm}m`;
  }
  const d = h / 24;
  return d < 400 ? `${d.toFixed(1)} Earth days` : `${(d / 365.25).toFixed(1)} Earth years`;
}
