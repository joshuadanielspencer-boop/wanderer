// ===========================================================================
// TRADE LAB — the ISRU lesson, made visible.
//
// A window onto src/market.js and src/data/commodities.js. Pick two sites and a
// drive, and watch which goods pay for their own transport and which never can.
// The point it exists to make: you cannot ship water across the solar system,
// and discovering that from the prices is how a player learns to make it locally.
// ===========================================================================
import { useMemo, useState } from "react";
import { LabBar, Card, Segmented, S, useTitle } from "./kit.jsx";
import { SITES, SITE_BY_ID } from "../data/sites.js";
import { COMMODITY_BY_ID, shippingCostPerTonne } from "../data/commodities.js";
import { initialMarkets, listing, tradeOpportunities } from "../market.js";
import { DRIVES } from "../propulsion.js";

const money = (n) => "$" + Math.round(n).toLocaleString();
// Approximate heliocentric Δv between two sites, from their LEO figures. Good
// enough to drive the lesson; the real graph is a future task (design.md debt).
const tripDv = (from, to) => Math.max(1.5, Math.abs((to.dvFromEarth || 0) - (from.dvFromEarth || 0)) + 3.0);

export default function MarketLab() {
  useTitle("Trade & the ISRU lesson");
  const markets = useMemo(() => initialMarkets(), []);
  const [fromId, setFromId] = useState("leo");
  const [toId, setToId] = useState("shackleton");
  const [driveId, setDriveId] = useState("methalox");

  const from = SITE_BY_ID[fromId], to = SITE_BY_ID[toId];
  const drive = DRIVES[driveId];
  const dv = tripDv(from, to);
  const shipCost = shippingCostPerTonne(dv, drive.isp);
  const ops = tradeOpportunities(markets, fromId, toId, shipCost);

  const siteOptions = SITES.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div style={S.page}>
      <LabBar title="Trade & the ISRU lesson" sub="what moves between worlds, and what never does" />
      <div style={S.body}>
        <p style={S.lead}>
          Interplanetary trade is not buy-low-sell-high in bulk ore — the physics
          forbids it. Moving a tonne anywhere costs a fortune in propellant, so only
          goods worth far more than their transport ever fly. Everything heavy must be
          made where it's used. Pick a route and watch the split appear.
        </p>

        <Card title="Route">
          <div style={S.row}>
            <Segmented label="From" value={fromId} onChange={setFromId} options={siteOptions} />
          </div>
          <div style={{ height: 12 }} />
          <div style={S.row}>
            <Segmented label="To" value={toId} onChange={setToId} options={siteOptions} />
          </div>
          <div style={{ height: 12 }} />
          <Segmented label="Drive" value={driveId} onChange={setDriveId}
            options={Object.values(DRIVES).filter((d) => !d.speculative).map((d) => ({ value: d.id, label: d.name }))} />
          <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>
            About <b>{dv.toFixed(1)} km/s</b> for this hop → shipping costs{" "}
            <b>{money(shipCost)}</b> per tonne. {from.name} → {to.name}.
          </p>
        </Card>

        {fromId === toId ? (
          <Card><p style={{ ...S.note, margin: 0 }}>Pick two different sites to see a route.</p></Card>
        ) : (
          <Card title={`What's worth carrying, ${from.name} → ${to.name}`}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Commodity</th>
                  <th style={S.th}>Buy</th>
                  <th style={S.th}>Sell</th>
                  <th style={S.th}>Ship</th>
                  <th style={S.th}>Profit / t</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((o) => (
                  <tr key={o.id} style={{ opacity: o.viable ? 1 : 0.5 }}>
                    <td style={S.td}>
                      {o.viable ? "✅ " : "🚫 "}{o.name}
                    </td>
                    <td style={S.td}>{money(o.buyPrice)}</td>
                    <td style={S.td}>{money(o.sellPrice)}</td>
                    <td style={S.td}>{money(o.shipping)}</td>
                    <td style={{ ...S.td, color: o.viable ? "var(--gold)" : "var(--hot)", fontWeight: 700 }}>
                      {o.profitPerTonne >= 0 ? money(o.profitPerTonne) : "−" + money(-o.profitPerTonne)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={S.teach}>{lessonFor(ops, from, to)}</div>
          </Card>
        )}

        <Card title="The two markets, side by side">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <SiteColumn markets={markets} site={from} />
            <SiteColumn markets={markets} site={to} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function lessonFor(ops, from, to) {
  const dead = ops.filter((o) => !o.viable).map((o) => o.name.toLowerCase());
  const live = ops.filter((o) => o.viable).map((o) => o.name.toLowerCase());
  if (!live.length) return `Nothing is worth carrying on this route — the transport cost swallows every margin. This is a route that only makes sense once you can make fuel at one end.`;
  const bulk = dead.filter((n) => ["water ice", "regolith", "metal ore", "refined metal", "propellant"].includes(n));
  return `${cap(live[0])} pays for itself; ${bulk.length ? bulk.slice(0, 3).join(", ") + " never will" : "the cheap bulk goods never will"}. `
    + `That gap is the whole reason a colony must eventually make its own — the win condition isn't getting rich, it's not needing the shipment.`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function SiteColumn({ markets, site }) {
  const rows = listing(markets[site.id], site);
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{site.name}</div>
      <div style={{ ...S.note, marginBottom: 10 }}>{site.why}</div>
      <table style={S.table}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={S.td}>{r.produces ? "⛏ " : r.consumes ? "▾ " : ""}{r.name}</td>
              <td style={{ ...S.td, textAlign: "right" }}>${Math.round(r.price).toLocaleString()}</td>
              <td style={{ ...S.td, color: "var(--muted)", fontSize: 12 }}>{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
