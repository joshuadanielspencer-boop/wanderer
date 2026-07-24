// ===========================================================================
// LAB KIT — shared UI for the systems sandboxes.
//
// The sandboxes exist because most of what SOLBOUND has built is invisible: the
// rocket equation, the markets, the day-length model and the transfer maths are
// all real and tested, and none of them was on a screen. Each lab is a thin,
// interactive window onto one already-tested module — so you can SEE the physics
// and fiddle with it in isolation.
//
// They double as the "Codex / Solar Atlas" the design docs asked for (design.md
// §7 in the survey-era doc): the same panels that let us test a system now can
// teach it in-game later. So this kit is written to be reusable, not throwaway.
// ===========================================================================
import { useEffect } from "react";

export const S = {
  page: { minHeight: "100%", display: "flex", flexDirection: "column" },
  bar: {
    display: "flex", alignItems: "center", gap: 16, padding: "12px 22px",
    borderBottom: "1px solid var(--line)", background: "var(--panel)",
    position: "sticky", top: 0, zIndex: 5,
  },
  home: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8,
    padding: "7px 13px", cursor: "pointer", fontSize: 13, textDecoration: "none", color: "var(--text)",
  },
  crumbTitle: { fontSize: 16, fontWeight: 700, letterSpacing: 0.3 },
  crumbSub: { fontSize: 12, color: "var(--muted)" },

  body: { flex: 1, maxWidth: 1080, width: "100%", margin: "0 auto", padding: "26px 22px 60px" },
  lead: { fontSize: 15, lineHeight: 1.65, color: "#CDD5E4", maxWidth: 760, margin: "0 0 26px" },

  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, marginBottom: 18 },
  cardTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: "0 0 14px" },

  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", marginBottom: 5 },
  big: { fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 },
  unit: { fontSize: 13, color: "var(--muted)", fontWeight: 400 },

  slider: { width: "100%", accentColor: "var(--gold)" },
  seg: { display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", flexWrap: "wrap" },
  segBtn: { background: "var(--panel-2)", border: "none", padding: "7px 12px", cursor: "pointer", fontSize: 13 },
  segOn: { background: "var(--gold)", color: "#1A1200", fontWeight: 700 },

  note: { fontSize: 13, lineHeight: 1.6, color: "var(--muted)" },
  teach: {
    background: "var(--panel-2)", borderLeft: "3px solid var(--gold)", borderRadius: "0 8px 8px 0",
    padding: "11px 14px", fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0",
  },
  warn: {
    background: "rgba(228,113,63,0.12)", border: "1px solid rgba(228,113,63,0.4)", borderRadius: 8,
    padding: "10px 13px", fontSize: 13, lineHeight: 1.55,
  },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "7px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  td: { padding: "7px 10px", borderBottom: "1px solid #1a2235", fontVariantNumeric: "tabular-nums" },
};

/** The top bar every lab shares: a way home, and a title. */
export function LabBar({ title, sub }) {
  return (
    <div style={S.bar}>
      <a href="#/" style={S.home}>← All systems</a>
      <div>
        <div style={S.crumbTitle}>{title}</div>
        {sub && <div style={S.crumbSub}>{sub}</div>}
      </div>
    </div>
  );
}

export function Card({ title, children, style }) {
  return (
    <div style={{ ...S.card, ...style }}>
      {title && <div style={S.cardTitle}>{title}</div>}
      {children}
    </div>
  );
}

export function Stat({ label, value, unit, tone }) {
  return (
    <div>
      <div style={S.label}>{label}</div>
      <div style={{ ...S.big, color: tone === "hot" ? "var(--hot)" : tone === "gold" ? "var(--gold)" : "var(--text)" }}>
        {value}{unit && <span style={S.unit}> {unit}</span>}
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div>
      {label && <div style={S.label}>{label}</div>}
      <div role="group" aria-label={label} style={S.seg}>
        {options.map((o) => {
          const val = o.value ?? o;
          const lab = o.label ?? o;
          return (
            <button key={val} onClick={() => onChange(val)} aria-pressed={value === val}
              style={{ ...S.segBtn, ...(value === val ? S.segOn : null) }}>{lab}</button>
          );
        })}
      </div>
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange, format }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.label}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {format ? format(value) : value}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} style={S.slider} aria-label={label} />
    </div>
  );
}

/** Set the document title while a lab is mounted, then restore it. */
export function useTitle(t) {
  useEffect(() => {
    const prev = document.title;
    document.title = `SOLBOUND — ${t}`;
    return () => { document.title = prev; };
  }, [t]);
}
