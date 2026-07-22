// ===========================================================================
// PROPULSION — the rocket equation, and the drives that change what the map
// means.
//
// This replaces the linear propellant gauge from the first build, which was a
// convenient lie: it charged 15 units for a 15 km/s trip. Real spaceflight is
// Tsiolkovsky, and the difference is not a detail — it is the single equation
// that gives the space economy its shape:
//
//     Δv = Iₛₚ · g₀ · ln(m₀ / m₁)
//
// Payload fraction falls off EXPONENTIALLY with Δv. That one fact is why
// propellant depots exist, why making propellant where you need it beats
// shipping it, why the Belt is worth having despite being far away, and why
// "just send more" is never the answer to anything. A linear gauge hides all of
// it and teaches the opposite.
//
// ---------------------------------------------------------------------------
// THE ERAS, AND WHY THEY RE-DRAW THE MAP
//
// Each drive family changes not just the numbers but the KIND of trajectory
// available, which is what makes a multi-century campaign feel like more than a
// spreadsheet growing:
//
//   CHEMICAL   — high thrust, low exhaust velocity. Impulsive burns only, so
//                you are a slave to Hohmann windows. Mass ratios are brutal.
//   NUCLEAR    — roughly double the exhaust velocity. Same trajectories, but
//     THERMAL    mass ratios ease enough that faster-than-Hohmann transfers
//                stop being unaffordable.
//   NUCLEAR    — enormous exhaust velocity, negligible thrust. You cannot do an
//     ELECTRIC   impulsive burn at all; you spiral. Windows stop mattering and
//                trip time becomes a function of acceleration.
//   FUSION     — continuous high thrust. Brachistochrone: accelerate to the
//     TORCH      midpoint, flip, decelerate. Days instead of years, and the
//                constraint becomes reaction mass and waste heat.
//
// ⚠ ONE OF THESE IS FICTION AND THE GAME SHOULD SAY SO. Everything up to and
// including nuclear electric is built, flown, or engineered in detail today.
// The torch drive is not, and the rocket equation says why: a 1 g crossing of
// 1 AU costs about 2,400 km/s of Δv, which at even a very optimistic 10,000 s
// specific impulse demands a mass ratio around 5×10¹⁰. That is not an
// engineering gap, it is an impossibility — which is precisely why every story
// with a torch drive quietly invents new physics for it. The model here will
// show a player that blow-up rather than hide it.
// ===========================================================================

const G0 = 9.80665;          // m/s², the standard gravity in Iₛₚ's definition
const AU_M = 1.495978707e11;

/**
 * Drives, by era. `isp` in seconds, `thrustKN` per engine, `available` is the
 * earliest campaign year the family is plausible.
 *
 * Iₛₚ figures are vacuum values for real, flown or designed engines:
 *   RL10 / Centaur hydrolox ≈ 450 s · Raptor-class methalox ≈ 380 s
 *   NERVA-class solid-core NTR ≈ 850 s · gridded ion (NEXT) ≈ 4,200 s
 */
export const DRIVES = {
  methalox: {
    id: "methalox", name: "Methalox chemical", era: "chemical",
    isp: 380, thrustKN: 2000, available: 2025, speculative: false,
    note: "Storable, and you can make it on Mars from the atmosphere. The workhorse.",
    trajectory: "impulsive",
  },
  hydrolox: {
    id: "hydrolox", name: "Hydrolox chemical", era: "chemical",
    isp: 450, thrustKN: 1000, available: 2025, speculative: false,
    note: "The best chemistry there is, and it boils off. Good for departures, bad for storage.",
    trajectory: "impulsive",
  },
  ntr: {
    id: "ntr", name: "Nuclear thermal", era: "nuclear-thermal",
    isp: 850, thrustKN: 330, available: 2045, speculative: false,
    note: "Hydrogen heated by a reactor instead of burned. Twice the exhaust velocity of chemistry; NERVA ran on a test stand in the 1960s.",
    trajectory: "impulsive",
  },
  nep: {
    id: "nep", name: "Nuclear electric (ion)", era: "nuclear-electric",
    isp: 4200, thrustKN: 0.24, available: 2070, speculative: false,
    note: "Ten times the exhaust velocity and a thousandth of the thrust. You do not burn — you spiral, for months, and windows stop mattering.",
    trajectory: "spiral",
  },
  torch: {
    id: "torch", name: "Fusion torch", era: "fusion",
    isp: 10000, thrustKN: 8000, available: 2200, speculative: true,
    note: "High thrust AND high exhaust velocity together. Days to Mars — and the one piece of genuine science fiction in this game. See massRatio().",
    trajectory: "brachistochrone",
  },
};

export const ERAS = ["chemical", "nuclear-thermal", "nuclear-electric", "fusion"];

// ---------------------------------------------------------------------------
// The rocket equation
// ---------------------------------------------------------------------------

/** Exhaust velocity in km/s. This, not Iₛₚ, is what the equation actually uses. */
export const exhaustVelocity = (isp) => (isp * G0) / 1000;

/**
 * Wet-to-dry mass ratio needed for a given Δv (km/s).
 *
 * Exponential. At an exhaust velocity of 4.4 km/s (the best chemistry
 * available), a 5.6 km/s Earth→Mars transfer needs a ratio of about 3.6 —
 * roughly 72% of what leaves is propellant. Ask for 15 km/s and the ratio is
 * about 30, which is another way of saying it cannot be done in one stage.
 */
export const massRatio = (dvKms, isp) => Math.exp(dvKms / exhaustVelocity(isp));

/** Fraction of departure mass that must be propellant. Approaches 1, never reaches it. */
export const propellantFraction = (dvKms, isp) => 1 - 1 / massRatio(dvKms, isp);

/** Propellant needed (tonnes) to push `dryTonnes` through `dvKms`. */
export const propellantFor = (dryTonnes, dvKms, isp) =>
  dryTonnes * (massRatio(dvKms, isp) - 1);

/** Δv (km/s) a vehicle actually has, given what it weighs full and empty. */
export const deltaVAvailable = (wetTonnes, dryTonnes, isp) =>
  dryTonnes > 0 && wetTonnes >= dryTonnes ? exhaustVelocity(isp) * Math.log(wetTonnes / dryTonnes) : 0;

/**
 * How much useful payload survives a given Δv, as a fraction of departure mass.
 *
 * `structural` is tankage and engine as a fraction of PROPELLANT mass — around
 * 0.08 for a decent stage. This is the number that decides whether a mission is
 * possible at all, and it is why depots and in-situ propellant matter so much:
 * a negative answer means the vehicle cannot even lift its own tanks.
 */
export function payloadFraction(dvKms, isp, structural = 0.08) {
  const mr = massRatio(dvKms, isp);
  const propPerDeparture = 1 - 1 / mr;
  return 1 - propPerDeparture * (1 + structural);
}

/** Is this trip possible in one stage at all? */
export const isFeasible = (dvKms, isp, structural = 0.08) =>
  payloadFraction(dvKms, isp, structural) > 0.01;

// ---------------------------------------------------------------------------
// Trajectories the drive families make available
// ---------------------------------------------------------------------------

/**
 * Constant-acceleration ("brachistochrone") crossing: burn to the midpoint,
 * flip, burn to a stop.
 *
 *   t  = 2 √(d / a)          Δv = 2 √(a · d)
 *
 * At 1 g across 1 AU that is 2.9 days and 2,400 km/s — the trade The Expanse
 * lives on, and the reason a torch drive needs physics we do not have.
 */
export function brachistochrone(distanceAU, accelG) {
  const d = distanceAU * AU_M, a = accelG * G0;
  return { days: (2 * Math.sqrt(d / a)) / 86400, dvKms: (2 * Math.sqrt(a * d)) / 1000 };
}

/**
 * Low-thrust spiral between two circular heliocentric orbits.
 *
 * With continuous gentle thrust you never make an impulsive burn; you unwind
 * outward, and the Δv is simply the difference in circular orbital speeds. That
 * is close to a Hohmann transfer for a short hop (Earth→Mars: 5.7 vs 5.6 km/s)
 * and much worse for a long one (Earth→Jupiter: 16.7 vs 14.4) — but with an
 * exhaust velocity ten times higher, the mass ratio still wins easily.
 *
 * The payoff a player feels: no launch windows. You leave whenever you like.
 */
export function spiral(r1AU, r2AU, accelMs2) {
  const V1AU = 29.784;                                   // Earth's circular speed, km/s
  const v1 = V1AU / Math.sqrt(r1AU), v2 = V1AU / Math.sqrt(r2AU);
  const dvKms = Math.abs(v1 - v2);
  return { dvKms, days: accelMs2 > 0 ? (dvKms * 1000) / accelMs2 / 86400 : Infinity };
}

/** Acceleration in m/s² for a vehicle of `tonnes` under `engines` of a drive. */
export const acceleration = (drive, tonnes, engines = 1) =>
  (drive.thrustKN * engines * 1000) / (tonnes * 1000);

/** Which drives a campaign year has unlocked. */
export const drivesAvailable = (year) =>
  Object.values(DRIVES).filter((d) => year >= d.available);

/**
 * A plain-language verdict on a proposed trip, for the UI.
 *
 * Deliberately reports the mass ratio rather than hiding it behind a fuel bar:
 * seeing "you must be 72% propellant" is the moment the rocket equation stops
 * being an equation and starts being a constraint you feel.
 */
export function assess(dvKms, drive, structural = 0.08) {
  const mr = massRatio(dvKms, drive.isp);
  const pf = payloadFraction(dvKms, drive.isp, structural);
  return {
    massRatio: mr,
    propellantPct: propellantFraction(dvKms, drive.isp) * 100,
    payloadFraction: pf,
    feasible: pf > 0.01,
    verdict: pf > 0.35 ? "comfortable"
      : pf > 0.15 ? "tight"
        : pf > 0.01 ? "marginal — nearly all of it is tank"
          : "impossible in one stage",
  };
}
