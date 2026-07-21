// ===========================================================================
// ILLUMINATION — day length, seasons, and which half of a world is lit.
//
// The rates and the seasons here are claims the game makes to a child, so they
// get checked against published day lengths. The PHASE is deliberately not
// tested against reality, because it is not anchored yet — see the header of
// src/illumination.js.
// ===========================================================================
import { describe, it, expect } from "vitest";
import { subsolarLon, subsolarLat, isLit, sunAltitude, lightQuality, nightSpans } from "../src/illumination.js";
import { ROTATION, saySolarDay } from "../src/data/bodies.js";

const DAY = 86400000, HOUR = 3600000;
const t0 = Date.UTC(2030, 0, 1);

describe("day length is the real one", () => {
  it("a Martian solar day is 24h 39m, not 24h", () => {
    // The distinction the game exists to teach: Mars spins in 24h 37m, but the
    // sun-to-sun day is longer because Mars moves along its orbit meanwhile.
    expect(ROTATION.mars.solarDayH).toBeCloseTo(24.66, 2);
    expect(saySolarDay("mars")).toBe("24h 39m 35s");   // the published figure, to the second
  });

  it("Venus's day is longer than most people's intuition allows", () => {
    expect(ROTATION.venus.solarDayH / 24).toBeCloseTo(116.75, 0);
  });

  it("a day on Titan is about sixteen Earth days, because it is tidally locked", () => {
    expect(ROTATION.titan.solarDayH / 24).toBeCloseTo(15.945, 2);
    expect(ROTATION.titan.locked).toBe(true);
  });

  it("the sub-solar point goes all the way round in exactly one solar day", () => {
    for (const body of ["mars", "earth", "titan", "io"]) {
      const p = ROTATION[body].solarDayH * HOUR;
      const a = subsolarLon(body, t0);
      const b = subsolarLon(body, t0 + p);
      expect(Math.abs(((a - b + 540) % 360) - 180)).toBeLessThan(0.5);
      // ...and is somewhere else halfway through.
      const half = subsolarLon(body, t0 + p / 2);
      expect(Math.abs(((a - half + 540) % 360) - 180)).toBeGreaterThan(90);
    }
  });

  it("Venus and Uranus turn the other way", () => {
    // Retrograde rotation is not decoration: on Venus the Sun rises in the west.
    // A terminator crawling the wrong way would teach that backwards.
    const dir = (b) => {
      const step = ROTATION[b].solarDayH * HOUR / 20;
      return ((subsolarLon(b, t0 + step) - subsolarLon(b, t0) + 540) % 360) - 180;
    };
    expect(dir("mars")).toBeGreaterThan(0);
    expect(dir("earth")).toBeGreaterThan(0);
    expect(dir("venus")).toBeLessThan(0);
    expect(dir("uranus")).toBeLessThan(0);
  });
});

describe("seasons", () => {
  it("the sun swings between the tropics and no further", () => {
    for (const body of ["earth", "mars", "jupiter"]) {
      let lo = 90, hi = -90;
      for (let i = 0; i < 400; i++) {
        const b = subsolarLat(body, t0 + i * 40 * DAY);
        lo = Math.min(lo, b); hi = Math.max(hi, b);
      }
      const tilt = ROTATION[body].obliquity;
      expect(hi).toBeGreaterThan(tilt * 0.9);
      expect(lo).toBeLessThan(-tilt * 0.9);
      expect(hi).toBeLessThanOrEqual(tilt + 0.001);
    }
  });

  it("an untilted world has no seasons; Uranus has extreme ones", () => {
    // Jupiter's 3° tilt is why it has essentially no seasons at all, and
    // Uranus's 98° is why its poles get decades of continuous daylight.
    const swing = (b) => {
      let lo = 90, hi = -90;
      for (let i = 0; i < 200; i++) {
        const v = subsolarLat(b, t0 + i * 120 * DAY);
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      return hi - lo;
    };
    expect(swing("jupiter")).toBeLessThan(8);
    expect(swing("uranus")).toBeGreaterThan(100);
  });
});

describe("what is lit", () => {
  it("noon is lit and midnight is not", () => {
    const l0 = subsolarLon("mars", t0);
    expect(isLit("mars", 0, l0, t0)).toBe(true);
    expect(isLit("mars", 0, (l0 + 180) % 360, t0)).toBe(false);
  });

  it("exactly half the world is lit at any moment", () => {
    // Integrate over the sphere with a cos(lat) area weight. Anything other
    // than a half means the terminator geometry is wrong.
    let lit = 0, total = 0;
    for (let lat = -89; lat <= 89; lat += 2) {
      const w = Math.cos(lat * Math.PI / 180);
      for (let lon = 0; lon < 360; lon += 2) {
        total += w;
        if (isLit("mars", lat, lon, t0)) lit += w;
      }
    }
    expect(lit / total).toBeCloseTo(0.5, 2);
  });

  it("the sun is highest at the sub-solar point and lowest opposite it", () => {
    const lat = subsolarLat("mars", t0), lon = subsolarLon("mars", t0);
    expect(sunAltitude("mars", lat, lon, t0)).toBeCloseTo(90, 4);
    expect(sunAltitude("mars", -lat, (lon + 180) % 360, t0)).toBeCloseTo(-90, 4);
  });

  it("a site goes through night and day over one solar day", () => {
    // The mechanic, asserted: waiting at a world genuinely changes what you can
    // photograph. If a site were permanently lit the terminator would be inert.
    const p = ROTATION.mars.solarDayH * HOUR;
    const seen = new Set();
    for (let i = 0; i < 24; i++) seen.add(isLit("mars", 5, 137, t0 + (i / 24) * p));
    expect(seen.size).toBe(2);
  });

  it("the winter pole stays dark all day — polar night is real", () => {
    // Find a date when Mars's sun is well south, then check the north pole.
    let when = null;
    for (let i = 0; i < 700; i++) {
      const t = t0 + i * DAY;
      if (subsolarLat("mars", t) < -20) { when = t; break; }
    }
    expect(when).not.toBeNull();
    const p = ROTATION.mars.solarDayH * HOUR;
    for (let i = 0; i < 12; i++) expect(isLit("mars", 80, i * 30, when + (i / 12) * p)).toBe(false);
  });
});

describe("light quality", () => {
  it("rates a low sun best and an overhead sun worst", () => {
    expect(lightQuality(-5).key).toBe("night");
    expect(lightQuality(10).key).toBe("raking");
    expect(lightQuality(40).key).toBe("good");
    expect(lightQuality(80).key).toBe("flat");
  });
});

describe("the drawn terminator agrees with isLit", () => {
  it("every span it marks dark really is dark", () => {
    // The rendering path and the gameplay path must not disagree — a player
    // shooting a pin that looks lit and being told it is night would be the
    // worst possible bug here.
    for (const body of ["mars", "earth", "titan"]) {
      for (const t of [t0, t0 + 100 * DAY, t0 + 200 * DAY]) {
        for (const s of nightSpans(body, t, 60)) {
          const lon = (s.lon0 + s.lon1) / 2;
          const mid = (s.latFrom + s.latTo) / 2;
          expect(isLit(body, mid, lon, t), `${body} ${lon}/${mid}`).toBe(false);
        }
      }
    }
  });

  it("covers about half the sphere", () => {
    let dark = 0;
    for (const s of nightSpans("mars", t0, 120)) {
      dark += ((s.lon1 - s.lon0) / 360) * (Math.sin(s.latFrom * Math.PI / 180) - Math.sin(s.latTo * Math.PI / 180)) / 2;
    }
    expect(dark).toBeGreaterThan(0.42);
    expect(dark).toBeLessThan(0.58);
  });
});
