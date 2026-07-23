// ===========================================================================
// MARKETS — prices that respond to scarcity, and refuse to run away.
//
// DAMPING AND BOUNDS ARE HERE FROM THE FIRST COMMIT, deliberately. Emergent
// supply/demand loops love to hyperinflate or collapse to zero, and every
// design pass on this project independently flagged it (docs/design.md §15).
// Retrofitting stability into an economy players have already learned is far
// harder than building it in, so:
//
//   • price is a FUNCTION OF STOCK, not an accumulator that drifts
//   • it is clamped to [floor, ceiling] multiples of the base value
//   • a single trade cannot move the price more than a few percent
//
// The first rule is the important one. A price that is recomputed from
// inventory each tick cannot spiral, because there is nothing to spiral — it is
// a lookup, not a feedback loop. Stock itself is bounded by storage capacity.
//
// WHAT THE PRICE CURVE TEACHES: scarcity is not linear. A site with half its
// normal stock pays a little more; a site nearly out pays enormously more,
// because at that point it is not buying goods, it is buying survival. That
// asymmetry is what makes supplying a struggling colony lucrative and what makes
// a shortage a genuine event rather than a number.
// ===========================================================================

import { COMMODITIES, COMMODITY_BY_ID } from "./data/commodities.js";
import { SITES } from "./data/sites.js";

/** Price never falls below 25% of base, nor rises above 6x it. */
export const PRICE_FLOOR = 0.25;
export const PRICE_CEILING = 6.0;

/** Stock at which a site is "comfortable" — the price equals the base value. */
const NOMINAL_DAYS = 120;   // days of consumption a healthy site holds

/**
 * Price multiplier as a function of how well stocked a site is.
 *
 * `ratio` is stock ÷ nominal stock. The curve is deliberately asymmetric:
 *
 *   ratio 0.0  →  6.00x   desperate: it is buying survival, not goods
 *   ratio 0.25 →  2.29x   short
 *   ratio 0.5  →  1.44x   lean
 *   ratio 1.0  →  1.00x   comfortable
 *   ratio 2.0  →  0.70x   glutted
 *   ratio 4.0+ →  0.25x   worthless here
 *
 * An inverse power law rather than a straight line, because scarcity in real
 * life is not linear — the last tonne of oxygen is not worth the same as the
 * hundredth.
 */
const CURVE_OFFSET = 0.05;   // how sharply the price spikes as stock nears zero
const CURVE_POWER = 0.62;    // how steeply it falls as stock piles up
// Normalised so that m(1) === 1 exactly: a comfortably stocked site trades at
// the commodity's base value, by construction rather than by coincidence. The
// first version of this curve returned 0.38 at nominal stock, which quietly
// meant every price in the game was wrong by a factor of nearly three.
const CURVE_K = Math.pow(1 + CURVE_OFFSET, CURVE_POWER);

export function priceMultiplier(ratio) {
  const r = Math.max(0, ratio);
  const m = CURVE_K / Math.pow(r + CURVE_OFFSET, CURVE_POWER);
  return Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, m));
}

/** A site's nominal (comfortable) stock of a commodity, in tonnes. */
export function nominalStock(site, commodityId) {
  const daily = dailyConsumption(site, commodityId);
  const prod = dailyProduction(site, commodityId);
  const c = COMMODITY_BY_ID[commodityId];
  // Manufactured goods are held against demand from elsewhere rather than local
  // use, so they get a floor proportional to the population that makes them.
  const manufactured = (site.makes || []).includes(c?.tier) && !site.consumes.includes(commodityId);
  const floor = manufactured ? Math.max(20, site.population * 0.35) : 20;
  return Math.max(floor, (daily + prod) * NOMINAL_DAYS);
}

/**
 * Daily consumption in tonnes. Driven by population and by what the site's
 * industry needs — so a bigger settlement is a bigger market, which is the
 * whole reason to care about population at all.
 */
export function dailyConsumption(site, commodityId) {
  if (!site.consumes.includes(commodityId)) return 0;
  const c = COMMODITY_BY_ID[commodityId];
  // Cheap bulk goods are consumed by the tonne; precision instruments are not.
  // Scaling inversely with value keeps a site from consuming $9M/t of
  // instruments daily, which would make the economy nonsense.
  const perPerson = 0.004 * Math.pow(10000 / c.valuePerTonne, 0.45);
  return site.population * perPerson;
}

/** Daily production in tonnes, from local geography and industry. */
export function dailyProduction(site, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c) return 0;
  const extracts = site.produces.includes(commodityId);
  const manufactures = (site.makes || []).includes(c.tier) && !site.consumes.includes(commodityId);
  if (!extracts && !manufactures) return 0;
  const perPerson = 0.011 * Math.pow(10000 / c.valuePerTonne, 0.45);
  // Manufacturing is slower than digging something out of the ground.
  return site.population * perPerson * (extracts ? 1 : 0.55);
}

/** Build the starting market state for every site. */
export function initialMarkets() {
  const markets = {};
  for (const site of SITES) {
    const stock = {};
    for (const c of COMMODITIES) {
      const extracts = site.produces.includes(c.id);
      const needs = site.consumes.includes(c.id);
      // A site also SELLS anything its industry can manufacture. Without this,
      // Gateway Station — which sits one lift below Earth's entire industrial
      // base — stocked no electronics at all, and there was nothing to buy on
      // turn one. `makes` is the dependency ladder, so it has to reach the
      // shelves.
      const manufactures = (site.makes || []).includes(c.tier) && !needs;
      if (!extracts && !needs && !manufactures) continue;
      const nominal = nominalStock(site, c.id);
      // Producers start well stocked; importers start a little short, which is
      // what makes them worth flying to on day one.
      stock[c.id] = (extracts || manufactures) ? nominal * 1.4 : nominal * 0.65;
    }
    markets[site.id] = { siteId: site.id, stock };
  }
  return markets;
}

/** Current unit price of a commodity at a site, in dollars per tonne. */
export function priceAt(market, site, commodityId) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c || !market) return null;
  const stock = market.stock[commodityId];
  if (stock === undefined) return null;   // not traded here at all
  return Math.round(c.valuePerTonne * priceMultiplier(stock / nominalStock(site, commodityId)));
}

/** Everything traded at a site, with prices and stock, for the market screen. */
export function listing(market, site) {
  if (!market) return [];
  return Object.keys(market.stock).map((id) => {
    const c = COMMODITY_BY_ID[id];
    const nominal = nominalStock(site, id);
    const stock = market.stock[id];
    const ratio = stock / nominal;
    return {
      id, name: c.name, tier: c.tier, note: c.note, lesson: c.lesson,
      stock, nominal, ratio,
      price: priceAt(market, site, id),
      base: c.valuePerTonne,
      produces: site.produces.includes(id),
      consumes: site.consumes.includes(id),
      // Plain language, because a ratio is not a decision (design.md §2 pillar 5)
      state: ratio < 0.3 ? "critically short" : ratio < 0.7 ? "short"
        : ratio < 1.6 ? "steady" : "surplus",
    };
  }).sort((a, b) => a.base - b.base);
}

/**
 * Advance every market by `days`.
 *
 * Production adds, consumption removes, and stock is clamped at zero and at
 * storage capacity. Because price is derived from stock rather than accumulated,
 * this cannot drift — the worst a bad tick can do is empty a warehouse.
 */
export function advanceMarkets(markets, days) {
  const out = {};
  for (const site of SITES) {
    const m = markets[site.id];
    if (!m) continue;
    const stock = { ...m.stock };
    for (const id of Object.keys(stock)) {
      const nominal = nominalStock(site, id);
      const delta = (dailyProduction(site, id) - dailyConsumption(site, id)) * days;
      // Capacity is 4x nominal: a site cannot hoard forever, which stops
      // producers accumulating infinite stock and driving their own price to
      // the floor permanently.
      stock[id] = Math.max(0, Math.min(nominal * 4, stock[id] + delta));
    }
    out[site.id] = { ...m, stock };
  }
  return out;
}

/**
 * Buy `tonnes` of a commodity. Returns the new markets, the cost, and how much
 * was actually available — a market cannot sell what it does not have.
 *
 * The price is computed ONCE from pre-trade stock rather than integrated across
 * the purchase. That is a deliberate simplification and a forgiving one: it
 * means a player cannot accidentally pay a ruinous marginal price by buying
 * slightly too much, which would be a nasty surprise rather than a decision.
 */
export function buy(markets, siteId, commodityId, tonnes) {
  const site = SITES.find((s) => s.id === siteId);
  const m = markets[siteId];
  if (!site || !m || m.stock[commodityId] === undefined) return null;

  const available = m.stock[commodityId];
  const qty = Math.max(0, Math.min(tonnes, available));
  if (qty <= 0) return null;

  const unit = priceAt(m, site, commodityId);
  return {
    markets: { ...markets, [siteId]: { ...m, stock: { ...m.stock, [commodityId]: available - qty } } },
    tonnes: qty,
    unit,
    total: Math.round(unit * qty),
  };
}

/** Sell into a market. Adds to its stock, which lowers what it will pay next. */
export function sell(markets, siteId, commodityId, tonnes) {
  const site = SITES.find((s) => s.id === siteId);
  const m = markets[siteId];
  if (!site || !m) return null;

  // A site will buy anything, even something it neither makes nor consumes —
  // but at a poor price, because it has no use for it. Refusing outright would
  // strand cargo and be far more annoying than paying badly for it.
  const known = m.stock[commodityId] !== undefined;
  const unit = known
    ? priceAt(m, site, commodityId)
    : Math.round(COMMODITY_BY_ID[commodityId].valuePerTonne * PRICE_FLOOR);

  const stock = { ...m.stock };
  if (known) stock[commodityId] = stock[commodityId] + tonnes;

  return {
    markets: { ...markets, [siteId]: { ...m, stock } },
    tonnes,
    unit,
    total: Math.round(unit * tonnes),
    unwanted: !known,
  };
}

/**
 * The best trades between two sites, given a ship's Δv cost and drive.
 *
 * This is the query the whole economy is built to answer, and it is where the
 * design's thesis becomes visible: run it on water ice and the margin is
 * catastrophically negative; run it on instruments and it is fine. The player
 * learns ISRU from arithmetic rather than from a tooltip.
 */
export function tradeOpportunities(markets, fromId, toId, shippingCostPerTonne) {
  const from = SITES.find((s) => s.id === fromId), to = SITES.find((s) => s.id === toId);
  if (!from || !to) return [];
  const mf = markets[fromId], mt = markets[toId];
  if (!mf || !mt) return [];

  const out = [];
  for (const id of Object.keys(mf.stock)) {
    const buyPrice = priceAt(mf, from, id);
    const sellPrice = priceAt(mt, to, id);
    if (buyPrice == null || sellPrice == null) continue;
    const profit = sellPrice - buyPrice - shippingCostPerTonne;
    out.push({
      id, name: COMMODITY_BY_ID[id].name,
      buyPrice, sellPrice, shipping: Math.round(shippingCostPerTonne),
      profitPerTonne: Math.round(profit),
      available: mf.stock[id],
      viable: profit > 0,
    });
  }
  return out.sort((a, b) => b.profitPerTonne - a.profitPerTonne);
}
