// ===========================================================================
// TRANSFER LAB — the launch window, made a thing you can see and wait for.
//
// A window onto src/transfer.js. Pick two worlds and a date; it shows the phase
// geometry, what leaving now costs, and when the cheap window opens. The same
// decision the game puts in front of a ship, isolated so you can feel it.
// ===========================================================================
import { useState } from "react";
import { LabBar, Card, Stat, Segmented, Slider, S, useTitle } from "./kit.jsx";
import { transferOptions } from "../transfer.js";
import { SYSTEMS, SYSTEM_BY_ID } from "../data/bodies.js";

const DAY = 86400000;
const PLANETS = SYSTEMS.filter((s) => s.ephemerisKey).map((s) => ({ value: s.id, label: s.name }));
const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDur = (d) => d < 60 ? `${Math.round(d)} days` : d < 700 ? `${(d / 30.44).toFixed(0)} months` : `${(d / 365.25).toFixed(1)} years`;

export default function TransferLab() {
  useTitle("Transfer planner");
  const [fromId, setFromId] = useState("earth");
  const [toId, setToId] = useState("mars");
  const [dayOffset, setDayOffset] = useState(0);
  const base = Date.UTC(2035, 0, 1);
  const date = new Date(base + dayOffset * DAY);

  const from = SYSTEM_BY_ID[fromId], to = SYSTEM_BY_ID[toId];
  const same = fromId === toId;
  const c = same ? null : transferOptions(from.ephemerisKey, to.ephemerisKey, date);

  return (
    <div style={S.page}>
      <LabBar title="Transfer planner" sub="leave now, or wait for the geometry" />
      <div style={S.body}>
        <p style={S.lead}>
          The cheapest route between two worlds only works when they're in the right
          places — a launch window. Leave off that geometry and you pay for it in fuel;
          wait, and you pay for it in time. That trade is the heartbeat of the game.
          Change the date and watch the cost breathe.
        </p>

        <Card title="Route & date">
          <div style={S.row}><Segmented label="From" value={fromId} onChange={setFromId} options={PLANETS} /></div>
          <div style={{ height: 12 }} />
          <div style={S.row}><Segmented label="To" value={toId} onChange={setToId} options={PLANETS} /></div>
          <div style={{ height: 14 }} />
          <Slider label="Departure date" min={0} max={365 * 8} step={5} value={dayOffset}
            format={() => fmtDate(date)} onChange={setDayOffset} />
        </Card>

        {same ? (
          <Card><p style={{ ...S.note, margin: 0 }}>Pick two different worlds.</p></Card>
        ) : (
          <>
            <Card title={`${from.name} → ${to.name}`}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "center" }}>
                <PhaseDiagram c={c} fromColor={from.color} toColor={to.color} />
                <div>
                  <p style={{ ...S.note, marginTop: 0 }}>
                    {to.name} needs to be about <b>{Math.abs(c.idealPhaseDeg).toFixed(0)}°</b>{" "}
                    {c.idealPhaseDeg >= 0 ? "ahead of" : "behind"} {from.name} at departure.
                    Right now it's off by <b>{Math.abs(c.offByDeg).toFixed(0)}°</b>.
                  </p>
                  <p style={{ ...S.note, marginBottom: 0 }}>
                    This geometry comes round every <b>{fmtDur(c.synodicDays)}</b>.
                  </p>
                </div>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card title="Leave now">
                <Stat label="Fuel cost (Δv)" value={c.goNow.dv.toFixed(1)} unit="km/s"
                  tone={c.goNow.dv > c.window.dv * 1.3 ? "hot" : undefined} />
                <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>
                  Departs {fmtDate(date)}<br />
                  Flight {fmtDur(c.goNow.days)} · arrives {fmtDate(date.getTime() + c.goNow.days * DAY)}
                </p>
              </Card>
              <Card title={c.window.waitDays > 0 ? `Wait ${fmtDur(c.window.waitDays)}` : "Window open now"}
                style={{ borderColor: "var(--gold)" }}>
                <Stat label="Fuel cost (Δv)" value={c.window.dv.toFixed(1)} unit="km/s" tone="gold" />
                <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>
                  Departs {fmtDate(c.window.departs)}<br />
                  Flight {fmtDur(c.window.days)} · arrives {fmtDate(c.window.departs.getTime() + c.window.days * DAY)}
                </p>
              </Card>
            </div>

            <Card>
              <div style={S.teach}>
                {c.goNow.dv > c.window.dv + 0.1
                  ? `Waiting saves ${(c.goNow.dv - c.window.dv).toFixed(1)} km/s of fuel — a lot, when 72% of a chemical ship is already propellant. But a ship spent waiting earns nothing, which is exactly why you'll want more than one.`
                  : `The geometry is good right now — leaving costs almost nothing extra. This is the moment to go.`}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function PhaseDiagram({ c, fromColor, toColor }) {
  const R1 = 40, R2 = 72, cx = 90, cy = 90;
  const at = (r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
  const [ax, ay] = at(R1, 180);
  const [nx, ny] = at(R2, 180 + c.actualPhaseDeg);
  const [wx, wy] = at(R2, 180 + c.idealPhaseDeg);
  return (
    <svg viewBox="0 0 180 180" style={{ width: 180, height: 180 }} role="img"
      aria-label={`Target ${Math.abs(c.offByDeg).toFixed(0)} degrees from the ideal departure position`}>
      <circle cx={cx} cy={cy} r={R1} fill="none" stroke="#26324a" />
      <circle cx={cx} cy={cy} r={R2} fill="none" stroke="#26324a" />
      <circle cx={cx} cy={cy} r="7" fill="#F2B441" />
      <circle cx={ax} cy={ay} r="6" fill={fromColor} />
      <circle cx={wx} cy={wy} r="10" fill="none" stroke="#F2B441" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx={nx} cy={ny} r="6" fill={toColor} />
      <text x={cx} y={cy - 10} fill="#8A94A8" fontSize="8" textAnchor="middle" fontFamily="inherit">Sun</text>
    </svg>
  );
}
