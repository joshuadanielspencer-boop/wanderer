// ===========================================================================
// DAY & NIGHT LAB — what "the terminator" is, made obvious.
//
// A window onto src/illumination.js. Pick a world, drag the clock, and watch the
// day/night line — the terminator — sweep across the surface at the body's real
// day length. This is the panel that answers "what is the terminator?" by
// showing one moving.
// ===========================================================================
import { useEffect, useRef, useState } from "react";
import { LabBar, Card, Stat, Segmented, Slider, S, useTitle } from "./kit.jsx";
import { ROTATION, saySolarDay } from "../data/bodies.js";
import { subsolarLon, subsolarLat, isLit, sunAltitude, lightQuality, nightSpans } from "../illumination.js";

const DAY = 86400000;
// Worlds we hold a real map plate for, plus a couple that render on colour alone.
const WORLDS = [
  { id: "earth", name: "Earth" },
  { id: "mars", name: "Mars", plate: true },
  { id: "mercury", name: "Mercury", plate: true },
  { id: "europa", name: "Europa", plate: true },
  { id: "titan", name: "Titan" },
  { id: "venus", name: "Venus" },
];
const t0 = Date.UTC(2035, 0, 1);

export default function DayNightLab() {
  useTitle("Day, night & seasons");
  const [bodyId, setBodyId] = useState("mars");
  const [hours, setHours] = useState(0);       // hours since the epoch
  const [seasonDays, setSeasonDays] = useState(0);
  const [playing, setPlaying] = useState(true);
  const world = WORLDS.find((w) => w.id === bodyId);
  const rot = ROTATION[bodyId];

  // Run the clock. One real second ≈ one-twentieth of this world's day, so the
  // terminator visibly crawls whatever the true day length is.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setHours((h) => h + rot.solarDayH / 40), 40);
    return () => clearInterval(id);
  }, [playing, bodyId, rot.solarDayH]);

  const t = t0 + hours * 3600000 + seasonDays * DAY;
  const subLat = subsolarLat(bodyId, t);

  return (
    <div style={S.page}>
      <LabBar title="Day, night & seasons" sub="the terminator is the line between them" />
      <div style={S.body}>
        <p style={S.lead}>
          <b>The terminator</b> is the boundary between a world's sunlit half and its
          dark half — the line dawn and dusk sit on. It sweeps across the surface as
          the world turns, at that world's <i>real</i> day length. In SOLBOUND you
          can't survey the dark side, so arriving at the wrong local time is a real
          miss. Drag the clock and watch it move.
        </p>

        <Card title="World">
          <Segmented value={bodyId} onChange={(id) => { setBodyId(id); setHours(0); }}
            options={WORLDS.map((w) => ({ value: w.id, label: w.name }))} />
        </Card>

        <Card>
          <Plate bodyId={bodyId} plate={world.plate} t={t} />
          <div style={{ ...S.row, marginTop: 14, justifyContent: "space-between" }}>
            <button onClick={() => setPlaying((p) => !p)} style={{ ...S.home, minWidth: 90 }}>
              {playing ? "❚❚ Pause" : "▶ Run"}
            </button>
            <div style={{ ...S.note }}>Noon is where the sun sits directly overhead; the dark band is night.</div>
          </div>
          <div style={{ height: 14 }} />
          <Slider label="Time of day" min={0} max={rot.solarDayH} step={rot.solarDayH / 200}
            value={((hours % rot.solarDayH) + rot.solarDayH) % rot.solarDayH}
            format={(v) => `${(v / rot.solarDayH * 24).toFixed(1)}h of ${(rot.solarDayH / 24).toFixed(1)}-day`}
            onChange={(v) => { setPlaying(false); setHours(v); }} />
          <div style={{ height: 12 }} />
          <Slider label="Season (day of the year)" min={0} max={yearDays(bodyId)} step={yearDays(bodyId) / 200}
            value={seasonDays} format={() => seasonLabel(subLat)}
            onChange={(v) => setSeasonDays(v)} />
        </Card>

        <Card title="What this world's clock actually does">
          <div style={S.grid2}>
            <Stat label="A day here lasts" value={saySolarDay(bodyId)} />
            <Stat label="Axial tilt" value={rot.obliquity.toFixed(0)} unit="°" />
            <Stat label="Sun's latitude now" value={`${subLat >= 0 ? "+" : ""}${subLat.toFixed(0)}`} unit="°"
              tone="gold" />
          </div>
          <div style={S.teach}>{teachFor(bodyId, rot)}</div>
        </Card>
      </div>
    </div>
  );
}

// An equirectangular plate with the night side drawn over it, exactly as the
// game's body view does — same nightSpans() source, so what you see here is what
// the game gates a survey on.
function Plate({ bodyId, plate, t }) {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [bodyId]);
  const W = 720, H = 360;
  const px = (lon) => (lon / 360) * W;
  const py = (lat) => ((90 - lat) / 180) * H;
  const sunX = px(subsolarLon(bodyId, t)), sunY = py(subsolarLat(bodyId, t));
  const color = { earth: "#3E8FB0", titan: "#C9A05B", venus: "#D9A441" }[bodyId] || "#8A8073";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", display: "block" }}
      role="img" aria-label={`${bodyId}: the lit and dark halves right now`}>
      <clipPath id="pc"><rect x="0" y="0" width={W} height={H} /></clipPath>
      <g clipPath="url(#pc)">
        {plate && ok
          ? <image href={`${import.meta.env.BASE_URL}plates/${bodyId}.jpg`} x="0" y="0" width={W} height={H}
              preserveAspectRatio="none" onError={() => setOk(false)} />
          : <rect x="0" y="0" width={W} height={H} fill={color} opacity="0.35" />}
        {/* Night side as ONE composited layer. Each column is opaque and the
            group carries the transparency, so overlapping columns can't
            double-darken into vertical seams — the picket-fence artefact you get
            from stacking translucent rects. Columns overlap slightly to close
            subpixel gaps; because they're opaque, the overlap is invisible. */}
        <g opacity="0.74">
          {nightSpans(bodyId, t, 140).map((s, i) => (
            <rect key={i} x={px(s.lon0) - 0.6} y={py(s.latFrom)}
              width={px(s.lon1) - px(s.lon0) + 1.2}
              height={Math.max(0, py(s.latTo) - py(s.latFrom))}
              fill="#04070E" />
          ))}
        </g>
        {/* The sub-solar point: local noon, sun straight overhead. */}
        <circle cx={sunX} cy={sunY} r="7" fill="#FFD98A" stroke="#F2B441" strokeWidth="2" />
      </g>
      {[0, 90, 180, 270].map((l) => (
        <line key={l} x1={px(l)} y1="0" x2={px(l)} y2={H} stroke="#fff" strokeOpacity="0.08" />
      ))}
      <line x1="0" y1={py(0)} x2={W} y2={py(0)} stroke="#fff" strokeOpacity="0.18" strokeDasharray="4 6" />
      <text x="8" y="18" fill="#FFD98A" fontSize="12" fontFamily="inherit">☀ noon</text>
    </svg>
  );
}

const yearDays = (bodyId) => {
  const y = { earth: 365, mars: 687, mercury: 88, europa: 4333, titan: 10759, venus: 225 };
  return y[bodyId] || 365;
};
const seasonLabel = (lat) =>
  Math.abs(lat) < 3 ? "equinox" : lat > 0 ? "northern summer" : "southern summer";

function teachFor(bodyId, rot) {
  if (bodyId === "venus") return "Venus turns backwards and slower than it orbits — a day there is longer than its year, and the sun rises in the west. Watch the terminator crawl the other way.";
  if (bodyId === "mars") return "A Martian day is 24h 39m 35s — tantalisingly close to ours, but not the same, because Mars moves along its orbit while it spins.";
  if (bodyId === "titan") return "Titan is tidally locked to Saturn, so its day is its 16-Earth-day orbit. The terminator here moves at a walking pace over more than a week.";
  if (bodyId === "mercury") return "Mercury's spin and orbit are locked in a 3:2 dance, giving it a solar day about 176 Earth days long — two of its years.";
  if (rot.obliquity > 40) return "A large axial tilt gives this world violent seasons — drag the season slider and watch a whole pole fall into months of darkness.";
  return "Drag the season slider: as the sun's latitude swings north and south, one pole tips into permanent day and the other into polar night.";
}
