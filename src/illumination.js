// ===========================================================================
// ILLUMINATION — which half of a world is in daylight, and therefore what you
// can actually photograph.
//
// This is the piece that fuses the two halves of the game (docs/design.md
// §1.5.4). The orrery's calendar decides WHERE the planets are; this decides
// WHEN, at a much finer grain — arriving at the right place at the wrong local
// time is now a failure, and "you can't photograph the night side" is the most
// obvious true thing in the world once someone says it out loud.
//
// It is also the cheapest way to make the new clock matter: a real imaging
// campaign plans around lighting before anything else.
//
// ---------------------------------------------------------------------------
// ⚠ WHAT IS TRUE HERE AND WHAT IS NOT — read before using this to teach.
//
// TRUE: the RATE. Every body's solar day is the real one (data/bodies.js), so
// the terminator sweeps at the correct speed, a site's daylight lasts the right
// number of hours, and features enter and leave the light on the right cycle. A
// day on Titan really is sixteen Earth days; on Venus a day really is longer
// than its year; Io really turns under the Sun in under two.
//
// TRUE: the SEASON. The sub-solar latitude swings with the real axial tilt over
// the body's real year, which is why Uranus's poles get decades of continuous
// daylight and why Mars has a polar night at all.
//
// NOT TRUE YET: the PHASE. Which meridian faces the Sun on a given calendar
// date is not tied to a real epoch. Anchoring it needs the IAU rotational
// elements (W0 and Ẇ) plus each body's pole orientation, which is a real but
// separate piece of work.
//
// So the game may teach DAY LENGTH and SEASON, and must never claim that a
// named site is in darkness on a specific real date. The UI says "local night",
// never "on 14 March it will be dark at Olympus Mons".
// ===========================================================================

import { ROTATION } from "./data/bodies.js";
import { periodDays } from "./ephemeris.js";

const DEG = Math.PI / 180;
const HOUR = 3600000;

/** The parent whose orbit gives a body its seasons. */
const SEASON_KEY = {
  luna: "earth", phobos: "mars", deimos: "mars",
  io: "jupiter", europa: "jupiter", ganymede: "jupiter", callisto: "jupiter",
  mimas: "saturn", enceladus: "saturn", tethys: "saturn", dione: "saturn",
  rhea: "saturn", titan: "saturn", iapetus: "saturn",
  miranda: "uranus", ariel: "uranus", umbriel: "uranus", titania: "uranus", oberon: "uranus",
  triton: "neptune", charon: "pluto",
};

/**
 * East longitude of the sub-solar point — the meridian where it is local noon.
 *
 * Advances at 360° per SOLAR day. Retrograde rotators (Venus, Uranus, Pluto,
 * whose obliquity exceeds 90°) sweep the other way, which is not decoration:
 * on Venus the Sun rises in the west, and a terminator crawling the wrong way
 * across Venus would be teaching that backwards.
 */
export function subsolarLon(bodyId, t) {
  const r = ROTATION[bodyId];
  if (!r) return 0;
  const dir = r.obliquity > 90 ? -1 : 1;
  const turns = (t / HOUR) / r.solarDayH;
  return (((dir * turns * 360) % 360) + 360) % 360;
}

/**
 * Latitude of the sub-solar point — how far north or south the Sun stands.
 *
 * Swings between ±obliquity over one orbit around the Sun, which is what a
 * season IS. For a moon this follows its planet's tilt and its planet's year,
 * because that is what actually governs the lighting out there.
 */
export function subsolarLat(bodyId, t) {
  const r = ROTATION[bodyId];
  if (!r) return 0;
  // Beyond 90° the body is upside down; the tilt that matters is the
  // supplement, and the sign flips with it.
  const tilt = r.obliquity > 90 ? -(180 - r.obliquity) : r.obliquity;
  const key = SEASON_KEY[bodyId] || bodyId;
  const yearDays = periodDays(key === "luna" ? "earth" : key) || 365.25;
  const phase = ((t / 86400000) / yearDays) * 2 * Math.PI;
  return tilt * Math.sin(phase);
}

/**
 * Is this point in daylight?
 *
 * The Sun is above the horizon where the surface normal and the Sun direction
 * make an angle under 90°:
 *   sin(lat)·sin(β) + cos(lat)·cos(β)·cos(lon − λ₀) > 0
 */
export function isLit(bodyId, lat, lonE, t) {
  if (!ROTATION[bodyId]) return true;   // unknown rotation: never block a shot
  const b = subsolarLat(bodyId, t) * DEG;
  const d = (lonE - subsolarLon(bodyId, t)) * DEG;
  const la = lat * DEG;
  return Math.sin(la) * Math.sin(b) + Math.cos(la) * Math.cos(b) * Math.cos(d) > 0;
}

/**
 * How high the Sun stands, in degrees above the horizon. Negative is night.
 *
 * Worth having beyond a yes/no: a real imaging campaign wants a LOW sun,
 * because long shadows are what make relief visible. Straight overhead washes
 * a landscape flat. That is the difference between a photograph and a record.
 */
export function sunAltitude(bodyId, lat, lonE, t) {
  if (!ROTATION[bodyId]) return 45;
  const b = subsolarLat(bodyId, t) * DEG;
  const d = (lonE - subsolarLon(bodyId, t)) * DEG;
  const la = lat * DEG;
  return Math.asin(Math.max(-1, Math.min(1,
    Math.sin(la) * Math.sin(b) + Math.cos(la) * Math.cos(b) * Math.cos(d)))) / DEG;
}

/** How good the light is for showing relief. Peaks at a low, raking sun. */
export function lightQuality(alt) {
  if (alt <= 0) return { key: "night", label: "Local night", note: "Nothing to photograph — this side is dark." };
  if (alt < 20) return { key: "raking", label: "Raking light", note: "Low sun, long shadows. The best light there is for showing relief." };
  if (alt < 55) return { key: "good", label: "Good light", note: "Clear and well modelled." };
  return { key: "flat", label: "Flat light", note: "Sun nearly overhead — the landscape washes out." };
}

/**
 * The night side, as vertical strips for drawing on an equirectangular plate.
 *
 * Per column of longitude, the terminator sits at the latitude where the Sun
 * grazes the horizon:
 *   tan(lat) · tan(β) + cos(Δ) = 0   ⟹   lat = atan(−cos(Δ) / tan(β))
 *
 * The β → 0 case (an untilted body at equinox) is the one that bites: tan(β)
 * goes to zero, the formula blows up, and the honest answer is that the
 * terminator is a straight meridian — the column is wholly lit or wholly dark.
 * Handled explicitly rather than left to produce Infinity.
 *
 * @returns Array of {lon0, lon1, latFrom, latTo} spans that are in darkness,
 *          in degrees, latFrom > latTo.
 */
export function nightSpans(bodyId, t, columns = 120) {
  if (!ROTATION[bodyId]) return [];
  const b = subsolarLat(bodyId, t);
  const l0 = subsolarLon(bodyId, t);
  const step = 360 / columns;
  const out = [];

  for (let i = 0; i < columns; i++) {
    const lon = i * step + step / 2;
    const d = Math.cos((lon - l0) * DEG);

    if (Math.abs(b) < 0.05) {
      if (d <= 0) out.push({ lon0: i * step, lon1: (i + 1) * step, latFrom: 90, latTo: -90 });
      continue;
    }

    const latT = Math.atan(-d / Math.tan(b * DEG)) / DEG;
    // With the Sun north of the equator the lit side is above the terminator,
    // so the dark span runs from there down to the south pole — and inverts
    // when the season does. Getting this backwards would light the winter pole.
    const span = b > 0 ? { latFrom: latT, latTo: -90 } : { latFrom: 90, latTo: latT };

    // A column can also be entirely dark (polar night) or entirely lit.
    const litAtPole = isLit(bodyId, b > 0 ? 89.9 : -89.9, lon, t);
    if (!litAtPole && d <= 0) out.push({ lon0: i * step, lon1: (i + 1) * step, latFrom: 90, latTo: -90 });
    else out.push({ lon0: i * step, lon1: (i + 1) * step, ...span });
  }
  return out.filter((s) => s.latFrom > s.latTo);
}

/**
 * When the Sun next rises at a site, in ms. Null if it never does within two
 * solar days — which is not a failure but a real answer: polar night can last
 * a season, and on Uranus's moons it can last decades.
 */
export function nextSunrise(bodyId, lat, lonE, t) {
  const r = ROTATION[bodyId];
  if (!r) return null;
  const span = r.solarDayH * HOUR * 2;
  const step = span / 400;
  let wasLit = isLit(bodyId, lat, lonE, t);
  for (let dt = step; dt <= span; dt += step) {
    const lit = isLit(bodyId, lat, lonE, t + dt);
    if (lit && !wasLit) return t + dt;
    wasLit = lit;
  }
  return null;
}
