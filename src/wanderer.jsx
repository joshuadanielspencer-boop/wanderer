// ===========================================================================
// WANDERER — the vertical slice.
//
// Phase 0 proved the map. This adds the game on top of it, on the eighteen
// hand-written features we already have, to answer the one question that can
// still kill the project: does the delta-v / transfer-window / light-lag layer
// make this FUN, or merely fiddly?
//
// The bet being tested: that Shutterbug's "which place is this?" deduction and
// a real orbital-mechanics travel cost make each other better — that choosing
// WHEN to leave is as interesting as choosing WHERE to go. If that turns out to
// be false, it is much cheaper to learn it here than after curating 150 clues.
//
// Free-look mode is kept alongside the run, because the orrery is worth having
// even when nobody is scoring you.
// ===========================================================================
import { useEffect, useMemo, useState } from "react";
import { heliocentric, lightTimeSeconds, periodDays } from "./ephemeris.js";
import { project, orbitPath, moonLongitude, sayLightTime, sayDistance, logRadius, linearRadius } from "./orrery.js";
import { askEarthHours } from "./transfer.js";
import { SYSTEMS, SYSTEM_BY_ID, MOONS, DELTA_V_FROM_LEO } from "./data/bodies.js";
import { FEATURES_BY_BODY, FEATURES } from "./data/features.js";
import { newRun, travelChoice, currentTarget, runStatus, scoreShot, MISS_FUEL, MISS_DAYS, MAX_ASSIGNMENTS, END_DATE, START_DATE } from "./run.js";

const VB = 1000;
const CX = VB / 2, CY = VB / 2, BOARD_R = 430;
const DAY = 86400000;

const fmtDate = (d) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDays = (n) =>
  n < 60 ? `${Math.round(n)} days`
    : n < 700 ? `${(n / 30.44).toFixed(0)} months`
      : `${(n / 365.25).toFixed(1)} years`;

const yearsLeft = (d) => {
  const y = (END_DATE - d.getTime()) / (365.25 * DAY);
  return y < 1 ? `${Math.max(0, Math.round(y * 12))} months` : `${y.toFixed(1)} years`;
};

const dotFor = (radiusKm, k = 1) =>
  Math.max(4, Math.min(26, Math.pow(radiusKm || 1000, 0.25) * 1.35)) * k;

// The body a feature sits on belongs to a system; this is how a click on a moon
// resolves back to "which planet am I orbiting".
const systemOfBody = (bodyId) =>
  SYSTEM_BY_ID[bodyId]?.id || Object.entries(MOONS).find(([, ms]) => ms.some((m) => m.id === bodyId))?.[0];

export default function Wanderer() {
  const [run, setRun] = useState(null);
  const [date, setDate] = useState(() => new Date(Date.UTC(2026, 6, 21)));
  const [view, setView] = useState({ level: "orrery", system: null, body: null });
  const [selected, setSelected] = useState(null);
  const [feature, setFeature] = useState(null);   // free-look only
  const [result, setResult] = useState(null);     // run only: the resolved shot
  const [transfer, setTransfer] = useState(null); // pending travel decision
  const [reply, setReply] = useState(null);       // mission control's late answer
  const [tier, setTier] = useState("easy");
  const [trueScale, setTrueScale] = useState(false);
  const [playing, setPlaying] = useState(false);

  // During a run the clock is the run's; free-look has its own scrubbable one.
  const now = run ? run.date : date;
  const target = run ? currentTarget(run) : null;
  const status = run ? runStatus(run) : null;

  useEffect(() => {
    if (!playing || run) return;
    const id = setInterval(() => setDate((d) => new Date(d.getTime() + 6 * DAY)), 40);
    return () => clearInterval(id);
  }, [playing, run]);

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
    for (const s of SYSTEMS) if (s.ephemerisKey) out[s.id] = heliocentric(s.ephemerisKey, now);
    return out;
  }, [now]);

  // ---- navigation ---------------------------------------------------------
  const enterSystem = (id) => {
    setView({ level: "system", system: id, body: null });
    setSelected(null);
  };

  // In a run, picking a system you are not in is a TRAVEL decision, not a
  // click. That gate is the entire point of the slice.
  const chooseSystem = (id) => {
    const sys = SYSTEM_BY_ID[id];
    if (!sys || sys.kind === "belt") return;
    if (!run) return enterSystem(id);
    if (id === run.at) return enterSystem(id);
    const choice = travelChoice(run.at, id, run.date);
    if (!choice) return enterSystem(id);
    setTransfer({ to: id, choice });
  };

  const commitTransfer = (leg) => {
    const { to, choice } = transfer;
    const opt = choice[leg];
    const arrive = new Date(opt.departs.getTime() + opt.days * DAY);
    setRun((r) => ({ ...r, at: to, fuel: r.fuel - opt.dv, date: arrive }));
    setTransfer(null);
    setReply(null);
    enterSystem(to);
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (transfer) return setTransfer(null);
      if (result) return;
      if (feature) return setFeature(null);
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- the shot -----------------------------------------------------------
  const shoot = (f) => {
    if (!run) return setFeature(f);
    if (f.id === target.id) {
      const points = scoreShot({ tier: run.tier, misses: run.misses, fuelLeft: run.fuel, fuelMax: run.fuelMax });
      setRun((r) => ({ ...r, score: r.score + points, history: [...r.history, { id: f.id, hit: true, points }] }));
      setResult({ f, hit: true, points });
    } else {
      setRun((r) => ({
        ...r,
        misses: r.misses + 1,
        fuel: r.fuel - MISS_FUEL,
        date: new Date(r.date.getTime() + MISS_DAYS * DAY),
      }));
      setResult({ f, hit: false });
    }
  };

  const nextAssignment = () => {
    setResult(null);
    setRun((r) => ({ ...r, idx: r.idx + 1, misses: 0, asked: false }));
    setView({ level: "orrery", system: null, body: null });
  };

  // ---- asking Earth -------------------------------------------------------
  // One question per assignment. The reply is stamped with how long it really
  // took to get there and back, which is the lesson; the clock advances by it,
  // which is the (currently small) cost. If playtesting says light lag needs
  // teeth, this is the knob.
  const askEarth = () => {
    const sys = SYSTEM_BY_ID[run.at];
    const hours = sys?.ephemerisKey ? askEarthHours(sys.ephemerisKey, run.date) : 0;
    const bodyName = SYSTEM_BY_ID[target.body]?.name
      || Object.values(MOONS).flat().find((m) => m.id === target.body)?.name;
    setRun((r) => ({ ...r, asked: true, date: new Date(r.date.getTime() + (hours / 24) * DAY) }));
    setReply({ hours, text: `It's on ${bodyName}. Look for a ${CATEGORY_WORD[target.category] || "feature"}.` });
  };

  if (run && status !== "flying") {
    return <Summary run={run} status={status} onAgain={() => { setRun(null); setResult(null); }} />;
  }

  return (
    <div style={S.app}>
      <Header
        run={run} date={now} setDate={setDate} playing={playing} setPlaying={setPlaying}
        trueScale={trueScale} setTrueScale={setTrueScale} tier={tier} setTier={setTier}
        onQuit={() => { setRun(null); setResult(null); setView({ level: "orrery", system: null, body: null }); }}
      />

      <div style={S.main}>
        <div style={S.stage}>
          <Breadcrumb view={view} back={back} run={run} />
          <svg viewBox={`0 0 ${VB} ${VB}`} style={S.svg} role="group"
            aria-label={view.level === "orrery" ? "Orrery — the solar system from above" : "Map"}>
            {view.level === "orrery" && (
              <OrreryView positions={positions} orbits={orbits} trueScale={trueScale}
                selected={selected} onSelect={setSelected} onOpen={chooseSystem} at={run?.at} />
            )}
            {view.level === "system" && (
              <SystemView systemId={view.system} date={now} onOpen={openBody} />
            )}
            {view.level === "body" && (
              <BodyView bodyId={view.body} onPick={shoot} picked={feature} hideNames={!!run} />
            )}
          </svg>
        </div>

        <aside style={S.panel} aria-live="polite">
          {result ? (
            <ShotResult r={result} run={run} onNext={nextAssignment} onKeepLooking={() => setResult(null)} />
          ) : run ? (
            <CluePanel run={run} target={target} reply={reply} onAsk={askEarth} view={view} />
          ) : feature ? (
            <FeatureCard f={feature} tier={tier} onClose={() => setFeature(null)} />
          ) : view.level === "orrery" ? (
            <OrreryPanel id={selected} positions={positions} date={now} onOpen={enterSystem}
              onStart={() => setRun(newRun(Math.floor(now.getTime() / 1000) % 100000, tier))} tier={tier} />
          ) : view.level === "system" ? (
            <SystemPanel systemId={view.system} date={now} positions={positions} onOpen={openBody} />
          ) : (
            <BodyPanel bodyId={view.body} />
          )}
        </aside>
      </div>

      {transfer && (
        <TransferModal t={transfer} run={run}
          onGo={commitTransfer} onCancel={() => setTransfer(null)} />
      )}
    </div>
  );
}

const CATEGORY_WORD = {
  mons: "mountain", vallis: "canyon", basin: "great basin", crater: "crater",
  rupes: "cliff", planum: "plain", volcano: "volcano", mare: "sea or lake",
  linea: "crack or groove", regio: "region", landing: "landing site",
};

// ===========================================================================
// Header
// ===========================================================================
function Header({ run, date, setDate, playing, setPlaying, trueScale, setTrueScale, tier, setTier, onQuit }) {
  const MIN = Date.UTC(2020, 0, 1), MAX = Date.UTC(2050, 0, 1);
  const step = (days) => setDate((d) => new Date(d.getTime() + days * DAY));

  return (
    <header style={S.header}>
      <div>
        <div style={S.title}>WANDERER</div>
        <div style={S.sub}>a solar system photo safari</div>
      </div>

      {run ? (
        <div style={S.hud}>
          <Gauge label="Propellant" value={run.fuel} max={run.fuelMax} unit="km/s Δv" />
          <div style={{ ...S.hudStat, minWidth: 158 }}>
            <div style={S.statLabel}>Mission date</div>
            <div style={S.statValue}>{fmtDate(run.date)}</div>
            {/* The charter is the third pressure, alongside fuel and the clue.
                It has to be visible, or waiting for a window feels free. */}
            <div style={S.small}>charter ends 2050 · {yearsLeft(run.date)} left</div>
          </div>
          <div style={S.hudStat}>
            <div style={S.statLabel}>Assignment</div>
            <div style={S.statValue}>{run.idx + 1} of {run.targets.length}</div>
          </div>
          <div style={S.hudStat}>
            <div style={S.statLabel}>Score</div>
            <div style={S.statValue}>{run.score}</div>
          </div>
        </div>
      ) : (
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
          <input type="range" min={MIN} max={MAX} step={DAY} value={date.getTime()}
            onChange={(e) => setDate(new Date(+e.target.value))}
            style={S.slider} aria-label="Mission date" />
        </div>
      )}

      <div style={S.row}>
        {run ? (
          <Btn onClick={onQuit} label="Abandon this run" wide>Abandon run</Btn>
        ) : (
          <Toggle value={tier} onChange={setTier} label="Clue tier"
            options={[["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]]} />
        )}
        <Btn onClick={() => setTrueScale((v) => !v)} label="Toggle true distance scale" wide>
          {trueScale ? "◉ True scale" : "◎ Log scale"}
        </Btn>
      </div>
    </header>
  );
}

function Gauge({ label, value, max, unit }) {
  const pct = Math.max(0, Math.min(1, value / max));
  // Colourblind-safe: the number is always shown, and the bar is backed by a
  // written warning rather than by turning red on its own (rule 4).
  const low = pct < 0.25;
  return (
    <div style={{ ...S.hudStat, minWidth: 170 }}>
      <div style={S.statLabel}>{label}{low ? " — running low" : ""}</div>
      <div style={S.statValue}>{value.toFixed(1)} <span style={S.unit}>{unit}</span></div>
      <div style={S.gaugeTrack}>
        <div style={{ ...S.gaugeFill, width: `${pct * 100}%`, background: low ? "var(--hot)" : "var(--gold)" }} />
      </div>
    </div>
  );
}

// ===========================================================================
// The travel decision — the centre of the slice.
// ===========================================================================
function TransferModal({ t, run, onGo, onCancel }) {
  const { to, choice } = t;
  const sys = SYSTEM_BY_ID[to];
  const from = SYSTEM_BY_ID[run.at];
  const affordNow = choice.goNow.dv <= run.fuel;
  const affordWait = choice.window.dv <= run.fuel;
  const saving = choice.goNow.dv - choice.window.dv;

  return (
    <div style={S.scrim} role="dialog" aria-modal="true" aria-label={`Travel to ${sys.name}`}>
      <div style={S.modal}>
        <h2 style={S.h2}>{from.name} → {sys.name}</h2>
        <p style={S.small}>
          The cheapest route is a Hohmann transfer: one burn to leave, one to arrive.
          It only works when {sys.name} is in the right place — {Math.abs(choice.idealPhaseDeg).toFixed(0)}°
          {choice.idealPhaseDeg >= 0 ? " ahead of" : " behind"} you. Right now it is
          off by {Math.abs(choice.offByDeg).toFixed(0)}°.
        </p>

        <PhaseDiagram choice={choice} fromColor={from.color} toColor={sys.color} />

        <div style={S.options}>
          <Option
            title="Leave now"
            dv={choice.goNow.dv}
            depart={choice.goNow.departs}
            arrive={new Date(choice.goNow.departs.getTime() + choice.goNow.days * DAY)}
            flight={choice.goNow.days}
            afford={affordNow}
            note={saving > 0.05 ? `Costs ${saving.toFixed(1)} km/s more — you are fighting the geometry.` : "The geometry is already good."}
            onGo={() => onGo("goNow")}
          />
          <Option
            title={choice.window.waitDays > 0 ? `Wait ${fmtDays(choice.window.waitDays)}` : "Launch window is open"}
            dv={choice.window.dv}
            depart={choice.window.departs}
            arrive={new Date(choice.window.departs.getTime() + choice.window.days * DAY)}
            flight={choice.window.days}
            afford={affordWait}
            best={saving > 0.05}
            note={`This geometry comes round every ${fmtDays(choice.synodicDays)}.`}
            onGo={() => onGo("window")}
          />
        </div>

        {!affordNow && !affordWait && (
          <p style={S.warn}>
            You cannot afford either route. You have {run.fuel.toFixed(1)} km/s left.
            Pick somewhere closer.
          </p>
        )}
        <button style={S.ghost} onClick={onCancel}>Cancel <span style={S.kbd}>Esc</span></button>
      </div>
    </div>
  );
}

/** Sun in the middle, you on the left, the target where it is and where it needs
 *  to be. The whole argument for waiting, in one picture. */
function PhaseDiagram({ choice, fromColor, toColor }) {
  const R1 = 34, R2 = 62, cx = 150, cy = 78;
  const at = (r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = at(R1, 180);
  const [nx, ny] = at(R2, 180 + choice.actualPhaseDeg);
  const [wx, wy] = at(R2, 180 + choice.idealPhaseDeg);
  return (
    <svg viewBox="0 0 300 156" style={S.diagram} role="img"
      aria-label={`The target is ${Math.abs(choice.offByDeg).toFixed(0)} degrees from the ideal departure position.`}>
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

function Option({ title, dv, depart, arrive, flight, afford, best, note, onGo }) {
  return (
    <div style={{ ...S.option, ...(best ? S.optionBest : null) }}>
      <div style={S.optionTitle}>{title}{best && <span style={S.tag}>cheaper</span>}</div>
      <div style={S.bigNum}>{dv.toFixed(1)} <span style={S.unit}>km/s</span></div>
      <div style={S.small}>Departs {fmtDate(depart)}</div>
      <div style={S.small}>Flight {fmtDays(flight)} · arrives {fmtDate(arrive)}</div>
      <div style={{ ...S.small, marginTop: 6 }}>{note}</div>
      <button style={{ ...S.cta, opacity: afford ? 1 : 0.4 }} disabled={!afford} onClick={onGo}>
        {afford ? "Go" : "Not enough propellant"}
      </button>
    </div>
  );
}

// ===========================================================================
// Panels
// ===========================================================================
function CluePanel({ run, target, reply, onAsk, view }) {
  const here = SYSTEM_BY_ID[run.at];
  return (
    <div>
      <div style={S.statLabel}>Assignment {run.idx + 1}</div>
      <div style={S.subject}>“{target.subject}”</div>
      <p style={S.clue}>{target[run.tier]}</p>

      <div style={S.hr} />
      <Stat label="You are at" value={here?.name || run.at} />
      {run.misses > 0 && (
        <div style={S.warn}>
          {run.misses} wrong shot{run.misses > 1 ? "s" : ""} — {(run.misses * MISS_FUEL).toFixed(0)} km/s
          and {run.misses * MISS_DAYS} days gone.
        </div>
      )}

      {reply ? (
        <div style={S.origin}>
          <div style={S.compareLabel}>
            Mission control · reply took {reply.hours < 1
              ? `${(reply.hours * 60).toFixed(0)} minutes` : `${reply.hours.toFixed(1)} hours`} round trip
          </div>
          <p style={{ ...S.p, marginTop: 4 }}>{reply.text}</p>
        </div>
      ) : (
        <button style={S.ghostFull} onClick={onAsk} disabled={run.asked}>
          {run.asked ? "You've used your question" : "📡 Ask mission control (one per assignment)"}
        </button>
      )}

      <div style={{ ...S.small, marginTop: 14 }}>
        {view.level === "orrery"
          ? "Pick a world on the orrery. Leaving costs propellant — and less of it if you wait for the geometry."
          : view.level === "system" ? "Pick a body to map its surface."
            : "Photograph the place the clue describes."}
      </div>
    </div>
  );
}

function ShotResult({ r, run, onNext, onKeepLooking }) {
  if (!r.hit) {
    return (
      <Pane title="Not it">
        <p style={S.p}>
          That's <b>{r.f.name}</b> — {r.f.subject.toLowerCase()}.
        </p>
        <p style={S.small}>{r.f.fact}</p>
        <div style={S.warn}>
          Repositioning cost {MISS_FUEL} km/s and {MISS_DAYS} days.
        </div>
        <button style={S.cta} onClick={onKeepLooking}>Keep looking</button>
      </Pane>
    );
  }
  const f = r.f;
  return (
    <Pane title={f.name}>
      <div style={S.points}>+{r.points}</div>
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
      <ConfidenceLine f={f} />
      <button style={S.cta} onClick={onNext}>
        {run.idx + 1 >= run.targets.length ? "Head home →" : "Next assignment →"}
      </button>
    </Pane>
  );
}

const CONF = {
  measured: ["Measured", "Directly observed or measured by spacecraft."],
  inferred: ["Inferred", "Worked out from indirect evidence. The estimate could move."],
  hypothesis: ["Hypothesis", "One explanation among several. Not settled."],
};
const ConfidenceLine = ({ f }) => {
  const [label, hint] = CONF[f.confidence] || CONF.inferred;
  return <div style={S.conf}><b>{label}</b> — {hint}</div>;
};

function Summary({ run, status, onAgain }) {
  const hits = run.history.filter((h) => h.hit).length;
  return (
    <div style={S.summaryWrap}>
      <div style={S.summary}>
        <div style={S.title}>
          {status === "stranded" ? "OUT OF PROPELLANT" : status === "expired" ? "OUT OF TIME" : "HOMECOMING"}
        </div>
        <p style={S.p}>
          {status === "stranded"
            ? "You ran the tanks dry. Every kilometre per second spent hurrying was one you didn't have when it mattered — the geometry was always going to come round."
            : status === "expired"
              ? "The charter ran out before you did. Minimum-energy transfers are cheap in fuel and expensive in years, and the years are the thing nobody can buy more of."
              : `You brought back ${hits} photograph${hits === 1 ? "" : "s"} and ${run.fuel.toFixed(1)} km/s of propellant.`}
        </p>
        <div style={S.summaryStats}>
          <StatCard label="Score" value={run.score} />
          <StatCard label="Photographs" value={`${hits} / ${run.targets.length}`} />
          <StatCard label="Propellant left" value={`${Math.max(0, run.fuel).toFixed(1)} km/s`} />
          <StatCard label="Mission ended" value={fmtDate(run.date)} />
        </div>
        <p style={S.small}>
          The charter opened on {fmtDate(new Date(START_DATE))} and ran to 2050. Time
          passed because transfers take time — that is not a penalty, it is how far
          away everything is.
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

function OrreryPanel({ id, positions, date, onOpen, onStart, tier }) {
  if (!id) {
    return (
      <Pane title="The board">
        <p style={S.p}>
          Every planet is where it really is on <b>{fmtDate(date)}</b>, from JPL's
          Keplerian elements. Run the clock and watch them line up — those
          alignments are what a launch window <i>is</i>.
        </p>
        <button style={S.cta} onClick={onStart}>Begin a survey run ({tier})</button>
        <p style={{ ...S.small, marginTop: 12 }}>
          Five assignments, one tank of propellant, and a calendar that moves when
          you do. Or just click a planet and look around.
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
          hint={lt > 1800 ? "Out here you ask a question and wait." : undefined} />
      )}
      <div style={S.hr} />
      <div style={S.small}>Pick a world to map its surface.</div>
      <button style={S.listItem} onClick={() => onOpen(systemId, systemId)}>
        <b>{s.name} itself</b>
      </button>
      {moons.map((m) => (
        <button key={m.id} style={S.listItem} onClick={() => onOpen(systemId, m.id)}>
          <div><b>{m.name}</b></div>
          <div style={S.small}>{m.note}</div>
        </button>
      ))}
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
        {feats.length ? "Pick a place on the map." : "Nothing catalogued here yet."}
      </div>
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
          <div style={S.compare}>
            <div style={S.compareLabel}>To give you a sense of it</div>
            {f.earthComparison}
          </div>
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
// Views
// ===========================================================================
function OrreryView({ positions, orbits, trueScale, selected, onSelect, onOpen, at }) {
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

      {SYSTEMS.filter((s) => s.kind === "belt").map((s) => {
        const scale = trueScale ? linearRadius : logRadius;
        const inner = scale(s.auHint * 0.82) * BOARD_R;
        const outer = scale(s.auHint * 1.22) * BOARD_R;
        return (
          <g key={s.id}>
            <circle cx={CX} cy={CY} r={(inner + outer) / 2} fill="none"
              stroke="#8A8073" strokeOpacity={0.20} strokeWidth={outer - inner} strokeDasharray="2 7" />
            <text x={CX} y={CY - (outer + inner) / 2 - 6} style={S.beltLabel}>{s.name}</text>
          </g>
        );
      })}

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
        const here = at === s.id;
        const r = dotFor(s.radiusKm, s.id === "pluto" ? 1.4 : 1);
        return (
          <g key={s.id} role="button" tabIndex={0}
            aria-label={`${s.name}.${here ? " You are here." : ""} ${sayDistance(p.r)} from the Sun. Press Enter to travel there.`}
            onClick={() => (on || here ? onOpen(s.id) : onSelect(s.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (on || here) ? onOpen(s.id) : onSelect(s.id); }
            }}
            style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={Math.max(20, r + 12)} fill="transparent" />
            {/* "You are here" is a ring AND the word, never colour alone. */}
            {here && <circle cx={x} cy={y} r={r + 14} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="3 4" />}
            {on && <circle cx={x} cy={y} r={r + 9} fill="none" stroke={s.color} strokeWidth={2} strokeOpacity={0.8} />}
            <circle cx={x} cy={y} r={r} fill={s.color} stroke="#070A12" strokeWidth={1.5} />
            <text x={x} y={y - r - 9} style={{ ...S.pinLabel, fill: on || here ? "#fff" : "#B9C2D4" }}>
              {s.name}{here ? " — you are here" : ""}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SystemView({ systemId, date, onOpen }) {
  const sys = SYSTEM_BY_ID[systemId];
  const moons = MOONS[systemId] || [];
  const maxA = Math.max(...moons.map((m) => m.aKm), 1);
  const rOf = (aKm) => (Math.log(1 + (aKm / maxA) / 0.12) / Math.log(1 + 1 / 0.12)) * (BOARD_R - 60) + 60;
  const planetR = dotFor(sys.radiusKm, 2.2);
  return (
    <g>
      {moons.map((m) => (
        <circle key={m.id} cx={CX} cy={CY} r={rOf(m.aKm)} fill="none" stroke="#26324a" strokeOpacity={0.6} />
      ))}
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
        return (
          <g key={m.id} role="button" tabIndex={0} style={{ cursor: "pointer" }}
            aria-label={`${m.name}. Press Enter to map it.`}
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

function BodyView({ bodyId, onPick, picked, hideNames }) {
  const [plate, setPlate] = useState(true);
  useEffect(() => { setPlate(true); }, [bodyId]);

  const feats = FEATURES_BY_BODY[bodyId] || [];
  const sys = SYSTEM_BY_ID[bodyId];
  const moonDef = Object.values(MOONS).flat().find((m) => m.id === bodyId);
  const color = sys?.color || "#9AA6B8";
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
          <image href={`${import.meta.env.BASE_URL}plates/${bodyId}.jpg`}
            x={X0} y={Y0} width={W} height={H} preserveAspectRatio="none"
            onError={() => setPlate(false)} />
        ) : (
          <rect x={X0} y={Y0} width={W} height={H} fill={color} opacity={0.30} />
        )}
        <rect x={X0} y={Y0} width={W} height={H} fill="url(#plateFall)" />
      </g>
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
            aria-label={hideNames ? `An unnamed place at ${f.lat.toFixed(0)} degrees latitude. Press Enter to photograph it.` : `${f.name}. Press Enter.`}
            onClick={() => onPick(f)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(f); } }}>
            <circle cx={x} cy={y} r={18} fill="transparent" />
            <circle cx={x} cy={y} r={on ? 9 : 6} fill={on ? "#F2B441" : "#fff"} stroke="#070A12" strokeWidth={2} />
            {/* In a run the pins are unlabelled — naming them would answer the
                clue for you. Free-look labels them, because that is the point
                of free-look. */}
            {!hideNames && (
              <text x={x + 13} y={y + 5} style={{ ...S.pinLabel, textAnchor: "start", fill: on ? "#fff" : "#C7D0E0" }}>
                {f.name}
              </text>
            )}
          </g>
        );
      })}
      {feats.length === 0 && <text x={CX} y={Y0 + H / 2} style={S.empty}>No catalogued places here yet.</text>}
    </g>
  );
}

// ===========================================================================
// Shared bits
// ===========================================================================
function Breadcrumb({ view, back, run }) {
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
      <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
        style={{ ...S.toggleBtn, ...(value === v ? S.toggleOn : null) }}>{l}</button>
    ))}
  </div>
);

// ===========================================================================
// Styles
// ===========================================================================
const S = {
  app: { height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "var(--panel)", flexWrap: "wrap",
  },
  title: { fontSize: 19, fontWeight: 700, letterSpacing: 3, color: "var(--gold)" },
  sub: { fontSize: 11, color: "var(--muted)", letterSpacing: 0.4 },
  clock: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 380 },
  hud: { display: "flex", gap: 26, alignItems: "flex-start" },
  hudStat: { minWidth: 96 },
  dateLine: { fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  row: { display: "flex", gap: 6, alignItems: "center" },
  slider: { width: 360, accentColor: "#F2B441" },
  unit: { fontSize: 11, color: "var(--muted)", fontWeight: 400 },
  gaugeTrack: { height: 5, background: "var(--panel-2)", borderRadius: 3, marginTop: 4, overflow: "hidden" },
  gaugeFill: { height: "100%", borderRadius: 3 },

  main: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, position: "relative", display: "flex", flexDirection: "column", minWidth: 0 },
  svg: { flex: 1, minHeight: 0, width: "100%", display: "block" },

  crumb: { position: "absolute", top: 12, left: 16, zIndex: 2, display: "flex", alignItems: "center", gap: 12 },
  crumbText: { fontSize: 12, color: "var(--muted)", letterSpacing: 0.5 },
  backBtn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 13 },
  kbd: { fontSize: 10, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px", marginLeft: 6 },

  panel: { width: 380, flexShrink: 0, borderLeft: "1px solid var(--line)", background: "var(--panel)", padding: 20, overflowY: "auto" },
  paneHead: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 },
  h2: { margin: "0 0 10px", fontSize: 20, letterSpacing: 0.2 },
  x: { background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 },
  p: { margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 },
  small: { fontSize: 12, color: "var(--muted)", lineHeight: 1.5 },
  hr: { height: 1, background: "var(--line)", margin: "14px 0" },

  stat: { padding: "9px 0", borderTop: "1px solid var(--line)" },
  statLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  statCard: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", minWidth: 130 },

  cta: { marginTop: 14, width: "100%", padding: "11px 14px", borderRadius: 8, cursor: "pointer", background: "var(--gold)", color: "#1A1200", border: "none", fontWeight: 700, fontSize: 15 },
  ghost: { marginTop: 14, width: "100%", padding: "9px 14px", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid var(--line)", fontSize: 13 },
  ghostFull: { marginTop: 14, width: "100%", padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: "var(--panel-2)", border: "1px solid var(--line)", fontSize: 13, textAlign: "left" },
  listItem: { display: "block", width: "100%", textAlign: "left", marginTop: 8, padding: "10px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" },
  tag: { marginLeft: 8, fontSize: 10, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 10, padding: "1px 7px", verticalAlign: "middle" },

  subject: { fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.35 },
  clue: { fontSize: 15, lineHeight: 1.65, margin: "0 0 14px", color: "#DCE3F0" },
  points: { fontSize: 30, fontWeight: 800, color: "var(--gold)", marginBottom: 6 },
  compare: { background: "var(--panel-2)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0", padding: "10px 12px", fontSize: 14, lineHeight: 1.55, marginBottom: 12 },
  compareLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 },
  origin: { background: "var(--panel-2)", borderLeft: "3px solid var(--hot)", borderRadius: "0 8px 8px 0", padding: "10px 12px", marginBottom: 12 },
  conf: { fontSize: 12, color: "var(--muted)", padding: "8px 0", lineHeight: 1.5 },
  warn: { background: "rgba(228,113,63,0.12)", border: "1px solid rgba(228,113,63,0.4)", borderRadius: 8, padding: "9px 12px", fontSize: 13, margin: "12px 0", lineHeight: 1.5 },

  scrim: { position: "fixed", inset: 0, background: "rgba(4,6,12,0.82)", display: "grid", placeItems: "center", zIndex: 50, padding: 24 },
  modal: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: 24, maxWidth: 720, width: "100%", maxHeight: "92vh", overflowY: "auto" },
  diagram: { width: 300, height: 156, display: "block", margin: "10px auto" },
  diagLabel: { fontSize: 9, fill: "#8A94A8", textAnchor: "middle", fontFamily: "inherit" },
  options: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 },
  option: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 },
  optionBest: { borderColor: "var(--gold)" },
  optionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 6 },
  bigNum: { fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginBottom: 6 },

  summaryWrap: { height: "100%", display: "grid", placeItems: "center", padding: 40 },
  summary: { maxWidth: 720, textAlign: "center" },
  summaryStats: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", margin: "20px 0" },

  btn: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 12 },
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
