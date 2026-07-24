// ===========================================================================
// WANDERER — the fleet build.
//
// The first slice proved the launch-window decision is interesting. The
// playtest then showed what it needed next (docs/design.md §1.5): a real clock
// with time controls, and MORE THAN ONE SHIP — because fast-forward alone makes
// waiting free, and only a second hull sitting idle gives waiting a cost again.
//
// So this is one feature, not two: a continuous simulation you can pause, slow,
// speed up or skip through, with a fleet flying real transfer ellipses across
// an orrery whose planets keep moving the whole time.
// ===========================================================================
import { useEffect, useMemo, useState } from "react";
import { heliocentric, lightTimeSeconds, periodDays } from "./ephemeris.js";
import { project, orbitPath, moonLongitude, sayLightTime, sayDistance, logRadius, linearRadius } from "./orrery.js";
import { transferOptions } from "./transfer.js";
import { SYSTEMS, SYSTEM_BY_ID, MOONS, DELTA_V_FROM_LEO } from "./data/bodies.js";
import { FEATURES_BY_BODY } from "./data/features.js";
import { isLit, sunAltitude, lightQuality, nightSpans, nextSunrise } from "./illumination.js";
import { saySolarDay } from "./data/bodies.js";
import {
  newSim, advance, nextEvent, orderTransfer, standDown, craftPosition, craftPath,
  shoot, simStatus, featureById, RATES, END_DATE, START_DATE,
} from "./sim.js";

const VB = 1000;
const CX = VB / 2, CY = VB / 2, BOARD_R = 430;
const DAY = 86400000;

const fmtDate = (d) => new Date(d).toLocaleDateString("en-US",
  { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDays = (n) =>
  n < 60 ? `${Math.round(n)} days` : n < 700 ? `${(n / 30.44).toFixed(0)} months` : `${(n / 365.25).toFixed(1)} years`;
const yearsLeft = (t) => {
  const y = (END_DATE - t) / (365.25 * DAY);
  return y < 1 ? `${Math.max(0, Math.round(y * 12))} months` : `${y.toFixed(1)} years`;
};
const dotFor = (radiusKm, k = 1) =>
  Math.max(4, Math.min(26, Math.pow(radiusKm || 1000, 0.25) * 1.35)) * k;

export default function Wanderer() {
  const [sim, setSim] = useState(null);            // null = free look
  const [freeDate, setFreeDate] = useState(() => new Date(Date.UTC(2026, 6, 21)));
  const [view, setView] = useState({ level: "orrery", system: null, body: null });
  const [selected, setSelected] = useState(null);  // free look: highlighted planet
  const [ship, setShip] = useState(null);          // sim: selected craft id
  const [transfer, setTransfer] = useState(null);
  const [result, setResult] = useState(null);
  const [feature, setFeature] = useState(null);    // free look inspection
  const [notice, setNotice] = useState(null);
  const [darkSite, setDarkSite] = useState(null);   // clicked a site in local night
  const [tier, setTier] = useState("easy");
  const [trueScale, setTrueScale] = useState(false);

  const now = sim ? sim.t : freeDate.getTime();
  const status = sim ? simStatus(sim) : null;

  // ---- the world clock ----------------------------------------------------
  // It stops itself the moment a ship arrives — otherwise fast-forward sails
  // straight past the event the player sped up in order to reach.
  //
  // setInterval rather than requestAnimationFrame, deliberately. rAF is the
  // reflex choice for animation and it is wrong here: browsers throttle it to
  // ZERO in a tab that isn't visible, so the clock silently stops whenever the
  // player looks away, and it cannot be exercised by an automated check at all
  // (which is how this was found — rAF never fired once in the test harness).
  // 30 fps is more than enough for an orrery, and dt is measured from the wall
  // clock rather than assumed, so a throttled or stuttering tab slows the
  // simulation down instead of desynchronising it.
  useEffect(() => {
    if (!sim || RATES[sim.rateIdx].days === 0) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      // Clamp: after a long stall (backgrounded tab, blocked main thread) the
      // gap can be minutes. Advancing by that would teleport the fleet past
      // arrivals the player never saw.
      const dt = Math.min(150, now - last);
      last = now;
      setSim((s) => {
        if (!s) return s;
        const { sim: ns, fired } = advance(s, s.t + RATES[s.rateIdx].days * (dt / 1000) * DAY);
        const arrival = fired.find((f) => f.kind === "arrive");
        if (arrival) {
          queueMicrotask(() => setNotice(
            `${arrival.craftName} has arrived at ${SYSTEM_BY_ID[arrival.at]?.name || arrival.at}.`));
          return { ...ns, rateIdx: 0 };
        }
        return ns;
      });
    }, 33);
    return () => clearInterval(id);
  }, [sim?.rateIdx, sim === null]);

  const skipToEvent = () => setSim((s) => {
    const e = nextEvent(s);
    if (!e) return s;
    const { sim: ns, fired } = advance(s, e.t);
    const a = fired.find((f) => f.kind === "arrive");
    if (a) setNotice(`${a.craftName} has arrived at ${SYSTEM_BY_ID[a.at]?.name || a.at}.`);
    return { ...ns, rateIdx: 0 };
  });

  const setRate = (i) => setSim((s) => ({ ...s, rateIdx: i }));

  // ---- geometry -----------------------------------------------------------
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

  const positions = useMemo(() => {
    const out = {};
    for (const s of SYSTEMS) if (s.ephemerisKey) out[s.id] = heliocentric(s.ephemerisKey, new Date(now));
    return out;
  }, [now]);

  // ---- navigation ---------------------------------------------------------
  const enterSystem = (id) => { setView({ level: "system", system: id, body: null }); setSelected(null); };

  const clickSystem = (id) => {
    const sys = SYSTEM_BY_ID[id];
    if (!sys || sys.kind === "belt") return;
    if (!sim) return enterSystem(id);

    const c = sim.craft.find((x) => x.id === ship);
    if (!c || c.at === id || c.status === "transit") return enterSystem(id);

    const from = SYSTEM_BY_ID[c.at];
    if (!from?.ephemerisKey) return enterSystem(id);
    setTransfer({ to: id, craft: c, choice: transferOptions(from.ephemerisKey, sys.ephemerisKey, new Date(sim.t)) });
  };

  const commit = (which) => {
    setSim((s) => orderTransfer(s, transfer.craft.id, transfer.to, which));
    setTransfer(null);
  };

  const openBody = (systemId, bodyId) => { setView({ level: "body", system: systemId, body: bodyId }); setFeature(null); };
  const back = () => {
    setFeature(null);
    if (view.level === "body") setView({ level: "system", system: view.system, body: null });
    else setView({ level: "orrery", system: null, body: null });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === " " && sim && !transfer && !result) { e.preventDefault(); setRate(sim.rateIdx ? 0 : 1); return; }
      if (e.key !== "Escape") return;
      if (transfer) return setTransfer(null);
      if (darkSite) return setDarkSite(null);
      if (result) return setResult(null);
      if (feature) return setFeature(null);
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- shooting -----------------------------------------------------------
  const onPick = (f) => {
    if (!sim) return setFeature(f);
    // You must actually BE at a world to photograph it. Without this the fleet
    // is decoration and the entire travel layer is optional.
    const here = sim.craft.some((c) => c.status !== "transit" && c.at === view.system);
    if (!here) return setNotice(`No ship is at ${SYSTEM_BY_ID[view.system]?.name}. Send one first.`);

    // And it has to be daylight. This is the whole point of the terminator:
    // arriving at the right place at the wrong local time is now a real miss.
    const alt = sunAltitude(view.body, f.lat, f.lonE, sim.t);
    if (alt <= 0) return setDarkSite({ f, body: view.body });

    const q = lightQuality(alt);
    // A raking sun throws long shadows and shows relief; an overhead sun washes
    // the landscape flat. Real imaging campaigns are planned around exactly
    // this, so it is worth points rather than just a caption.
    const bonus = q.key === "raking" ? 50 : q.key === "flat" ? -25 : 0;
    const r = shoot(sim, f.id, tier, bonus);
    setSim(r.sim);
    setResult({ f, ...r, quality: q, alt });
  };

  if (sim && status !== "running") {
    return <Summary sim={sim} status={status} onAgain={() => { setSim(null); setResult(null); setShip(null); }} />;
  }

  return (
    <div style={S.app}>
      <Header
        sim={sim} freeDate={freeDate} setFreeDate={setFreeDate}
        setRate={setRate} skip={skipToEvent} trueScale={trueScale} setTrueScale={setTrueScale}
        tier={tier} setTier={setTier}
        onQuit={() => { setSim(null); setShip(null); setResult(null); setView({ level: "orrery", system: null, body: null }); }}
      />

      <Provisional />

      <div style={S.main}>
        <div style={S.stage}>
          <Breadcrumb view={view} back={back} />
          {notice && <Notice text={notice} onClose={() => setNotice(null)} />}
          <svg viewBox={`0 0 ${VB} ${VB}`} style={S.svg} role="group" aria-label="Map">
            {view.level === "orrery" && (
              <OrreryView positions={positions} orbits={orbits} trueScale={trueScale} t={now}
                selected={selected} onSelect={setSelected} onOpen={clickSystem} sim={sim} ship={ship} />
            )}
            {view.level === "system" && <SystemView systemId={view.system} date={new Date(now)} onOpen={openBody} />}
            {view.level === "body" && (
              <BodyView bodyId={view.body} onPick={onPick} picked={feature} hideNames={!!sim} t={now} />
            )}
          </svg>
        </div>

        <aside style={S.panel} aria-live="polite">
          {darkSite ? <DarkSiteCard d={darkSite} t={sim.t}
                        onWait={(until) => { setSim((sm) => advance(sm, until).sim); setDarkSite(null); }}
                        onClose={() => setDarkSite(null)} />
            : result ? <ShotResult r={result} onClose={() => setResult(null)} />
            : sim ? <FleetPanel sim={sim} ship={ship} setShip={setShip} tier={tier} view={view}
                      onStandDown={(id) => setSim((s) => standDown(s, id))} />
              : feature ? <FeatureCard f={feature} tier={tier} onClose={() => setFeature(null)} />
                : view.level === "orrery"
                  ? <FreeLookPanel id={selected} positions={positions} date={new Date(now)} onOpen={enterSystem}
                      onStart={() => { setSim(newSim((now / 1000) % 100000 | 0, tier)); setShip("ship-0"); }} tier={tier} />
                  : view.level === "system" ? <SystemPanel systemId={view.system} date={new Date(now)} onOpen={openBody} />
                    : <BodyPanel bodyId={view.body} />}
        </aside>
      </div>

      {transfer && <TransferModal t={transfer} onGo={commit} onCancel={() => setTransfer(null)} />}
    </div>
  );
}

// ===========================================================================
// Header — the clock lives here now
// ===========================================================================
function Header({ sim, freeDate, setFreeDate, setRate, skip, trueScale, setTrueScale, tier, setTier, onQuit }) {
  const MIN = Date.UTC(2020, 0, 1), MAX = Date.UTC(2050, 0, 1);
  const step = (days) => setFreeDate((d) => new Date(d.getTime() + days * DAY));
  const ev = sim ? nextEvent(sim) : null;

  return (
    <header style={S.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="#/" title="All systems" aria-label="Back to all systems"
          style={{ textDecoration: "none", color: "var(--muted)", fontSize: 18, border: "1px solid var(--line)",
            borderRadius: 8, padding: "3px 10px", background: "var(--panel-2)" }}>☰</a>
        <div>
          <div style={S.title}>SOLBOUND</div>
          <div style={S.sub}>the fleet — a live solar system</div>
        </div>
      </div>

      {sim ? (
        <div style={S.hud}>
          <div style={{ minWidth: 166 }}>
            <div style={S.statLabel}>Mission date</div>
            <div style={S.statValue}>{fmtDate(sim.t)}</div>
            <div style={S.small}>charter ends 2050 · {yearsLeft(sim.t)} left</div>
          </div>

          <div>
            <div style={S.statLabel}>Time <span style={S.kbd}>Space</span></div>
            <div style={S.row}>
              {RATES.map((r, i) => (
                <button key={i} onClick={() => setRate(i)} aria-pressed={sim.rateIdx === i}
                  aria-label={r.name} title={r.name}
                  style={{ ...S.rateBtn, ...(sim.rateIdx === i ? S.toggleOn : null) }}>{r.label}</button>
              ))}
              <button onClick={skip} disabled={!ev} style={{ ...S.btn, marginLeft: 6, opacity: ev ? 1 : 0.4 }}
                aria-label="Skip to the next arrival or departure"
                title={ev ? `Skip to ${fmtDate(ev.t)}` : "Nothing scheduled"}>⏭ Next event</button>
            </div>
            <div style={S.small}>
              {ev ? `Next: ${ev.kind === "arrive" ? "arrival" : "departure"} ${fmtDate(ev.t)}` : "Nothing under way"}
            </div>
          </div>

          <div style={{ minWidth: 62 }}>
            <div style={S.statLabel}>Score</div>
            <div style={S.statValue}>{sim.score}</div>
          </div>
        </div>
      ) : (
        <div style={S.clock}>
          <div style={S.dateLine}>{fmtDate(freeDate)}</div>
          <div style={S.row}>
            <Btn onClick={() => step(-365)} label="Back one year">−1y</Btn>
            <Btn onClick={() => step(-30)} label="Back one month">−1m</Btn>
            <Btn onClick={() => step(30)} label="Forward one month">+1m</Btn>
            <Btn onClick={() => step(365)} label="Forward one year">+1y</Btn>
          </div>
          <input type="range" min={MIN} max={MAX} step={DAY} value={freeDate.getTime()}
            onChange={(e) => setFreeDate(new Date(+e.target.value))} style={S.slider} aria-label="Date" />
        </div>
      )}

      <div style={S.row}>
        {sim ? <Btn onClick={onQuit} label="Abandon the charter" wide>Abandon</Btn>
          : <Toggle value={tier} onChange={setTier} label="Clue tier"
              options={[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]]} />}
        <Btn onClick={() => setTrueScale((v) => !v)} label="Toggle true distance scale" wide>
          {trueScale ? "◉ True scale" : "◎ Log scale"}
        </Btn>
      </div>
    </header>
  );
}

// ===========================================================================
// The orrery, now with ships on it
// ===========================================================================
function OrreryView({ positions, orbits, trueScale, t, selected, onSelect, onOpen, sim, ship }) {
  const opts = { cx: CX, cy: CY, radius: BOARD_R, trueScale };
  const selCraft = sim?.craft.find((c) => c.id === ship);

  return (
    <g>
      <defs>
        <radialGradient id="sunGlow">
          <stop offset="0%" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#F2B441" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#F2B441" stopOpacity="0" />
        </radialGradient>
      </defs>

      {SYSTEMS.filter((s) => s.kind === "belt").map((s) => {
        const scale = trueScale ? linearRadius : logRadius;
        const inner = scale(s.auHint * 0.82) * BOARD_R, outer = scale(s.auHint * 1.22) * BOARD_R;
        return (
          <g key={s.id}>
            <circle cx={CX} cy={CY} r={(inner + outer) / 2} fill="none" stroke="#8A8073"
              strokeOpacity={0.20} strokeWidth={outer - inner} strokeDasharray="2 7" />
            <text x={CX} y={CY - (outer + inner) / 2 - 6} style={S.beltLabel}>{s.name}</text>
          </g>
        );
      })}

      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => (
        <path key={s.id} d={orbitPath(orbits[s.id], opts)} fill="none"
          stroke={selected === s.id ? s.color : "#26324a"}
          strokeWidth={selected === s.id ? 2 : 1} strokeOpacity={selected === s.id ? 0.9 : 0.55} />
      ))}

      <circle cx={CX} cy={CY} r={110} fill="url(#sunGlow)" />
      <circle cx={CX} cy={CY} r={13} fill="#F2B441" />
      <text x={CX} y={CY + 34} style={S.sunLabel}>The Sun</text>

      {/* Flight paths, under the planets. The arc is the real transfer ellipse
          (craftPath → transferPosition), not a line between two dots. A straight
          line would be three lines of code and would teach that spacecraft fly
          AT planets rather than falling around the Sun to meet them. */}
      {sim?.craft.filter((c) => c.leg).map((c) => {
        const pts = craftPath(c, 60).map((p) => project(p.r, p.lon, opts));
        const d = pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
        const mine = c.id === ship;
        return (
          <path key={c.id} d={d} fill="none" stroke={mine ? "#F2B441" : "#4E6180"}
            strokeWidth={mine ? 2 : 1.5} strokeDasharray="5 6"
            strokeOpacity={c.status === "transit" ? 0.85 : 0.35} />
        );
      })}

      {SYSTEMS.filter((s) => s.ephemerisKey).map((s) => {
        const p = positions[s.id];
        const { x, y } = project(p.r, p.lon, opts);
        const on = selected === s.id;
        const docked = sim?.craft.filter((c) => c.status !== "transit" && c.at === s.id) || [];
        const hasMine = docked.some((c) => c.id === ship);
        const r = dotFor(s.radiusKm, s.id === "pluto" ? 1.4 : 1);
        const act = () => ((on || !sim || selCraft) ? onOpen(s.id) : onSelect(s.id));
        return (
          <g key={s.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${s.name}.${docked.length ? ` ${docked.map((c) => c.name).join(" and ")} here.` : ""} ${sayDistance(p.r)} from the Sun.`}
            onClick={act}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } }}>
            <circle cx={x} cy={y} r={Math.max(20, r + 12)} fill="transparent" />
            {hasMine && <circle cx={x} cy={y} r={r + 14} fill="none" stroke="#F2B441" strokeWidth={1.5} strokeDasharray="3 4" />}
            {on && <circle cx={x} cy={y} r={r + 9} fill="none" stroke={s.color} strokeWidth={2} strokeOpacity={0.8} />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth={1.5} />
            <text x={x} y={y - r - 9} style={{ ...S.pinLabel, fill: on || hasMine ? "#fff" : "#B9C2D4" }}>
              {s.name}
            </text>
            {/* Docked ships as small ticks under the world rather than as text
                in its label: with two hulls at Earth the label became a run-on
                that overlapped Mars. Shape, not colour, so it survives a
                colourblind reading (rule 4); the names live in the panel. */}
            {docked.map((c, i) => (
              <rect key={c.id} x={x - (docked.length * 5) / 2 + i * 5} y={y + r + 4}
                width={3} height={6} rx={1}
                fill={c.id === ship ? "#F2B441" : "#8FA0BC"} />
            ))}
          </g>
        );
      })}

      {sim?.craft.filter((c) => c.status === "transit").map((c) => {
        const pos = craftPosition(c, t);
        if (!pos) return null;
        const { x, y } = project(pos.r, pos.lon, opts);
        const mine = c.id === ship;
        const f = (t - c.leg.departT) / (c.leg.arriveT - c.leg.departT);
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r={mine ? 6 : 4.5} fill={mine ? "#F2B441" : "#C9CFDC"} stroke="#070A12" strokeWidth={1.5} />
            <text x={x} y={y + 16} style={{ ...S.shipLabel, fill: mine ? "#F2B441" : "#8FA0BC" }}>
              {c.name} · {Math.round(f * 100)}%
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ===========================================================================
// Fleet + job board
// ===========================================================================
function FleetPanel({ sim, ship, setShip, tier, onStandDown, view }) {
  return (
    <div>
      <h2 style={S.h2}>Fleet</h2>
      {sim.craft.map((c) => {
        const sel = c.id === ship;
        const where = c.status === "transit"
          ? `${SYSTEM_BY_ID[c.leg.from]?.name} → ${SYSTEM_BY_ID[c.leg.to]?.name}`
          : c.status === "waiting"
            ? `at ${SYSTEM_BY_ID[c.at]?.name} · departs ${fmtDate(c.leg.departT)}`
            : `docked at ${SYSTEM_BY_ID[c.at]?.name}`;
        const pct = Math.max(0, c.fuel / c.fuelMax);
        return (
          <div key={c.id} style={{ ...S.ship, ...(sel ? S.shipSel : null) }}>
            <button style={S.shipBtn} onClick={() => setShip(c.id)} aria-pressed={sel}>
              <div style={S.shipTop}>
                <b>{sel ? "▸ " : ""}{c.name}</b>
                <span style={S.small}>{c.fuel.toFixed(1)} km/s</span>
              </div>
              <div style={S.small}>{where}</div>
              {c.status === "transit" && (
                <div style={S.gaugeTrack}>
                  <div style={{ ...S.gaugeFill, background: "#4E6180",
                    width: `${Math.round(100 * (sim.t - c.leg.departT) / (c.leg.arriveT - c.leg.departT))}%` }} />
                </div>
              )}
              <div style={S.gaugeTrack}>
                <div style={{ ...S.gaugeFill, width: `${pct * 100}%`, background: pct < 0.25 ? "var(--hot)" : "var(--gold)" }} />
              </div>
            </button>
            {c.status === "waiting" && (
              <button style={S.tinyBtn} onClick={() => onStandDown(c.id)}>Stand down — free, the burn hasn't happened</button>
            )}
          </div>
        );
      })}

      <div style={S.hr} />
      <h2 style={S.h2}>Open assignments</h2>
      <div style={S.small}>
        Any ship's photograph counts for any job. Pick a ship above, then click a world.
      </div>
      {sim.board.map((id) => {
        const f = featureById(id);
        return (
          <div key={id} style={S.job}>
            <div style={S.jobSubject}>“{f.subject}”</div>
            <div style={S.small}>{f[tier]}</div>
          </div>
        );
      })}
      {view.level === "body" && (
        <div style={{ ...S.small, marginTop: 12 }}>Click a place on the map to photograph it.</div>
      )}
    </div>
  );
}

// ===========================================================================
// Travel decision
// ===========================================================================
function TransferModal({ t, onGo, onCancel }) {
  const { to, choice, craft } = t;
  const sys = SYSTEM_BY_ID[to], from = SYSTEM_BY_ID[craft.at];
  const affordNow = choice.goNow.dv <= craft.fuel, affordWait = choice.window.dv <= craft.fuel;
  const saving = choice.goNow.dv - choice.window.dv;

  return (
    <div style={S.scrim} role="dialog" aria-modal="true" aria-label={`Send ${craft.name} to ${sys.name}`}>
      <div style={S.modal}>
        <h2 style={S.h2}>{craft.name}: {from.name} → {sys.name}</h2>
        <p style={S.small}>
          The cheapest route is a Hohmann transfer. It only works when {sys.name} is{" "}
          {Math.abs(choice.idealPhaseDeg).toFixed(0)}° {choice.idealPhaseDeg >= 0 ? "ahead of" : "behind"} you.
          Right now it is off by {Math.abs(choice.offByDeg).toFixed(0)}°. {craft.name} has {craft.fuel.toFixed(1)} km/s.
        </p>
        <PhaseDiagram choice={choice} fromColor={from.color} toColor={sys.color} />
        <div style={S.options}>
          <Option title="Leave now" dv={choice.goNow.dv} depart={choice.goNow.departs}
            flight={choice.goNow.days} afford={affordNow}
            note={saving > 0.05 ? `${saving.toFixed(1)} km/s more — fighting the geometry.` : "The geometry is already good."}
            onGo={() => onGo("goNow")} />
          <Option title={choice.window.waitDays > 0 ? `Wait ${fmtDays(choice.window.waitDays)}` : "Window is open"}
            dv={choice.window.dv} depart={choice.window.departs} flight={choice.window.days}
            afford={affordWait} best={saving > 0.05}
            note={`Returns every ${fmtDays(choice.synodicDays)}. This hull earns nothing until then.`}
            onGo={() => onGo("window")} />
        </div>
        {!affordNow && !affordWait && (
          <p style={S.warn}>{craft.name} cannot afford either route. Send a different ship, or a nearer world.</p>
        )}
        <button style={S.ghost} onClick={onCancel}>Cancel <span style={S.kbd}>Esc</span></button>
      </div>
    </div>
  );
}

function PhaseDiagram({ choice, fromColor, toColor }) {
  const R1 = 34, R2 = 62, cx = 150, cy = 78;
  const at = (r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = at(R1, 180);
  const [nx, ny] = at(R2, 180 + choice.actualPhaseDeg);
  const [wx, wy] = at(R2, 180 + choice.idealPhaseDeg);
  return (
    <svg viewBox="0 0 300 156" style={S.diagram} role="img"
      aria-label={`Target is ${Math.abs(choice.offByDeg).toFixed(0)} degrees from the ideal departure position.`}>
      <circle cx={cx} cy={cy} r={R1} fill="none" stroke="#26324a" />
      <circle cx={cx} cy={cy} r={R2} fill="none" stroke="#26324a" />
      <circle cx={cx} cy={cy} r={6} fill="#F2B441" />
      <circle cx={ax} cy={ay} r={6} fill={fromColor} />
      <circle cx={wx} cy={wy} r={9} fill="none" stroke="#F2B441" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx={nx} cy={ny} r={6} fill={toColor} />
      <text x={wx} y={wy - 14} style={S.diagLabel}>needs to be here</text>
      <text x={nx} y={ny + 20} style={S.diagLabel}>is here now</text>
      <text x={ax} y={ay + 20} style={S.diagLabel}>you</text>
    </svg>
  );
}

function Option({ title, dv, depart, flight, afford, best, note, onGo }) {
  return (
    <div style={{ ...S.option, ...(best ? S.optionBest : null) }}>
      <div style={S.optionTitle}>{title}{best && <span style={S.tag}>cheaper</span>}</div>
      <div style={S.bigNum}>{dv.toFixed(1)} <span style={S.unit}>km/s</span></div>
      <div style={S.small}>Departs {fmtDate(depart)}</div>
      <div style={S.small}>Flight {fmtDays(flight)} · arrives {fmtDate(depart.getTime() + flight * DAY)}</div>
      <div style={{ ...S.small, marginTop: 6 }}>{note}</div>
      <button style={{ ...S.cta, opacity: afford ? 1 : 0.4 }} disabled={!afford} onClick={onGo}>
        {afford ? "Go" : "Not enough propellant"}
      </button>
    </div>
  );
}

// ===========================================================================
// Result / summary / free-look panels
// ===========================================================================
const CONF = {
  measured: ["Measured", "Directly observed or measured by spacecraft."],
  inferred: ["Inferred", "Worked out from indirect evidence. The estimate could move."],
  hypothesis: ["Hypothesis", "One explanation among several. Not settled."],
};
const ConfidenceLine = ({ f }) => {
  const [label, hint] = CONF[f.confidence] || CONF.inferred;
  return (
    <div style={S.conf}>
      <b>{label}</b> — {hint}
      <div style={{ marginTop: 4, opacity: 0.75 }}>
        (How settled the science is — not a check that this card is right. See the draft notice.)
      </div>
    </div>
  );
};

function ShotResult({ r, onClose }) {
  const f = r.f;
  if (!r.hit) {
    return (
      <Pane title="Nobody asked for this" onClose={onClose}>
        <p style={S.p}>That's <b>{f.name}</b> — {f.subject.toLowerCase()}. Not on the board.</p>
        <p style={S.small}>{f.fact}</p>
        <button style={S.cta} onClick={onClose}>Keep looking</button>
      </Pane>
    );
  }
  return (
    <Pane title={f.name} onClose={onClose}>
      <div style={S.points}>+{r.points}</div>
      <div style={S.subject}>{f.subject}</div>
      {r.quality && (
        <div style={{ ...S.small, marginBottom: 10 }}>
          <b style={{ color: r.quality.key === "raking" ? "var(--gold)" : "inherit" }}>{r.quality.label}</b>
          {" — "}{r.quality.note} Sun {r.alt.toFixed(0)}° above the horizon.
        </div>
      )}
      <p style={S.p}>{f.fact}</p>
      <div style={S.compare}>
        <div style={S.compareLabel}>To give you a sense of it</div>{f.earthComparison}
      </div>
      <div style={S.origin}>
        <div style={S.compareLabel}>Who named it</div>
        <p style={{ ...S.p, marginTop: 4 }}>{f.nameOrigin.text}</p>
        <p style={{ ...S.small, marginTop: 6 }}>{f.nameOrigin.theme}</p>
      </div>
      <ConfidenceLine f={f} />
      <button style={S.cta} onClick={onClose}>Back to the fleet</button>
    </Pane>
  );
}

/**
 * You pointed the camera at the night side.
 *
 * Deliberately not a punishment card. It names the real reason, gives the real
 * day length, and offers to wait — because the lesson is that lighting is
 * something you PLAN for, and the fix is patience rather than a lost turn.
 */
function DarkSiteCard({ d, t, onWait, onClose }) {
  const rise = nextSunrise(d.body, d.f.lat, d.f.lonE, t);
  const hours = rise ? (rise - t) / 3600000 : null;
  return (
    <Pane title="Local night" onClose={onClose}>
      <p style={S.p}>
        It is the middle of the night at that site. The Sun is below the horizon and
        there is nothing there to photograph.
      </p>
      <Stat label="A day here lasts" value={saySolarDay(d.body) || "—"} />
      {rise ? (
        <>
          <Stat label="Sunrise in"
            value={hours < 48 ? `${hours.toFixed(1)} hours` : `${(hours / 24).toFixed(1)} days`} />
          <button style={S.cta} onClick={() => onWait(rise)}>Wait for sunrise</button>
        </>
      ) : (
        <div style={S.warn}>
          This site is in polar night — it will not see the Sun again for a season.
          Come back when the year has turned, or photograph somewhere else.
        </div>
      )}
      <p style={{ ...S.small, marginTop: 12 }}>
        Every real imaging campaign is planned around light. A low sun casts long
        shadows and shows relief; an overhead sun washes a landscape flat.
      </p>
    </Pane>
  );
}

function Summary({ sim, status, onAgain }) {
  return (
    <div style={S.summaryWrap}>
      <div style={S.summary}>
        <div style={S.title}>{status === "expired" ? "THE CHARTER ENDS" : "HOMECOMING"}</div>
        <p style={S.p}>
          {status === "expired"
            ? "Twenty-two years, and some of the ships are still out there. Minimum-energy transfers are cheap in propellant and expensive in years — and years are the one thing nobody can buy more of."
            : `Every assignment filled: ${sim.completed.length} photographs, brought home by ${sim.craft.length} ships.`}
        </p>
        <div style={S.summaryStats}>
          <StatCard label="Score" value={sim.score} />
          <StatCard label="Photographs" value={sim.completed.length} />
          <StatCard label="Ended" value={fmtDate(sim.t)} />
          <StatCard label="Propellant left" value={`${sim.craft.reduce((a, c) => a + Math.max(0, c.fuel), 0).toFixed(0)} km/s`} />
        </div>
        <p style={S.small}>
          The charter opened {fmtDate(START_DATE)} and ran to 2050. Time passed because
          transfers take time — that is not a penalty, it is how far away everything is.
        </p>
        <button style={S.cta} onClick={onAgain}>Back to the orrery</button>
      </div>
    </div>
  );
}

const StatCard = ({ label, value }) => (
  <div style={S.statCard}>
    <div style={S.statLabel}>{label}</div>
    <div style={{ ...S.statValue, fontSize: 22 }}>{value}</div>
  </div>
);

function FreeLookPanel({ id, positions, date, onOpen, onStart, tier }) {
  if (!id) {
    return (
      <Pane title="The board">
        <p style={S.p}>
          Every planet is where it really is on <b>{fmtDate(date)}</b>, from JPL's
          Keplerian elements. Scrub the date and watch them line up — those
          alignments are what a launch window <i>is</i>.
        </p>
        <button style={S.cta} onClick={onStart}>Take the charter ({tier})</button>
        <p style={{ ...S.small, marginTop: 12 }}>
          Three ships, a board of assignments, and twenty-two years. Or keep
          clicking planets and just look around.
        </p>
      </Pane>
    );
  }
  const s = SYSTEM_BY_ID[id], p = positions[id];
  const lt = lightTimeSeconds("earth", s.ephemerisKey, date);
  const dv = DELTA_V_FROM_LEO[id];
  const e = positions.earth;
  const sep = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
  return (
    <Pane title={s.name}>
      <p style={S.p}>{s.blurb}</p>
      <Stat label="From the Sun" value={sayDistance(p.r)} />
      <Stat label="From Earth today" value={sayDistance(sep)} />
      <Stat label="A message home takes" value={sayLightTime(lt)} hint="one way, at the speed of light" />
      <Stat label="A year here lasts" value={`${(periodDays(s.ephemerisKey) / 365.25).toFixed(1)} Earth years`} />
      {dv && <Stat label="Δv from low Earth orbit" value={`${dv.orbit} km/s to orbit${dv.land ? ` · ${dv.land} to land` : ""}`} hint={dv.note} />}
      <button style={S.cta} onClick={() => onOpen(id)}>Look at {s.name} →</button>
    </Pane>
  );
}

function SystemPanel({ systemId, onOpen }) {
  const s = SYSTEM_BY_ID[systemId], moons = MOONS[systemId] || [];
  return (
    <Pane title={`The ${s.name} system`}>
      <p style={S.p}>{s.blurb}</p>
      <div style={S.hr} />
      <button style={S.listItem} onClick={() => onOpen(systemId, systemId)}><b>{s.name} itself</b></button>
      {moons.map((m) => (
        <button key={m.id} style={S.listItem} onClick={() => onOpen(systemId, m.id)}>
          <div><b>{m.name}</b></div><div style={S.small}>{m.note}</div>
        </button>
      ))}
    </Pane>
  );
}

function BodyPanel({ bodyId }) {
  const sys = SYSTEM_BY_ID[bodyId];
  const moonDef = Object.values(MOONS).flat().find((m) => m.id === bodyId);
  return (
    <Pane title={sys?.name || moonDef?.name || bodyId}>
      <p style={S.p}>{sys?.blurb || moonDef?.note}</p>
    </Pane>
  );
}

function FeatureCard({ f, tier, onClose }) {
  const [shot, setShot] = useState(false);
  useEffect(() => { setShot(false); }, [f]);
  return (
    <Pane title={shot ? f.name : "Free look"} onClose={onClose}>
      {!shot ? (
        <>
          <div style={S.subject}>“{f.subject}”</div>
          <p style={S.clue}>{f[tier]}</p>
          <button style={S.cta} onClick={() => setShot(true)}>📷 Take the shot</button>
        </>
      ) : (
        <>
          <div style={S.subject}>{f.subject}</div>
          <p style={S.p}>{f.fact}</p>
          <div style={S.compare}><div style={S.compareLabel}>To give you a sense of it</div>{f.earthComparison}</div>
          <div style={S.origin}>
            <div style={S.compareLabel}>Who named it</div>
            <p style={{ ...S.p, marginTop: 4 }}>{f.nameOrigin.text}</p>
            <p style={{ ...S.small, marginTop: 6 }}>{f.nameOrigin.theme}</p>
          </div>
          <ConfidenceLine f={f} />
        </>
      )}
    </Pane>
  );
}

// ===========================================================================
// Views 2 and 3
// ===========================================================================
function SystemView({ systemId, date, onOpen }) {
  const sys = SYSTEM_BY_ID[systemId], moons = MOONS[systemId] || [];
  const maxA = Math.max(...moons.map((m) => m.aKm), 1);
  const rOf = (aKm) => (Math.log(1 + (aKm / maxA) / 0.12) / Math.log(1 + 1 / 0.12)) * (BOARD_R - 60) + 60;
  const planetR = dotFor(sys.radiusKm, 2.2);
  return (
    <g>
      {moons.map((m) => <circle key={m.id} cx={CX} cy={CY} r={rOf(m.aKm)} fill="none" stroke="#26324a" strokeOpacity={0.6} />)}
      {systemId === "saturn" && (
        <ellipse cx={CX} cy={CY} rx={planetR * 2.3} ry={planetR * 2.3} fill="none"
          stroke="#D8C08A" strokeOpacity={0.35} strokeWidth={planetR * 0.75} />
      )}
      <g role="button" tabIndex={0} style={{ cursor: "pointer" }} aria-label={`${sys.name} itself.`}
        onClick={() => onOpen(systemId, systemId)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(systemId, systemId); } }}>
        <circle cx={CX} cy={CY} r={planetR} fill={sys.color} stroke="#070A12" strokeWidth={2} />
        <text x={CX} y={CY + planetR + 22} style={S.sunLabel}>{sys.name}</text>
      </g>
      {moons.map((m) => {
        const R = rOf(m.aKm), a = (moonLongitude(m, date) * Math.PI) / 180;
        const x = CX + R * Math.cos(a), y = CY - R * Math.sin(a), r = dotFor(m.radiusKm, 1.1);
        return (
          <g key={m.id} role="button" tabIndex={0} style={{ cursor: "pointer" }} aria-label={`${m.name}.`}
            onClick={() => onOpen(systemId, m.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(systemId, m.id); } }}>
            <circle cx={x} cy={y} r={Math.max(18, r + 10)} fill="transparent" />
            <circle cx={x} cy={y} r={r} fill="#C9CFDC" stroke="#070A12" strokeWidth={1.5} />
            <text x={x} y={y - r - 9} style={S.pinLabel}>{m.name}</text>
          </g>
        );
      })}
    </g>
  );
}

function BodyView({ bodyId, onPick, picked, hideNames, t }) {
  const [plate, setPlate] = useState(true);
  useEffect(() => { setPlate(true); }, [bodyId]);
  const feats = FEATURES_BY_BODY[bodyId] || [];
  const sys = SYSTEM_BY_ID[bodyId];
  const moonDef = Object.values(MOONS).flat().find((m) => m.id === bodyId);
  const color = sys?.color || "#9AA6B8";
  const W = 940, H = 470, X0 = (VB - W) / 2, Y0 = (VB - H) / 2;
  const px = (lonE) => X0 + (lonE / 360) * W, py = (lat) => Y0 + ((90 - lat) / 180) * H;

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
          <image href={`${import.meta.env.BASE_URL}plates/${bodyId}.jpg`} x={X0} y={Y0} width={W} height={H}
            preserveAspectRatio="none" onError={() => setPlate(false)} />
        ) : <rect x={X0} y={Y0} width={W} height={H} fill={color} opacity={0.30} />}
        <rect x={X0} y={Y0} width={W} height={H} fill="url(#plateFall)" />
      </g>
      {/* The night side. Clipped to the plate and drawn as per-longitude strips
          from nightSpans(), which the test holds in agreement with isLit() —
          a pin that LOOKS lit but refuses the shot would be the worst bug
          available here. */}
      {/* Group opacity, not per-rect: opaque columns composited once, so the
          overlaps that close subpixel gaps can't double-darken into vertical
          seams (a picket-fence artefact that stacking translucent rects gives). */}
      <g clipPath="url(#plateClip)" opacity={0.74}>
        {nightSpans(bodyId, t, 120).map((sp, i) => (
          <rect key={i} x={px(sp.lon0) - 0.6} y={py(sp.latFrom)}
            width={px(sp.lon1) - px(sp.lon0) + 1.2}
            height={Math.max(0, py(sp.latTo) - py(sp.latFrom))}
            fill="#04070E" />
        ))}
      </g>

      {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((l) => (
        <line key={l} x1={px(l)} y1={Y0} x2={px(l)} y2={Y0 + H} stroke="#fff" strokeOpacity={0.10} />
      ))}
      {[60, 30, 0, -30, -60].map((l) => (
        <line key={l} x1={X0} y1={py(l)} x2={X0 + W} y2={py(l)} stroke="#fff"
          strokeOpacity={l === 0 ? 0.28 : 0.10} strokeDasharray={l === 0 ? "" : "4 6"} />
      ))}
      <rect x={X0} y={Y0} width={W} height={H} fill="none" stroke="#26324a" strokeWidth={2} />
      <text x={X0} y={Y0 - 14} style={S.plateTitle}>
        {sys?.name || moonDef?.name || bodyId}
        {!plate && <tspan style={{ fill: "#8A94A8", fontWeight: 400 }}>  — placeholder plate, no imagery yet</tspan>}
      </text>
      <text x={X0} y={Y0 + H + 22} style={S.plateAxis}>0° east longitude → 360°</text>
      {feats.map((f) => {
        const x = px(f.lonE), y = py(f.lat), on = picked?.id === f.id;
        const lit = isLit(bodyId, f.lat, f.lonE, t);
        return (
          <g key={f.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${hideNames ? `An unnamed place at ${f.lat.toFixed(0)}° latitude` : f.name}. ${lit ? "In daylight." : "In local night — nothing to photograph."}`}
            onClick={() => onPick(f)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(f); } }}>
            <circle cx={x} cy={y} r={18} fill="transparent" />
            {/* Hollow when dark, solid when lit: shape, not just brightness, so
                the state survives a colourblind or low-contrast reading. */}
            <circle cx={x} cy={y} r={on ? 9 : 6}
              fill={lit ? (on ? "#F2B441" : "#fff") : "none"}
              stroke={lit ? "#070A12" : (on ? "#F2B441" : "#6B7A93")} strokeWidth={2} />
            {!hideNames && (
              <text x={x + 13} y={y + 5}
                style={{ ...S.pinLabel, textAnchor: "start", fill: lit ? "#C7D0E0" : "#6B7A93" }}>{f.name}</text>
            )}
          </g>
        );
      })}
      {feats.length === 0 && <text x={CX} y={Y0 + H / 2} style={S.empty}>No catalogued places here yet.</text>}
    </g>
  );
}

// ===========================================================================
// Shared
// ===========================================================================
/**
 * Says out loud that the content is a draft.
 *
 * Not optional politeness. The feature cards carry a confidence badge reading
 * "Measured — directly observed or measured by spacecraft", which describes how
 * settled the SCIENCE is and says nothing about whether anyone checked that the
 * claim on the card is real. The eighteen features in this build were written
 * from memory in one pass, coordinates included. A badge that looks vetted on
 * top of unvetted content is worse than plain text would be, and this is a
 * teaching tool for children (project rule 2).
 *
 * Delete this component the day src/data/features.js is generated from the IAU
 * Gazetteer and every fact carries a source.
 */
function Provisional() {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div style={S.provisional} role="note">
      <b>Draft content.</b> The facts, figures and coordinates in this build were
      written from memory and have <b>not</b> been checked against a source yet —
      so please don't learn from them. The orbital mechanics underneath them
      <i> are</i> real and tested.
      <button style={S.noticeX} onClick={() => setGone(true)} aria-label="Dismiss">✕</button>
    </div>
  );
}

function Notice({ text, onClose }) {
  useEffect(() => { const id = setTimeout(onClose, 6000); return () => clearTimeout(id); }, [text]);
  return (
    <div style={S.notice} role="status">
      {text}
      <button style={S.noticeX} onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

function Breadcrumb({ view, back }) {
  const sys = view.system && SYSTEM_BY_ID[view.system];
  const moonDef = view.body && Object.values(MOONS).flat().find((m) => m.id === view.body);
  const bodyName = view.body && (SYSTEM_BY_ID[view.body]?.name || moonDef?.name);
  return (
    <div style={S.crumb}>
      {view.level !== "orrery" && <button style={S.backBtn} onClick={back}>← Back <span style={S.kbd}>Esc</span></button>}
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
  <button onClick={onClick} aria-label={label} title={label} style={{ ...S.btn, minWidth: wide ? 88 : 46 }}>{children}</button>
);

const Toggle = ({ value, onChange, options, label }) => (
  <div role="group" aria-label={label} style={S.toggle}>
    {options.map(([v, l]) => (
      <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
        style={{ ...S.toggleBtn, ...(value === v ? S.toggleOn : null) }}>{l}</button>
    ))}
  </div>
);

// ===========================================================================
const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "var(--panel)", flexWrap: "wrap" },
  title: { fontSize: 19, fontWeight: 700, letterSpacing: 3, color: "var(--gold)" },
  sub: { fontSize: 11, color: "var(--muted)", letterSpacing: 0.4 },
  clock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 340 },
  hud: { display: "flex", gap: 24, alignItems: "flex-start" },
  dateLine: { fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  row: { display: "flex", gap: 5, alignItems: "center" },
  slider: { width: 330, accentColor: "#F2B441" },
  unit: { fontSize: 11, color: "var(--muted)", fontWeight: 400 },
  gaugeTrack: { height: 4, background: "#0B111C", borderRadius: 3, marginTop: 4, overflow: "hidden" },
  gaugeFill: { height: "100%", borderRadius: 3 },

  main: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, position: "relative", display: "flex", flexDirection: "column", minWidth: 0 },
  svg: { flex: 1, minHeight: 0, width: "100%", display: "block" },

  crumb: { position: "absolute", top: 12, left: 16, zIndex: 2, display: "flex", alignItems: "center", gap: 12 },
  crumbText: { fontSize: 12, color: "var(--muted)", letterSpacing: 0.5 },
  backBtn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 13 },
  kbd: { fontSize: 10, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px", marginLeft: 6 },
  provisional: {
    position: "relative", background: "rgba(228,113,63,0.13)", borderBottom: "1px solid rgba(228,113,63,0.45)",
    padding: "7px 40px 7px 20px", fontSize: 12.5, lineHeight: 1.5, color: "#EBD9CF",
  },
  notice: { position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 3,
    background: "var(--panel-2)", border: "1px solid var(--gold)", borderRadius: 8, padding: "8px 34px 8px 14px", fontSize: 13 },
  noticeX: { position: "absolute", right: 8, top: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)" },

  panel: { width: 380, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", padding: 20, overflowY: "auto" },
  paneHead: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 },
  h2: { margin: "0 0 10px", fontSize: 19, letterSpacing: 0.2 },
  x: { background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 },
  p: { margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 },
  small: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },
  hr: { height: 1, background: "var(--line)", margin: "16px 0" },

  stat: { padding: "9px 0", borderTop: "1px solid var(--line)" },
  statLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  statCard: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", minWidth: 130 },

  ship: { marginBottom: 8, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--panel-2)" },
  shipSel: { border: "1px solid var(--gold)" },
  shipBtn: { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer" },
  shipTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  tinyBtn: { display: "block", width: "100%", padding: "5px 12px", background: "#0B111C", border: "none",
    borderTop: "1px solid var(--line)", cursor: "pointer", fontSize: 11, color: "var(--muted)", textAlign: "left" },
  job: { marginTop: 8, padding: "9px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8 },
  jobSubject: { fontSize: 14, fontWeight: 700, marginBottom: 4 },

  cta: { marginTop: 14, width: "100%", padding: "11px 14px", borderRadius: 8, cursor: "pointer",
    background: "var(--gold)", color: "#1A1200", border: "none", fontWeight: 700, fontSize: 15 },
  ghost: { marginTop: 14, width: "100%", padding: "9px 14px", borderRadius: 8, cursor: "pointer",
    background: "transparent", border: "1px solid var(--line)", fontSize: 13 },
  listItem: { display: "block", width: "100%", textAlign: "left", marginTop: 8, padding: "10px 12px",
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" },
  tag: { marginLeft: 8, fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 10, padding: "1px 7px", verticalAlign: "middle" },

  subject: { fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.35 },
  clue: { fontSize: 15, lineHeight: 1.65, margin: "0 0 14px", color: "#DCE3F0" },
  points: { fontSize: 30, fontWeight: 800, color: "var(--gold)", marginBottom: 6 },
  compare: { background: "var(--panel-2)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0",
    padding: "10px 12px", fontSize: 14, lineHeight: 1.55, marginBottom: 12 },
  compareLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 },
  origin: { background: "var(--panel-2)", borderLeft: "3px solid var(--hot)", borderRadius: "0 8px 8px 0", padding: "10px 12px", marginBottom: 12 },
  conf: { fontSize: 12, color: "var(--muted)", padding: "8px 0", lineHeight: 1.5 },
  warn: { background: "rgba(228,113,63,0.12)", border: "1px solid rgba(228,113,63,0.4)", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, margin: "12px 0", lineHeight: 1.5 },

  scrim: { position: "fixed", inset: 0, background: "rgba(4,6,12,0.82)", display: "grid", placeItems: "center", zIndex: 50, padding: 24 },
  modal: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 24, maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto" },
  diagram: { width: 300, height: 156, display: "block", margin: "10px auto" },
  diagLabel: { fontSize: 9, fill: "#8A94A8", textAnchor: "middle", fontFamily: "inherit" },
  options: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 },
  option: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 },
  optionBest: { border: "1px solid var(--gold)" },
  optionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  bigNum: { fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginBottom: 6 },

  summaryWrap: { height: "100%", display: "grid", placeItems: "center", padding: 40 },
  summary: { maxWidth: 760, textAlign: "center" },
  summaryStats: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", margin: "20px 0" },

  btn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 12 },
  rateBtn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, minWidth: 34 },
  toggle: { display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" },
  toggleBtn: { background: "var(--panel-2)", border: "none", padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  toggleOn: { background: "var(--gold)", color: "#1A1200", fontWeight: 700 },

  pinLabel: { fontSize: 12, fill: "#B9C2D4", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit" },
  shipLabel: { fontSize: 10, textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit" },
  sunLabel: { fontSize: 14, fill: "#F2B441", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit", fontWeight: 600 },
  beltLabel: { fontSize: 11, fill: "#8A8073", textAnchor: "middle", pointerEvents: "none", fontFamily: "inherit", letterSpacing: 1 },
  plateTitle: { fontSize: 18, fill: "#E8EAF0", fontWeight: 700, fontFamily: "inherit" },
  plateAxis: { fontSize: 11, fill: "#8A94A8", fontFamily: "inherit" },
  empty: { fontSize: 14, fill: "#8A94A8", textAnchor: "middle", fontFamily: "inherit" },
};
