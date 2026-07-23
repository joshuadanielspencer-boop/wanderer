// ===========================================================================
// MARKETS AND THE ECONOMIC THESIS.
//
// Two jobs. First, the boring-but-fatal one: prove the economy cannot run away.
// Every design pass flagged hyperinflation and collapse as the likeliest way
// this game breaks, and an economy bug in a trading game is not a glitch, it is
// the end of the game.
//
// Second, and more interesting: prove the DESIGN THESIS holds arithmetically.
// docs/design.md §5 claims that interplanetary arbitrage in bulk goods is
// impossible under honest physics, and that this is what forces ISRU. If that
// claim is false, the entire economic design is built on sand — so it is
// asserted here rather than assumed.
// ===========================================================================
import { describe, it, expect } from "vitest";
import {
  priceMultiplier, nominalStock, dailyProduction, dailyConsumption,
  initialMarkets, priceAt, listing, advanceMarkets, buy, sell,
  tradeOpportunities, PRICE_FLOOR, PRICE_CEILING,
} from "../src/market.js";
import { SITES, SITE_BY_ID } from "../src/data/sites.js";
import { COMMODITIES, COMMODITY_BY_ID, shippingCostPerTonne, shippingMargin, worthShipping } from "../src/data/commodities.js";
import { DRIVES } from "../src/propulsion.js";

const site = (id) => SITE_BY_ID[id];

describe("the economic thesis: bulk cannot ship, value can", () => {
  it("shipping water ice anywhere destroys more value than it creates", () => {
    // THE core claim of the design. Ice is $200/t; moving a tonne through even a
    // modest 4 km/s costs multiples of that in propellant alone. If this ever
    // came out positive, "mine it locally" would stop being forced and the
    // campaign's whole shape would collapse.
    for (const dv of [3, 4.6, 6, 9]) {
      const m = shippingMargin("ice", dv, DRIVES.methalox.isp);
      expect(m.margin, `ice at ${dv} km/s`).toBeLessThan(0);
      expect(m.cost).toBeGreaterThan(m.value);
    }
  });

  it("but precision instruments cross the solar system happily", () => {
    // $9M/t. Transport is a rounding error, which is exactly why real
    // interplanetary trade looks like this and not like ore barges.
    const m = shippingMargin("instruments", 9, DRIVES.methalox.isp);
    expect(m.margin).toBeGreaterThan(0.95);
  });

  it("the tier ladder predicts what is worth carrying", () => {
    // A clean split at a realistic Mars-bound Δv: raw and refined goods stay
    // home, industrial and advanced goods fly. That IS the dependency model.
    const carried = worthShipping(4.6, DRIVES.methalox.isp).map((c) => c.id);
    for (const id of ["ice", "regolith", "ore"]) expect(carried).not.toContain(id);
    for (const id of ["electronics", "medical", "instruments", "reactorparts"]) {
      expect(carried).toContain(id);
    }
  });

  it("cheap propellant is what changes the map", () => {
    // The depot lesson, quantified. Same trip, same ship — the only difference
    // is whether the fuel was made locally or lifted from Earth. Goods that
    // could not move suddenly can.
    const dv = 5.5, isp = DRIVES.methalox.isp;
    const expensive = worthShipping(dv, isp, 6000).length;
    const cheap = worthShipping(dv, isp, 400).length;
    expect(cheap).toBeGreaterThan(expensive);
  });

  it("shipping cost is exponential in Δv, not linear", () => {
    // Inherited from the rocket equation. If this reads linear, the economy is
    // teaching the opposite of the physics it sits on.
    const a = shippingCostPerTonne(4, 380), b = shippingCostPerTonne(8, 380);
    expect(b / a).toBeGreaterThan(2.5);
  });
});

describe("prices cannot run away", () => {
  it("stays inside its bounds for any stock level, including absurd ones", () => {
    for (const r of [0, 0.0001, 0.5, 1, 10, 1000, 1e9]) {
      const m = priceMultiplier(r);
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(PRICE_FLOOR);
      expect(m).toBeLessThanOrEqual(PRICE_CEILING);
    }
    // Negative stock should never happen, but must not produce a bonus price.
    expect(priceMultiplier(-5)).toBeLessThanOrEqual(PRICE_CEILING);
  });

  it("scarcity raises prices and glut lowers them", () => {
    // Non-increasing everywhere, and STRICTLY decreasing wherever the clamps
    // aren't binding. The clamps are a safety net, so flat stretches at the
    // extremes are correct rather than a bug.
    const ratios = [0.02, 0.1, 0.3, 0.6, 1, 1.5, 2.5, 4, 20];
    const prices = ratios.map(priceMultiplier);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      const clamped = prices[i] === PRICE_FLOOR || prices[i - 1] === PRICE_CEILING;
      if (!clamped) expect(prices[i]).toBeLessThan(prices[i - 1]);
    }
  });

  it("a comfortably stocked site trades at exactly the base value", () => {
    // By construction, not coincidence. The first version of this curve
    // returned 0.38 at nominal stock, which silently made every price in the
    // game wrong by a factor of nearly three.
    expect(priceMultiplier(1)).toBeCloseTo(1, 10);
  });

  it("scarcity is asymmetric — the last tonne costs far more than the tenth", () => {
    // A site nearly out is buying survival, not goods. A linear curve would
    // make a shortage a number rather than an event.
    const nearlyOut = priceMultiplier(0.05) / priceMultiplier(0.5);
    const lean = priceMultiplier(0.5) / priceMultiplier(1.0);
    expect(nearlyOut).toBeGreaterThan(lean);
  });

  it("survives a century of simulation without any market breaking", () => {
    // The real anti-runaway test: run it and see. Prices must stay bounded and
    // stock must stay non-negative and finite everywhere, for every commodity.
    let markets = initialMarkets();
    for (let i = 0; i < 400; i++) markets = advanceMarkets(markets, 91);
    for (const s of SITES) {
      for (const [id, qty] of Object.entries(markets[s.id].stock)) {
        expect(Number.isFinite(qty), `${s.id}/${id}`).toBe(true);
        expect(qty).toBeGreaterThanOrEqual(0);
        const p = priceAt(markets[s.id], s, id);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(COMMODITY_BY_ID[id].valuePerTonne * PRICE_CEILING);
      }
    }
  });

  it("a producer cannot hoard infinitely and tank its own price forever", () => {
    let markets = initialMarkets();
    for (let i = 0; i < 200; i++) markets = advanceMarkets(markets, 60);
    const luna = markets.shackleton;
    expect(luna.stock.ice).toBeLessThanOrEqual(nominalStock(site("shackleton"), "ice") * 4 + 1e-6);
  });
});

describe("sites make economic sense", () => {
  it("every site produces or consumes something", () => {
    for (const s of SITES) {
      expect(s.produces.length + s.consumes.length, s.id).toBeGreaterThan(0);
    }
  });

  it("no site both produces and consumes the same good", () => {
    for (const s of SITES) {
      for (const p of s.produces) expect(s.consumes, `${s.id}/${p}`).not.toContain(p);
    }
  });

  it("every commodity named by a site actually exists", () => {
    const ids = new Set(COMMODITIES.map((c) => c.id));
    for (const s of SITES) {
      for (const id of [...s.produces, ...s.consumes, ...(s.imports || [])]) {
        expect(ids.has(id), `${s.id} references unknown commodity "${id}"`).toBe(true);
      }
    }
  });

  it("importers start short and producers start stocked — so there is a reason to fly", () => {
    const markets = initialMarkets();
    const luna = markets.shackleton;
    expect(luna.stock.ice / nominalStock(site("shackleton"), "ice")).toBeGreaterThan(1);
    expect(luna.stock.electronics / nominalStock(site("shackleton"), "electronics")).toBeLessThan(1);
  });

  it("the outer system is more dependent than the inner", () => {
    // Callisto can make refined goods and nothing else; Gateway can make almost
    // everything. Dependency should visibly deepen with distance.
    expect(SITE_BY_ID["callisto-station"].imports.length)
      .toBeGreaterThan(SITE_BY_ID.leo.imports.length);
  });
});

describe("trading", () => {
  it("buying costs money and removes stock", () => {
    const markets = initialMarkets();
    const before = markets.leo.stock.electronics;
    const r = buy(markets, "leo", "electronics", 5);
    expect(r.tonnes).toBe(5);
    expect(r.total).toBeGreaterThan(0);
    expect(r.markets.leo.stock.electronics).toBeCloseTo(before - 5, 6);
  });

  it("cannot buy more than exists", () => {
    const markets = initialMarkets();
    const all = markets.leo.stock.electronics;
    const r = buy(markets, "leo", "electronics", all + 500);
    expect(r.tonnes).toBeCloseTo(all, 6);
    expect(r.markets.leo.stock.electronics).toBeCloseTo(0, 6);
    expect(buy(r.markets, "leo", "electronics", 1)).toBeNull();   // now empty
  });

  it("selling pays money and lowers what the market will pay next", () => {
    const markets = initialMarkets();
    const first = priceAt(markets.shackleton, site("shackleton"), "electronics");
    const r = sell(markets, "shackleton", "electronics", 40);
    expect(r.total).toBeGreaterThan(0);
    const after = priceAt(r.markets.shackleton, site("shackleton"), "electronics");
    expect(after).toBeLessThan(first);
  });

  it("a site pays badly for something it has no use for, rather than refusing", () => {
    // Refusing outright would strand cargo, which is more annoying than
    // instructive. A bad price teaches the same lesson and lets you move on.
    const markets = initialMarkets();
    const r = sell(markets, "psyche-works", "volatiles", 10);
    expect(r.unwanted).toBe(true);
    expect(r.unit).toBeLessThan(COMMODITY_BY_ID.volatiles.valuePerTonne);
    expect(r.total).toBeGreaterThan(0);
  });

  it("shortage pays: the same cargo is worth more where it is scarce", () => {
    const markets = initialMarkets();
    const atSource = priceAt(markets.leo, site("leo"), "electronics");
    const atFrontier = priceAt(markets["callisto-station"], site("callisto-station"), "electronics");
    expect(atFrontier).toBeGreaterThan(atSource);
  });

  it("finds real opportunities and rejects fake ones", () => {
    const markets = initialMarkets();
    const cost = shippingCostPerTonne(5.9, DRIVES.methalox.isp);
    const ops = tradeOpportunities(markets, "leo", "shackleton", cost);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops[0].profitPerTonne).toBeGreaterThanOrEqual(ops[ops.length - 1].profitPerTonne);
    // Something must be worth the trip, or the game has no first move.
    expect(ops.some((o) => o.viable)).toBe(true);
  });

  it("all trade functions leave the input markets untouched", () => {
    // The sim is built on pure functions; a mutating market would corrupt
    // saves and make the whole thing untestable.
    const markets = initialMarkets();
    const snapshot = JSON.stringify(markets);
    buy(markets, "leo", "electronics", 3);
    sell(markets, "leo", "electronics", 3);
    advanceMarkets(markets, 30);
    expect(JSON.stringify(markets)).toBe(snapshot);
  });
});

describe("the market screen reads as language, not arithmetic", () => {
  it("labels stock levels in words", () => {
    const markets = initialMarkets();
    const rows = listing(markets["callisto-station"], site("callisto-station"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(["critically short", "short", "steady", "surplus"]).toContain(r.state);
      expect(r.price).toBeGreaterThan(0);
    }
  });
});
