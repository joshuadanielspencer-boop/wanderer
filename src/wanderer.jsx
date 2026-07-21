// ===========================================================================
// WANDERER — phase-0 spike.
//
// What this is proving, and nothing more:
//   1. The orrery renders real planet positions from real elements, and the
//      planets move and line up when they really do.  (src/ephemeris.js)
//   2. The three-level ladder works as navigation: system → body → feature,
//      the direct counterpart of Shutterbug's continent → country → city.
//   3. The map's answer changes with the calendar — distance, light lag and
//      the best transfer target are all different in March than in November.
//   4. The clue ladder and the feature card carry the content shape from
//      docs/design.md §1.3 and §1.12, including name origins.
//
// What it is NOT: the game. There is no run loop, no scoring, no profile, no
// passport, no art. Those are phases 3–6.
// ===========================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { heliocentric, lightTimeSeconds, periodDays } from "./ephemeris.js";
import { project, orbitPath, moonLongitude, sayLightTime, sayDistance, logRadius, linearRadius } from "./orrery.js";
import { SYSTEMS, SYSTEM_BY_ID, MOONS, DELTA_V_FROM_LEO } from "./data/bodies.js";
import { FEATURES_BY_BODY } from "./data/features.js";

const VB = 1000;              // SVG viewBox is square; the board is centred in it
const CX = VB / 2, CY = VB / 2, BOARD_R = 430;
const DAY = 86400000;

const fmtDate = (d) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// Visual size for a body on screen. Not to scale — nothing about a solar system
// can be to scale in two axes at once. Fourth-root keeps Jupiter clearly the
// giant and Mercury clearly a pebble without either leaving the board.
const dotFor = (radiusKm, k = 1) =>
  Math.max(4, Math.min(26, Math.pow(radiusKm || 1000, 0.25) * 1.35)) * k;

export default function Wanderer() {
  const [date, setDate] = useState(() => new Date(Date.UTC(2026, 6, 21)));
  const [view, setView] = useState({ level: "orrery", system: null, body: null });
  const [selected, setSelected] = useState(null);   // system id, in orrery view
  const [feature, setFeature] = useState(null);     // the open feature card
  const [shot, setShot] = useState(false);          // has the card been "photographed"
  const [tier, setTier] = useState("easy");
  const [trueScale, setTrueScale] = useState(false);
  const [playing, setPlaying] = useState(false);

  // ---- the clock -----------------------------------------------------------
  // Advancing the date is the single most convincing thing this spike does: the
  // planets separate, close, and line up on their real periods.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDate((d) => new Date(d.getTime() + 6 * DAY)), 40);
    return () => clearInterval(id);
  }, [playing]);

  const step = (days) => setDate((d) => new Date(d.getTime() + days * DAY));

  // Positions for every system with an ephemeris, recomputed only when the date
  // changes. Nine Kepler solves is nothing, but the orrery redraws on every
  // frame while playing, and this keeps that free.
  const positions = useMemo(() => {
    const out = {};
    for (const s of SYSTEMS) if (s.ephemerisKey) out[s.id] = heliocentric(s.ephemerisKey, date);
    return out;
  }, [date]);

  // One full orbit per planet, sampled once for the life of the app. These are
  // the guide rings, and unlike the planets they must NOT move with the clock.
  const orbits = useMemo(() => {
    const out = {};
    for (const s of SYSTEMS) {
      if (!s.ephemerisKey) continue;
      const P = periodDays(s.ephemerisKey);
      const base = Date.UTC(2000, 0, 1);
      out[s.id] = Array.from({ length: 240 }, (_, i) =>
        heliocentric(s.ephemerisKey, new Date(base + (P * i / 240) * DAY)));
    }
    return out;
  }, []);

  const openSystem = (id) => {
    const sys = SYSTEM_BY_ID[id];
    if (!sys || sys.kind === "belt") return;
    setView({ level: "system", system: id, body: null });
    setSelected(null);
  };
  const openBody = (systemId, bodyId) => {
    setView({ level: "body", system: systemId, body: bodyId });
    setFeature(null);
  };
  const back = () => {
    setFeature(null);
    if (view.level === "body") setView({ level: "system", system: view.system, body: null });
    else setView({ level: "orrery", system: null, body: null });
  };

  // Escape always goes up a level — the cheapest possible "I'm lost" affordance.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (feature) setFeature(null); else back(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => { setShot(false); }, [feature]);

  return (
    <div style={S.app}>
      <Header
        date={date} step={step} setDate={setDate}
        playing={playing} setPlaying={setPlaying}
        trueScale={trueScale} setTrueScale={setTrueScale}
        tier={tier} setTier={setTier}
      />

      <div style={S.main}>
        <div style={S.stage}>
          <Breadcrumb view={view} back={back} />
          <svg
            viewBox={`0 0 ${VB} ${VB}`}
            style={S.svg}
            role="group"
            aria-label={view.level === "orrery" ? "Orrery — the solar system from above" : "Map"}
          >
            {view.level === "orrery" && (
              <OrreryView
                positions={positions} orbits={orbits} trueScale={trueScale}
                selected={selected} onSelect={setSelected} onOpen={openSystem}
              />
            )}
            {view.level === "system" && (
              <SystemView systemId={view.system} date={date} onOpen={openBody} />
            )}
            {view.level === "body" && (
              <BodyView bodyId={view.body} onPick={setFeature} picked={feature} />
            )}
          </svg>
        </div>

        <aside style={S.panel} aria-live="polite">
          {feature
            ? <FeatureCard f={feature} tier={tier} shot={shot} onShoot={() => setShot(true)} onClose={() => setFeature(null)} />
            : view.level === "orrery"
              ? <OrreryPanel id={selected} positions={positions} date={date} onOpen={openSystem} />
              : view.level === "system"
                ? <SystemPanel systemId={view.system} date={date} positions={positions} onOpen={openBody} />
                : <BodyPanel bodyId={view.body} systemId={view.system} />}
        </aside>
      </div>
    </div>
  );
}

// ===========================================================================
// Header — the clock, and the two toggles worth having in a spike.
// ===========================================================================
function Header({ date, step, setDate, playing, setPlaying, trueScale, setTrueScale, tier, setTier }) {
  // The slider spans 2020–2050, which is inside the Standish table's stated
  // validity window (1800–2050). Outside that the numbers drift, so the UI
  // simply does not offer it.
  const MIN = Date.UTC(2020, 0, 1), MAX = Date.UTC(2050, 0, 1);
  return (
    <header style={S.header}>
      <div>
        <div style={S.title}>WANDERER</div>
        <div style={S.sub}>a solar system photo safari · phase-0 spike</div>
      </div>

      <div style={S.clock}>
        <div style={S.dateLine}>{fmtDate(date)}</div>
        <div style={S.row}>
          <Btn onClick={() => step(-365)} label="Back one year">−1y</Btn>
          <Btn onClick={() => step(-30)} label="Back one month">−1m</Btn>
          <Btn onClick={() => setPlaying((p) => !p)} label={playing ? "Pause the clock" : "Run the clock"} wide>
            {playing ? "❚❚ Pause" : "▶ Run"}
          </Btn>
          <Btn onClick={() => step(30)} label="Forward one month">+1m</Btn>
          <Btn onClick={() => step(365)} label="Forward one year">+1y</Btn>
        </div>
        <input
          type="range" min={MIN} max={MAX} step={DAY} value={date.getTime()}
          onChange={(e) => setDate(new Date(+e.target.value))}
          style={S.slider} aria-label="Mission date"
        />
      </div>

      <div style={S.row}>
        <Toggle
          value={tier} onChange={setTier} label="Clue tier"
          options={[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]]}
        />
        <Btn onClick={() => setTrueScale((v) => !v)} label="Toggle true distance scale" wide>
          {trueScale ? "◉ True scale" : "◎ Log scale"}
        </Btn>
      </div>
    </header>
  );
}

// ===========================================================================
// View 1 — the orrery. Shutterbug's world map.
// ===========================================================================
function OrreryView({ positions, orbits, trueScale, selected, onSelect, onOpen }) {
  const opts = { cx: CX, cy: CY, radius: BOARD_R, trueScale };

  return (
    <g>
      <defs>
        <radialGradient id="sunGlow">
          <stop offset="0%" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#F2B441" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The two belts are regions, not places — drawn as bands, not dots.
          They must use the SAME radial scale as everything else: the first
          version pinned them to logRadius regardless, so flipping to true scale
          left the Asteroid Belt drawn outside Uranus. */}
      {SYSTEMS.filter((s) => s.kind === "belt").map((s) => {
        const scale = trueScale ? linearRadius : logRadius;
        const inner = scale(s.auHint * 0.82) * BOARD_R;
        const outer = scale(s.auHint * 1.22) * BOARD_R;
        return (
          <g key={s.id}>
            <circle cx={CX} cy={CY} r={(inner + outer) / 2} fill="none"
              stroke="#8A8073" strokeOpacity={0.20} strokeWidth={outer - inner}
              strokeDasharray="2 7" />
            <text x={CX} y={CY - (outer + inner) / 2 - 6} style={S.beltLabel}>{s.name}</text>
          </g>
        );
      })}

      {/* Orbit guide rings — the real, fixed orbits. See orbitPath(). */}
      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => (
        <path key={s.id} d={orbitPath(orbits[s.id], opts)} fill="none"
          stroke={selected === s.id ? s.color : "#26324a"}
          strokeWidth={selected === s.id ? 2 : 1}
          strokeOpacity={selected === s.id ? 0.9 : 0.55} />
      ))}

      <circle cx={CX} cy={CY} r={110} fill="url(#sunGlow)" />
      <circle cx={CX} cy={CY} r={13} fill="#F2B441" />
      <text x={CX} y={CY + 34} style={S.sunLabel}>The Sun</text>

      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => {
        const p = positions[s.id];
        const { x, y } = project(p.r, p.lon, opts);
        const on = selected === s.id;
        const r = dotFor(s.radiusKm, s.id === "pluto" ? 1.4 : 1);
        return (
          <g key={s.id}
            role="button" tabIndex={0}
            aria-label={`${s.name}. ${sayDistance(p.r)} from the Sun. Press Enter to travel there.`}
            onClick={() => (on ? onOpen(s.id) : onSelect(s.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); on ? onOpen(s.id) : onSelect(s.id); }
            }}
            style={{ cursor: "pointer" }}
          >
            {/* A generous invisible hit target — the dots are small on purpose. */}
            <circle cx={x} cy={y} r={Math.max(20, r + 12)} fill="transparent" />
            {on && <circle cx={x} cy={y} r={r + 9} fill="none" stroke={s.color} strokeWidth={2} strokeOpacity={0.8} />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth={1.5} />
            <text x={x} y={y - r - 9} style={{ ...S.pinLabel, fill: on ? "#fff" : "#B9C2D4" }}>{s.name}</text>
          </g>
        );
      })}
    </g>
  );
}

// ===========================================================================
// View 2 — one planet and its moons. Shutterbug's country layer.
// ===========================================================================
function SystemView({ systemId, date, onOpen }) {
  const sys = SYSTEM_BY_ID[systemId];
  const moons = MOONS[systemId] || [];

  // Log-compressed again, for the same reason: Iapetus orbits twenty times
  // further out than Mimas, and both need to be clickable on one board.
  const maxA = Math.max(...moons.map((m) => m.aKm), 1);
  const rOf = (aKm) => (Math.log(1 + (aKm / maxA) / 0.12) / Math.log(1 + 1 / 0.12)) * (BOARD_R - 60) + 60;
  const planetR = dotFor(sys.radiusKm, 2.2);

  return (
    <g>
      {moons.map((m) => (
        <circle key={m.id} cx={CX} cy={CY} r={rOf(m.aKm)} fill="none" stroke="#26324a" strokeOpacity={0.6} />
      ))}

      {/* Saturn's rings, drawn because they are the reason anyone goes. */}
      {systemId === "saturn" && (
        <ellipse cx={CX} cy={CY} rx={planetR * 2.3} ry={planetR * 2.3} fill="none"
          stroke="#D8C08A" strokeOpacity={0.35} strokeWidth={planetR * 0.75} />
      )}

      <g role="button" tabIndex={0} style={{ cursor: "pointer" }}
        aria-label={`${sys.name} itself. Press Enter to map its surface.`}
        onClick={() => onOpen(systemId, systemId)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(systemId, systemId); } }}>
        <circle cx={CX} cy={CY} r={planetR} fill={sys.color} stroke="#070A12" strokeWidth={2} />
        <text x={CX} y={CY + planetR + 22} style={S.sunLabel}>{sys.name}</text>
      </g>

      {moons.map((m) => {
        const R = rOf(m.aKm);
        const a = (moonLongitude(m, date) * Math.PI) / 180;
        const x = CX + R * Math.cos(a), y = CY - R * Math.sin(a);
        const r = dotFor(m.radiusKm, 1.1);
        const has = (FEATURES_BY_BODY[m.id] || []).length;
        return (
          <g key={m.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${m.name}. ${has} place${has === 1 ? "" : "s"} to photograph. Press Enter to map it.`}
            onClick={() => onOpen(systemId, m.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(systemId, m.id); } }}>
            <circle cx={x} cy={y} r={Math.max(18, r + 10)} fill="transparent" />
            <circle cx={x} cy={y} r={r} fill="#C9CFDC" stroke="#070A12" strokeWidth={1.5} />
            {/* Colourblind-safe: a place with subjects is marked by a ring AND
                named in the label, never by colour alone (rule 4). */}
            {has > 0 && <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#F2B441" strokeWidth={1.5} />}
            <text x={x} y={y - r - 9} style={S.pinLabel}>{m.name}{has > 0 ? " ◆" : ""}</text>
          </g>
        );
      })}
    </g>
  );
}

// ===========================================================================
// View 3 — the body map. Shutterbug's relief plate.
//
// Equirectangular: east longitude 0→360 across, latitude +90→−90 down. That is
// the gazetteer's convention and every USGS planetary basemap's projection, so
// a feature's stored coordinates land on the plate with no transformation at
// all — and no opportunity to get a sign backwards.
// ===========================================================================
function BodyView({ bodyId, onPick, picked }) {
  const [plate, setPlate] = useState(true);
  useEffect(() => { setPlate(true); }, [bodyId]);

  const feats = FEATURES_BY_BODY[bodyId] || [];
  const sys = SYSTEM_BY_ID[bodyId];
  const moonDef = Object.values(MOONS).flat().find((m) => m.id === bodyId);
  const color = sys?.color || "#9AA6B8";

  // A 2:1 plate, centred in the square board.
  const W = 940, H = 470, X0 = (VB - W) / 2, Y0 = (VB - H) / 2;
  const px = (lonE) => X0 + (lonE / 360) * W;
  const py = (lat) => Y0 + ((90 - lat) / 180) * H;

  return (
    <g>
      <defs>
        <linearGradient id="plateFall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <clipPath id="plateClip"><rect x={X0} y={Y0} width={W} height={H} /></clipPath>
      </defs>

      <g clipPath="url(#plateClip)">
        {plate ? (
          <image
            href={`${import.meta.env.BASE_URL}plates/${bodyId}.jpg`}
            x={X0} y={Y0} width={W} height={H} preserveAspectRatio="none"
            onError={() => setPlate(false)}
          />
        ) : (
          // Placeholder until scripts/make-body-plate.mjs has been run. It is
          // deliberately flat and obviously fake — a plausible-looking fake map
          // is worse than none, because someone will believe it.
          <rect x={X0} y={Y0} width={W} height={H} fill={color} opacity={0.30} />
        )}
        <rect x={X0} y={Y0} width={W} height={H} fill="url(#plateFall)" />
      </g>

      {/* Graticule every 30°, so latitude and longitude are visible facts
          rather than invisible ones. */}
      {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((l) => (
        <line key={l} x1={px(l)} y1={Y0} x2={px(l)} y2={Y0 + H} stroke="#fff" strokeOpacity={0.10} />
      ))}
      {[60, 30, 0, -30, -60].map((l) => (
        <line key={l} x1={X0} y1={py(l)} x2={X0 + W} y2={py(l)}
          stroke="#fff" strokeOpacity={l === 0 ? 0.28 : 0.10} strokeDasharray={l === 0 ? "" : "4 6"} />
      ))}
      <rect x={X0} y={Y0} width={W} height={H} fill="none" stroke="#26324a" strokeWidth={2} />

      <text x={X0} y={Y0 - 14} style={S.plateTitle}>
        {sys?.name || moonDef?.name || bodyId}
        {!plate && <tspan style={{ fill: "#8A94A8", fontWeight: 400 }}>  — placeholder plate, no imagery yet</tspan>}
      </text>
      <text x={X0} y={Y0 + H + 22} style={S.plateAxis}>0° east longitude → 360°</text>

      {feats.map((f) => {
        const x = px(f.lonE), y = py(f.lat);
        const on = picked?.id === f.id;
        return (
          <g key={f.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${f.name}. Press Enter to open the assignment.`}
            onClick={() => onPick(f)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(f); } }}>
            <circle cx={x} cy={y} r={18} fill="transparent" />
            <circle cx={x} cy={y} r={on ? 9 : 6} fill={on ? "#F2B441" : "#fff"} stroke="#070A12" strokeWidth={2} />
            {on && <circle cx={x} cy={y} r={15} fill="none" stroke="#F2B441" strokeWidth={2} />}
            <text x={x + 13} y={y + 5} style={{ ...S.pinLabel, textAnchor: "start", fill: on ? "#fff" : "#C7D0E0" }}>
              {f.name}
            </text>
          </g>
        );
      })}

      {feats.length === 0 && (
        <text x={CX} y={Y0 + H / 2} style={S.empty}>No catalogued places here yet.</text>
      )}
    </g>
  );
}

// ===========================================================================
// Panels
// ===========================================================================
function OrreryPanel({ id, positions, date, onOpen }) {
  if (!id) {
    return (
      <Pane title="The board">
        <p style={S.p}>
          Every planet below is where it really is on <b>{fmtDate(date)}</b>, computed
          from JPL's Keplerian elements. Run the clock and watch them separate and
          line up — those alignments are what a transfer window <i>is</i>.
        </p>
        <p style={S.p}>
          Click a planet to select it. Click again — or press Enter — to travel there.
        </p>
        <p style={{ ...S.p, color: "var(--muted)" }}>
          Radius is compressed logarithmically so the inner planets aren't a pile of
          dots on top of the Sun. Angles are exact. Hit <b>True scale</b> to see the
          honest version, once.
        </p>
      </Pane>
    );
  }

  const s = SYSTEM_BY_ID[id];
  const p = positions[id];
  const lt = lightTimeSeconds("earth", s.ephemerisKey, date);
  const dv = DELTA_V_FROM_LEO[id];
  const earth = positions.earth;
  const sep = Math.hypot(p.x - earth.x, p.y - earth.y, p.z - earth.z);

  return (
    <Pane title={s.name}>
      <p style={S.p}>{s.blurb}</p>
      <Stat label="From the Sun" value={sayDistance(p.r)} />
      <Stat label="From Earth today" value={sayDistance(sep)} />
      <Stat label="A message home takes" value={sayLightTime(lt)} hint="one way, at the speed of light" />
      <Stat label="A year here lasts" value={`${(periodDays(s.ephemerisKey) / 365.25).toFixed(1)} Earth years`} />
      {dv && <Stat label="Δv from low Earth orbit" value={`${dv.orbit} km/s to orbit${dv.land ? ` · ${dv.land} to land` : ""}`} hint={dv.note} />}
      <button style={S.cta} onClick={() => onOpen(id)}>Travel to {s.name} →</button>
    </Pane>
  );
}

function SystemPanel({ systemId, date, positions, onOpen }) {
  const s = SYSTEM_BY_ID[systemId];
  const moons = MOONS[systemId] || [];
  const lt = positions[systemId] ? lightTimeSeconds("earth", s.ephemerisKey, date) : null;

  return (
    <Pane title={`The ${s.name} system`}>
      <p style={S.p}>{s.blurb}</p>
      {lt !== null && (
        <Stat label="A message home takes" value={sayLightTime(lt)}
          hint={lt > 1800 ? "Out here you ask for a hint and it arrives next turn." : undefined} />
      )}
      <Stat label="Known moons" value={s.moons === 0 ? "None" : `${s.moons}`}
        hint={moons.length ? `${moons.length} of them are on the board.` : undefined} />
      <div style={S.hr} />
      <div style={S.small}>Pick a world to map its surface.</div>
      {moons.map((m) => {
        const n = (FEATURES_BY_BODY[m.id] || []).length;
        return (
          <button key={m.id} style={S.listItem} onClick={() => onOpen(systemId, m.id)}>
            <div>
              <b>{m.name}</b>
              {n > 0 && <span style={S.tag}>{n} to photograph</span>}
            </div>
            <div style={S.small}>{m.note}</div>
          </button>
        );
      })}
    </Pane>
  );
}

function BodyPanel({ bodyId }) {
  const sys = SYSTEM_BY_ID[bodyId];
  const moonDef = Object.values(MOONS).flat().find((m) => m.id === bodyId);
  const feats = FEATURES_BY_BODY[bodyId] || [];
  return (
    <Pane title={sys?.name || moonDef?.name || bodyId}>
      <p style={S.p}>{sys?.blurb || moonDef?.note}</p>
      <div style={S.hr} />
      <div style={S.small}>
        {feats.length
          ? "Pick a place on the map, or from the list."
          : "Nothing catalogued here yet — this body is on the board to prove the ladder, not the content."}
      </div>
    </Pane>
  );
}

// ===========================================================================
// The feature card — the shape of a played assignment.
// ===========================================================================
function FeatureCard({ f, tier, shot, onShoot, onClose }) {
  const CONF = {
    measured:   ["Measured", "Directly observed or measured by spacecraft."],
    inferred:   ["Inferred", "Worked out from indirect evidence. The estimate could move."],
    hypothesis: ["Hypothesis", "One explanation among several. Not settled."],
  };
  const [cLabel, cHint] = CONF[f.confidence] || CONF.inferred;

  return (
    <Pane title={shot ? f.name : "Assignment"} onClose={onClose}>
      {!shot ? (
        <>
          <div style={S.subject}>“{f.subject}”</div>
          <p style={S.clue}>{f[tier]}</p>
          <div style={S.small}>
            Clue tier: <b>{tier}</b> — easy names the system and the world; medium names
            the world only; hard names neither.
          </div>
          <button style={S.cta} onClick={onShoot}>📷 Take the shot</button>
        </>
      ) : (
        <>
          <div style={S.subject}>{f.subject}</div>
          <p style={S.p}>{f.fact}</p>

          <div style={S.compare}>
            <div style={S.compareLabel}>To give you a sense of it</div>
            {f.earthComparison}
          </div>

          <div style={S.origin}>
            <div style={S.compareLabel}>Who named it</div>
            <p style={{ ...S.p, marginTop: 4 }}>{f.nameOrigin.text}</p>
            <p style={{ ...S.small, marginTop: 6 }}>{f.nameOrigin.theme}</p>
          </div>

          <div style={S.conf} title={cHint}>
            <b>{cLabel}</b> — {cHint}
          </div>
          {f.diameterKm && (
            <Stat label="Across" value={`${Math.round(f.diameterKm * 0.621371).toLocaleString()} miles (${f.diameterKm.toLocaleString()} km)`} />
          )}
        </>
      )}
    </Pane>
  );
}

// ===========================================================================
// Small shared pieces
// ===========================================================================
function Breadcrumb({ view, back }) {
  const sys = view.system && SYSTEM_BY_ID[view.system];
  const moonDef = view.body && Object.values(MOONS).flat().find((m) => m.id === view.body);
  const bodyName = view.body && (SYSTEM_BY_ID[view.body]?.name || moonDef?.name);
  return (
    <div style={S.crumb}>
      {view.level !== "orrery" && (
        <button style={S.backBtn} onClick={back}>← Back <span style={S.kbd}>Esc</span></button>
      )}
      <span style={S.crumbText}>
        The Solar System{sys ? ` › ${sys.name}` : ""}{bodyName && bodyName !== sys?.name ? ` › ${bodyName}` : ""}
      </span>
    </div>
  );
}

const Pane = ({ title, children, onClose }) => (
  <div>
    <div style={S.paneHead}>
      <h2 style={S.h2}>{title}</h2>
      {onClose && <button style={S.x} onClick={onClose} aria-label="Close">✕</button>}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, hint }) => (
  <div style={S.stat}>
    <div style={S.statLabel}>{label}</div>
    <div style={S.statValue}>{value}</div>
    {hint && <div style={S.small}>{hint}</div>}
  </div>
);

const Btn = ({ children, onClick, label, wide }) => (
  <button onClick={onClick} aria-label={label} title={label}
    style={{ ...S.btn, minWidth: wide ? 92 : 46 }}>{children}</button>
);

const Toggle = ({ value, onChange, options, label }) => (
  <div role="group" aria-label={label} style={S.toggle}>
    {options.map(([v, l]) => (
      <button key={v} onClick={() => onChange(v)}
        aria-pressed={value === v}
        style={{ ...S.toggleBtn, ...(value === v ? S.toggleOn : null) }}>{l}</button>
    ))}
  </div>
);

// ===========================================================================
// Styles. Inline for the spike — a real build lifts these out.
// ===========================================================================
const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
    padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--panel)", flexWrap: "wrap",
  },
  title: { fontSize: 19, fontWeight: 700, letterSpacing: 3, color: "var(--gold)" },
  sub: { fontSize: 11, color: "var(--muted)", letterSpacing: 0.4 },
  clock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 380 },
  dateLine: { fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  row: { display: "flex", gap: 6, alignItems: "center" },
  slider: { width: 360, accentColor: "#F2B441" },

  main: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, position: "relative", display: "flex", flexDirection: "column", minWidth: 0 },
  svg: { flex: 1, minHeight: 0, width: "100%", display: "block" },

  crumb: {
    position: "absolute", top: 12, left: 16, zIndex: 2,
    display: "flex", alignItems: "center", gap: 12,
  },
  crumbText: { fontSize: 12, color: "var(--muted)", letterSpacing: 0.5 },
  backBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6,
    padding: "5px 10px", cursor: "pointer", fontSize: 13,
  },
  kbd: { fontSize: 10, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px", marginLeft: 6 },

  panel: {
    width: 380, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)",
    padding: 20, overflowY: "auto",
  },
  paneHead: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 },
  h2: { margin: "0 0 10px", fontSize: 20, letterSpacing: 0.2 },
  x: { background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 },
  p: { margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 },
  small: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },
  hr: { height: 1, background: "var(--line)", margin: "14px 0" },

  stat: { padding: "9px 0", borderTop: "1px solid var(--line)" },
  statLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" },

  cta: {
    marginTop: 16, width: "100%", padding: "11px 14px", borderRadius: 8, cursor: "pointer",
    background: "var(--gold)", color: "#1A1200", border: "none", fontWeight: 700, fontSize: 15,
  },
  listItem: {
    display: "block", width: "100%", textAlign: "left", marginTop: 8, padding: "10px 12px",
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer",
  },
  tag: {
    marginLeft: 8, fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)",
    borderRadius: 10, padding: "1px 7px", verticalAlign: "middle",
  },

  subject: { fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.35 },
  clue: { fontSize: 15, lineHeight: 1.65, margin: "0 0 14px", color: "#DCE3F0" },
  compare: {
    background: "var(--panel-2)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0",
    padding: "10px 12px", fontSize: 14, lineHeight: 1.55, marginBottom: 12,
  },
  compareLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 },
  origin: {
    background: "var(--panel-2)", borderLeft: "3px solid var(--hot)", borderRadius: "0 8px 8px 0",
    padding: "10px 12px", marginBottom: 12,
  },
  conf: { fontSize: 12, color: "var(--muted)", padding: "8px 0", lineHeight: 1.5 },

  btn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6,
    padding: "5px 8px", cursor: "pointer", fontSize: 12,
  },
  toggle: { display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" },
  toggleBtn: { background: "var(--panel-2)", border: "none", padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  toggleOn: { background: "var(--gold)", color: "#1A1200", fontWeight: 700 },

  pinLabel: { fontSize: 12, fill: "#B9C2D4", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit" },
  sunLabel: { fontSize: 14, fill: "#F2B441", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit", fontWeight: 600 },
  beltLabel: { fontSize: 11, fill: "#8A8073", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit", letterSpacing: 1 },
  plateTitle: { fontSize: 18, fill: "#E8EAF0", fontWeight: 700, fontFamily: "inherit" },
  plateAxis: { fontSize: 11, fill: "#8A94A8", fontFamily: "inherit" },
  empty: { fontSize: 14, fill: "#8A94A8", textAnchor: "middle", fontFamily: "inherit" },
};
