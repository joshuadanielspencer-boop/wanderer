// ===========================================================================
// APP — the front door and the router.
//
// Most of what SOLBOUND has built is invisible: the physics and the economy are
// tested code with no screens. This hub fixes that. Each system gets its own
// hash route so it can be opened, bookmarked and shared on its own — exactly the
// "try them all individually" the design called for — and the sandboxes double
// as the in-game Codex later.
//
// Hash routing (not path routing) on purpose: it works on GitHub Pages with no
// server rewrites, and every panel gets a real URL like /solbound/#/rocket.
// ===========================================================================
import { useEffect, useState } from "react";
import Wanderer from "./wanderer.jsx";
import RocketLab from "./labs/rocket.jsx";
import MarketLab from "./labs/market.jsx";
import DayNightLab from "./labs/daynight.jsx";
import TransferLab from "./labs/transfer.jsx";

const ROUTES = {
  play:     { comp: Wanderer,    title: "The fleet", blurb: "Fly three ships across a live solar system: launch windows, real transfer orbits, the day/night terminator, and the survey game. The playable build.", emoji: "🛰", tag: "playable" },
  rocket:   { comp: RocketLab,   title: "The rocket equation", blurb: "Drag the velocity change and watch the fuel cost explode. Why 'far' and 'hard' are different words — and why the torch drive is fiction.", emoji: "🚀", tag: "physics" },
  transfer: { comp: TransferLab, title: "Transfer planner", blurb: "Pick two worlds and a date. See the launch-window geometry, what leaving now costs, and when the cheap window opens.", emoji: "🪐", tag: "physics" },
  daynight: { comp: DayNightLab, title: "Day, night & seasons", blurb: "What 'the terminator' is: the day/night line, sweeping each world at its real day length. Mars is 24h 39m; Venus's day is longer than its year.", emoji: "🌓", tag: "physics" },
  market:   { comp: MarketLab,   title: "Trade & the ISRU lesson", blurb: "Two markets, live prices, and the split the physics forces: what's worth shipping across the solar system, and what you must make where you stand.", emoji: "📦", tag: "economy" },
};

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, "") || "home");
  useEffect(() => {
    const on = () => setRoute(window.location.hash.replace(/^#\/?/, "") || "home");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  if (route === "home") return <Home />;
  const entry = ROUTES[route];
  if (!entry) return <Home unknown={route} />;
  const C = entry.comp;
  return <C />;
}

function Home({ unknown }) {
  useEffect(() => { document.title = "SOLBOUND — Systems"; }, []);
  const tagColor = { playable: "var(--gold)", physics: "#7FB2CE", economy: "#3E9B6E" };
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <header style={s.header}>
          <div style={s.logo}>SOL<span style={s.o}>☉</span>BOUND</div>
          <p style={s.tagline}>An economic strategy game in the real solar system. The map is delta-v, not distance.</p>
          <p style={s.draft}>
            Early build. The systems below are real and tested; the game that ties them
            together is still being assembled. Facts and figures are drafts — don't learn
            from them yet. The physics underneath them is real.
          </p>
        </header>

        {unknown && <div style={s.unknown}>No panel called “{unknown}”. Here's everything there is:</div>}

        <div style={s.grid}>
          {Object.entries(ROUTES).map(([id, r]) => (
            <a key={id} href={`#/${id}`} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.emoji}>{r.emoji}</span>
                <span style={{ ...s.tag, color: tagColor[r.tag] || "var(--muted)", borderColor: tagColor[r.tag] || "var(--line)" }}>{r.tag}</span>
              </div>
              <div style={s.cardTitle}>{r.title}</div>
              <div style={s.cardBlurb}>{r.blurb}</div>
              <div style={s.cardGo}>Open →</div>
            </a>
          ))}
        </div>

        <footer style={s.footer}>
          Each panel has its own link — bookmark or share it directly. Built with real
          orbital mechanics (JPL elements), the Tsiolkovsky rocket equation, and a
          scarcity-priced economy. 114 tests and counting.
        </footer>
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: "100%", background: "radial-gradient(1200px 600px at 50% -10%, #12203a 0%, var(--bg) 60%)" },
  inner: { maxWidth: 960, margin: "0 auto", padding: "60px 22px 80px" },
  header: { textAlign: "center", marginBottom: 40 },
  logo: { fontSize: 44, fontWeight: 800, letterSpacing: 6, color: "var(--gold)" },
  o: { color: "var(--gold)", fontSize: 40 },
  tagline: { fontSize: 16, color: "#CDD5E4", margin: "12px 0 0", lineHeight: 1.5 },
  draft: { fontSize: 12.5, color: "var(--muted)", maxWidth: 620, margin: "18px auto 0", lineHeight: 1.6,
    background: "rgba(228,113,63,0.10)", border: "1px solid rgba(228,113,63,0.35)", borderRadius: 8, padding: "10px 14px" },
  unknown: { textAlign: "center", color: "var(--hot)", marginBottom: 18, fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  card: { display: "block", textDecoration: "none", color: "var(--text)", background: "var(--panel)",
    border: "1px solid var(--line)", borderRadius: 14, padding: 20, transition: "border-color .15s, transform .15s" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  emoji: { fontSize: 26 },
  tag: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, border: "1px solid", borderRadius: 20, padding: "2px 9px" },
  cardTitle: { fontSize: 18, fontWeight: 700, marginBottom: 7 },
  cardBlurb: { fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)", marginBottom: 14 },
  cardGo: { fontSize: 13, color: "var(--gold)", fontWeight: 600 },
  footer: { textAlign: "center", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, marginTop: 40, maxWidth: 640, marginLeft: "auto", marginRight: "auto" },
};
