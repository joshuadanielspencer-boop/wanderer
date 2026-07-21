// ===========================================================================
// EPHEMERIS — where the planets actually are, on any date the game asks about.
//
// This is the file the whole game stands on. Shutterbug's map never moved; ours
// does, and every transfer window, every delta-v quote, and every "the rings are
// edge-on this year" clue is downstream of the numbers computed here. If this is
// wrong, everything above it is confidently, invisibly wrong.
//
// METHOD — E. M. Standish's "Keplerian Elements for Approximate Positions of the
// Major Planets", the low-precision formulation JPL publishes for exactly this
// purpose. Six elements and six rates per body; positions good to a fraction of
// a degree over 1800–2050, which is far better than a game needs and small
// enough to ship offline in a few hundred bytes.
//   https://ssd.jpl.nasa.gov/planets/approx_pos.html
//
// WHY NOT REAL EPHEMERIDES: a DE440 kernel is tens of megabytes and needs a
// binary reader. This is the "simplified but honest" choice — real periods, real
// eccentricities, real relative geometry, real oppositions. Planets line up when
// they really line up. See docs/design.md §1.6.
//
// ACCURACY IS TESTED, NOT ASSUMED. `test/ephemeris.test.js` checks this against
// three real, independently published opposition dates (Mars 2025-01-16, Jupiter
// 2024-12-07, Saturn 2025-09-20). At opposition the Earth sits on the line from
// the Sun to the planet, so their heliocentric longitudes must agree — a check
// that exercises two bodies at once and can't be satisfied by a plausible-
// looking bug.
// ===========================================================================

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Table 1 — elements at J2000.0 and their rates per Julian century.
// Columns: a (au), e, I (deg), L (deg), varpi (deg), Omega (deg), each followed
// by its rate. Valid 1800 AD – 2050 AD.
//
// `EM Bary` in JPL's table is the Earth–Moon barycentre, not Earth. The offset
// is ~4,670 km, which at 1 au subtends under 0.002° — below the table's own
// error, so the game treats it as Earth and says so here rather than pretending
// otherwise.
//
// Pluto is NOT in JPL's current table (it was dropped when it was reclassified).
// Its row below is Standish's original, still hosted on a JPL server:
//   https://spsweb.fltops.jpl.nasa.gov/portaldataops/mpg/MPG_Docs/Source%20Docs/Standish-KeplerianElements-Planets.txt
// Pluto's eccentricity and 17° inclination are large enough that its error is
// the worst in the table. That is fine for a game board and would not be fine
// for a trajectory.
// ---------------------------------------------------------------------------
export const ELEMENTS = {
  mercury: {
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749],
    L: [252.25032350, 149472.67411175], w: [77.45779628, 0.16047689], O: [48.33076593, -0.12534081],
  },
  venus: {
    a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890],
    L: [181.97909950, 58517.81538729], w: [131.60246718, 0.00268329], O: [76.67984255, -0.27769418],
  },
  earth: {
    a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0.0, 0.0],
  },
  mars: {
    a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343],
  },
  jupiter: {
    a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], O: [100.47390909, 0.20469106],
  },
  saturn: {
    a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201], w: [92.59887831, -0.41897216], O: [113.66242448, -0.28867794],
  },
  uranus: {
    a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939],
    L: [313.23810451, 428.48202785], w: [170.95427630, 0.40805281], O: [74.01692503, 0.04240589],
  },
  neptune: {
    a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372],
    L: [-55.12002969, 218.45945325], w: [44.96476227, -0.32241464], O: [131.78422574, -0.00508664],
  },
  pluto: {
    a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], I: [17.14001206, 0.00004818],
    L: [238.92903833, 145.20780515], w: [224.06891629, -0.04062942], O: [110.30393684, -0.01183482],
  },
};

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Julian Date from a JS Date (or ms epoch). 1970-01-01T00:00Z is JD 2440587.5. */
export const toJD = (date) =>
  (date instanceof Date ? date.getTime() : date) / 86400000 + 2440587.5;

/** Julian centuries since J2000.0 (JD 2451545.0) — Standish's T. */
export const centuriesSinceJ2000 = (date) => (toJD(date) - 2451545.0) / 36525;

/** Wrap degrees into [-180, 180) — the range Kepler's equation wants for M. */
const wrap180 = (d) => {
  const x = ((d + 180) % 360 + 360) % 360;
  return x - 180;
};

/** Wrap degrees into [0, 360). */
export const wrap360 = (d) => ((d % 360) + 360) % 360;

// ---------------------------------------------------------------------------
// Kepler's equation:  M = E - e* sin E,  with e* = e in degrees.
//
// Newton's method. Standish specifies iterating to 1e-6 degrees; near-circular
// orbits converge in two or three passes and Pluto's e=0.249 in about five. The
// iteration cap exists so a bad element table can never hang the render loop —
// it should never be reached, and the test asserts convergence independently.
// ---------------------------------------------------------------------------
function solveKepler(M, e) {
  const eStar = e / DEG; // eccentricity expressed in degrees, per Standish
  let E = M + eStar * Math.sin(M * DEG);
  for (let i = 0; i < 30; i++) {
    const dM = M - (E - eStar * Math.sin(E * DEG));
    const dE = dM / (1 - e * Math.cos(E * DEG));
    E += dE;
    if (Math.abs(dE) <= 1e-7) break;
  }
  return E;
}

// ---------------------------------------------------------------------------
// The main entry point.
// ---------------------------------------------------------------------------

/**
 * Heliocentric position of a planet, in the J2000 ecliptic frame.
 *
 * @param {string} key  a key of ELEMENTS ("mars", "saturn", ...)
 * @param {Date}   date the mission date
 * @returns {{x,y,z,r,lon,lat}}  x/y/z and r in astronomical units; lon/lat in
 *          degrees. `lon` is ecliptic longitude in [0,360) — the number that
 *          decides who is lined up with whom, and so the number the game's
 *          transfer windows are built on.
 */
export function heliocentric(key, date) {
  const el = ELEMENTS[key];
  if (!el) throw new Error(`Unknown body: ${key}`);
  const T = centuriesSinceJ2000(date);

  // 1. Elements at this epoch.
  const a = el.a[0] + el.a[1] * T;
  const e = el.e[0] + el.e[1] * T;
  const I = el.I[0] + el.I[1] * T;
  const L = el.L[0] + el.L[1] * T;
  const wBar = el.w[0] + el.w[1] * T; // longitude of perihelion
  const O = el.O[0] + el.O[1] * T;    // longitude of ascending node

  // 2. Argument of perihelion and mean anomaly.
  //    The b/c/s/f correction terms in Standish's step 2 belong to the
  //    3000 BC–3000 AD tables only; for this table they are zero.
  const w = wBar - O;
  const M = wrap180(L - wBar);

  // 3. Eccentric anomaly.
  const E = solveKepler(M, e);

  // 4. Coordinates in the orbital plane, x' toward perihelion.
  const xp = a * (Math.cos(E * DEG) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);

  // 5. Rotate into the ecliptic: Rz(-O) Rx(-I) Rz(-w).
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG);
  const cO = Math.cos(O * DEG), sO = Math.sin(O * DEG);
  const cI = Math.cos(I * DEG), sI = Math.sin(I * DEG);

  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = (sw * sI) * xp + (cw * sI) * yp;

  const r = Math.sqrt(x * x + y * y + z * z);
  return {
    x, y, z, r,
    lon: wrap360(Math.atan2(y, x) / DEG),
    lat: Math.asin(z / r) / DEG,
  };
}

/**
 * Angle between two bodies as seen from the Sun, in degrees, 0..180.
 * This is the quantity a transfer window is really about: Mars is worth going
 * to when this angle to Earth is right, not when Mars is "close".
 */
export function elongation(keyA, keyB, date) {
  const d = wrap360(heliocentric(keyA, date).lon - heliocentric(keyB, date).lon);
  return d > 180 ? 360 - d : d;
}

/** Sidereal period in days, from the current semi-major axis. Kepler's third law. */
export function periodDays(key, date = new Date(2000, 0, 1)) {
  const T = centuriesSinceJ2000(date);
  const a = ELEMENTS[key].a[0] + ELEMENTS[key].a[1] * T;
  return 365.256898326 * Math.pow(a, 1.5);
}

/** One-way light time in seconds between two bodies. The mentor arrives late. */
export function lightTimeSeconds(keyA, keyB, date) {
  const A = heliocentric(keyA, date), B = heliocentric(keyB, date);
  const AU_KM = 149597870.7, C_KMS = 299792.458;
  const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
  return (d * AU_KM) / C_KMS;
}
