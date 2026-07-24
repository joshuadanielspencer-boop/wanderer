// ===========================================================================
// ROCKET EQUATION LAB — why "far" and "hard" are different words.
//
// A thin interactive window onto src/propulsion.js. Drag the Δv, pick a drive,
// and watch the mass ratio explode — the single equation the whole economy
// rests on, made visible.
// ===========================================================================
import { useState } from "react";
import { LabBar, Card, Stat, Segmented, Slider, S, useTitle } from "./kit.jsx";
import {
  DRIVES, massRatio, propellantFraction, payloadFraction, brachistochrone, assess,
} from "../propulsion.js";

// Reference trips, so the abstract Δv slider has real destinations pinned to it.
const TRIPS = [
  { dv: 3.9, label: "LEO → the Moon (orbit)" },
  { dv: 5.6, label: "Earth → Mars (transfer)" },
  { dv: 9.3, label: "LEO → Mars (surface)" },
  { dv: 14.4, label: "Earth → Jupiter" },
];

export default function RocketLab() {
  useTitle("Rocket equation");
  const [dv, setDv] = useState(5.6);
  const [driveId, setDriveId] = useState("hydrolox");
  const drive = DRIVES[driveId];

  const a = assess(dv, drive);
  const propPct = propellantFraction(dv, drive.isp) * 100;
  const payload = payloadFraction(dv, drive.isp);

  // Payload as a share of the departing vehicle, clamped for the bar.
  const payloadBar = Math.max(0, Math.min(1, payload));

  return (
    <div style={S.page}>
      <LabBar title="The rocket equation" sub="Δv = Iₛₚ · g₀ · ln(m₀/m₁)" />
      <div style={S.body}>
        <p style={S.lead}>
          How much fuel a trip needs does not grow with the trip — it grows
          <b> exponentially</b>. Double the velocity change and you don't double the
          propellant, you square the ratio. This one fact is why depots exist, why
          making fuel in space beats shipping it, and why some trips are simply
          impossible in a single vehicle.
        </p>

        <Card title="Pick a trip, or drag it">
          <Segmented label="Reference trips" value={dv}
            onChange={setDv}
            options={TRIPS.map((t) => ({ value: t.dv, label: t.label }))} />
          <div style={{ height: 16 }} />
          <Slider label="Velocity change (Δv)" min={1} max={20} step={0.1} value={dv}
            format={(v) => `${v.toFixed(1)} km/s`} onChange={setDv} />
        </Card>

        <Card title="Engine">
          <Segmented value={driveId} onChange={setDriveId}
            options={Object.values(DRIVES).map((d) => ({ value: d.id, label: d.name }))} />
          <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>
            {drive.note} <span style={{ color: "var(--muted)" }}>
              Exhaust velocity {((drive.isp * 9.80665) / 1000).toFixed(1)} km/s · available from {drive.available}.
            </span>
          </p>
        </Card>

        <Card title={`Result — ${drive.name}, ${dv.toFixed(1)} km/s`}>
          <div style={S.grid2}>
            <Stat label="Mass ratio" value={a.massRatio > 100 ? a.massRatio.toExponential(1) : a.massRatio.toFixed(1)} unit="× wet/dry"
              tone={a.massRatio > 8 ? "hot" : undefined} />
            <Stat label="Must be propellant" value={propPct.toFixed(0)} unit="%"
              tone={propPct > 85 ? "hot" : "gold"} />
            <Stat label="Verdict" value={a.feasible ? "Possible" : "Impossible"}
              tone={a.feasible ? undefined : "hot"} />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={S.label}>Where the departing mass goes</div>
            <MassBar propPct={propPct} payloadBar={payloadBar} feasible={a.feasible} />
          </div>

          {a.feasible ? (
            <div style={S.teach}>{verdictLine(a, propPct)}</div>
          ) : (
            <div style={{ ...S.warn, marginTop: 12 }}>
              <b>This cannot be done in one stage.</b> The vehicle would have to be more
              than 100% propellant — it can't even carry its own empty tanks. This is
              exactly why real rockets stage, why depots exist, and why an era change to
              a better engine <i>is</i> the tech tree.
            </div>
          )}
        </Card>

        {drive.speculative && <TorchNote dv={dv} />}
      </div>
    </div>
  );
}

function MassBar({ propPct, payloadBar, feasible }) {
  const prop = Math.min(100, propPct);
  const structural = feasible ? Math.min(100 - prop, prop * 0.08) : 0;
  const payload = feasible ? Math.max(0, 100 - prop - structural) : 0;
  return (
    <div>
      <div style={{ display: "flex", height: 30, borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
        <div style={{ width: `${prop}%`, background: "var(--hot)" }} title="propellant" />
        <div style={{ width: `${structural}%`, background: "#6B7A8F" }} title="tanks & engine" />
        <div style={{ width: `${payload}%`, background: "var(--gold)" }} title="payload" />
      </div>
      <div style={{ ...S.row, marginTop: 8, fontSize: 12, color: "var(--muted)", gap: 18 }}>
        <span><span style={{ color: "var(--hot)" }}>■</span> propellant {prop.toFixed(0)}%</span>
        <span><span style={{ color: "#6B7A8F" }}>■</span> tanks & engine</span>
        <span><span style={{ color: "var(--gold)" }}>■</span> payload {payload.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function verdictLine(a, propPct) {
  if (a.verdict === "comfortable") return `Comfortable. Most of the vehicle is useful mass — this is the kind of trip you run all day.`;
  if (a.verdict === "tight") return `Tight but fine. About ${propPct.toFixed(0)}% of the launch mass is fuel; the rest earns its keep.`;
  return `Marginal — nearly all of it is tank. Doable, but a better engine or a fuel depot would transform this route.`;
}

function TorchNote({ dv }) {
  const b = brachistochrone(1, 1);
  const mr = massRatio(b.dvKms, DRIVES.torch.isp);
  return (
    <Card title="A note on the fusion torch" style={{ borderColor: "var(--hot)" }}>
      <p style={{ ...S.note, marginTop: 0 }}>
        Every other engine here has flown or been engineered in detail. The torch has
        not, and the rocket equation says why. A one-gravity dash across 1 AU — the
        Expanse's whole premise — costs about <b>{Math.round(b.dvKms).toLocaleString()} km/s</b>,
        and even at the torch's generous exhaust velocity that demands a mass ratio of
        roughly <b>{mr.toExponential(0)}</b>. That is more propellant than the ship could
        be built from, by ten orders of magnitude.
      </p>
      <p style={{ ...S.note, marginBottom: 0 }}>
        It is not an engineering gap. It is an impossibility that every story with a
        torch drive quietly invents new physics to escape — and SOLBOUND shows you the
        wall rather than hiding it.
      </p>
    </Card>
  );
}
