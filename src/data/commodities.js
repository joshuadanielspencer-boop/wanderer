// ===========================================================================
// COMMODITIES — what moves, and what refuses to.
//
// The design principle this file exists to enforce (docs/design.md §5):
//
//   TRADE IS DEPENDENCY, NOT ARBITRAGE.
//
// Buy-low-sell-high hauling assumes transport is cheap enough for price gaps to
// beat it. At 5.6 km/s and eight months to Mars, with ~72% of the departing
// vehicle being propellant, that is false for essentially every bulk commodity.
// A game committed to honest physics cannot also run on interplanetary ore
// speculation.
//
// So `valuePerTonne` is the field that carries the whole economic argument.
// Water ice at $200/t cannot pay for its own transport anywhere — ship it and
// you go broke, which is exactly the lesson. Precision instruments at $9M/t
// cross the solar system happily. The player discovers ISRU not because a tech
// tree unlocked it but because arithmetic forced it.
//
// `tier` drives the campaign arc: RAW must be extracted locally, REFINED can be
// made anywhere with power, INDUSTRIAL needs real plant, ADVANCED effectively
// means Earth for a long time. A colony's dependency is the list of ADVANCED
// goods it cannot yet make, and severing that list is the win condition.
//
// ⚠ PRICES ARE GAME ABSTRACTION, NOT SOURCED FACT (design.md §16). They are
// tuned so the transport arithmetic teaches the right lesson. The RATIOS are
// the honest part — that instruments are ~4 orders of magnitude denser in value
// than ice is real, and is why the one ships and the other never does.
// ===========================================================================

export const TIERS = {
  raw:        { name: "Raw",        note: "Extracted from a body. Too cheap to ship — make it where you need it." },
  refined:    { name: "Refined",    note: "Processed from raw. Needs power more than it needs skill." },
  industrial: { name: "Industrial", note: "Needs real plant. Only a developed site can make these." },
  advanced:   { name: "Advanced",   note: "Needs an industrial base that does not yet exist off Earth." },
};

export const COMMODITIES = [
  // ---- RAW — the stuff that must be local -------------------------------
  {
    id: "ice", name: "Water ice", tier: "raw", unit: "t",
    valuePerTonne: 200,
    note: "Propellant, air, drinking water and radiation shielding — one resource, four needs.",
    lesson: "Never worth shipping. This is why lunar polar ice and Ceres matter so much.",
  },
  {
    id: "ore", name: "Metal ore", tier: "raw", unit: "t",
    valuePerTonne: 340,
    note: "Iron, nickel, aluminium, silicon. Bulk industry starts here.",
  },
  {
    id: "regolith", name: "Regolith", tier: "raw", unit: "t",
    valuePerTonne: 60,
    note: "Loose surface rock. Shielding mass and feedstock — the cheapest thing there is.",
    lesson: "Worth less than the fuel to move a metre of it. Pure local resource.",
  },
  {
    id: "volatiles", name: "Volatiles", tier: "raw", unit: "t",
    valuePerTonne: 450,
    note: "CO₂, nitrogen, methane, ammonia. Life support and chemical feedstock.",
  },

  // ---- REFINED — makeable anywhere with enough power ---------------------
  {
    id: "propellant", name: "Propellant", tier: "refined", unit: "t",
    valuePerTonne: 1200,
    note: "Hydrogen and oxygen, split from water. The currency of movement.",
    lesson: "Made in space, it is cheap. Lifted from Earth, it is absurd — a depot changes what routes exist.",
  },
  {
    id: "lifesupport", name: "Life support", tier: "refined", unit: "t",
    valuePerTonne: 2600,
    note: "Breathable air, water, scrubber media. No loop recycles at 100%.",
    lesson: "The shortfall is the true cost of keeping someone alive, and it compounds with distance.",
  },
  {
    id: "metal", name: "Refined metal", tier: "refined", unit: "t",
    valuePerTonne: 3100,
    note: "Structural alloy and plate. The substance of everything you will ever build.",
  },
  {
    id: "food", name: "Food", tier: "refined", unit: "t",
    valuePerTonne: 5200,
    note: "Grown locally where there is light and water; shipped where there isn't.",
  },

  // ---- INDUSTRIAL — needs a developed site ------------------------------
  {
    id: "parts", name: "Structural parts", tier: "industrial", unit: "t",
    valuePerTonne: 22000,
    note: "Beams, pressure hulls, tankage, habitat modules.",
  },
  {
    id: "machinery", name: "Machinery", tier: "industrial", unit: "t",
    valuePerTonne: 78000,
    note: "Pumps, drills, processors, robotics. What turns a site into a factory.",
  },

  // ---- ADVANCED — Earth, for a long time --------------------------------
  {
    id: "electronics", name: "Electronics", tier: "advanced", unit: "t",
    valuePerTonne: 640000,
    note: "Processors, sensors, avionics. Fabrication needs a supply chain nowhere else has.",
    lesson: "The classic dependency. A colony can make its own air long before it makes its own chips.",
  },
  {
    id: "reactorparts", name: "Reactor components", tier: "advanced", unit: "t",
    valuePerTonne: 1400000,
    note: "Fission plant: the only power worth having past Mars, where sunlight is 1/27th of Earth's.",
    lesson: "The outer system runs on these, and the outer system cannot make them. That is the whole trade route.",
  },
  {
    id: "medical", name: "Medicine", tier: "advanced", unit: "t",
    valuePerTonne: 2800000,
    note: "Pharmaceuticals and clinical supplies. Light, urgent, and impossible to improvise.",
  },
  {
    id: "instruments", name: "Precision instruments", tier: "advanced", unit: "t",
    valuePerTonne: 9000000,
    note: "Laboratory and survey equipment. Value per kilogram so high that transport is a rounding error.",
    lesson: "This is what interplanetary trade actually looks like: small, dear, and irreplaceable.",
  },
];

export const COMMODITY_BY_ID = Object.fromEntries(COMMODITIES.map((c) => [c.id, c]));

/**
 * Roughly what it costs to move one tonne through a given Δv, in dollars.
 *
 * The bridge between propulsion.js and the economy — and the arithmetic the
 * whole design rests on. Propellant needed per tonne of payload comes straight
 * from the rocket equation, so this is exponential in Δv, not linear.
 *
 * `propellantPrice` is per tonne at the departure point, which is why a depot
 * that makes its own propellant changes the map: the same trip costs a fraction
 * as much when you are not lifting the fuel from Earth.
 */
export function shippingCostPerTonne(dvKms, isp, propellantPrice = 1200) {
  const massRatio = Math.exp(dvKms / ((isp * 9.80665) / 1000));
  return (massRatio - 1) * propellantPrice;
}

/**
 * Can this commodity pay its own way over this trip?
 *
 * The single most important query in the economy. Returns the margin as a
 * fraction of the good's value: negative means shipping it destroys value, and
 * the player should be building local capacity instead.
 */
export function shippingMargin(commodityId, dvKms, isp, propellantPrice = 1200) {
  const c = COMMODITY_BY_ID[commodityId];
  if (!c) return null;
  const cost = shippingCostPerTonne(dvKms, isp, propellantPrice);
  return { cost, value: c.valuePerTonne, margin: (c.valuePerTonne - cost) / c.valuePerTonne };
}

/** Everything worth carrying over a given trip, best margin first. */
export const worthShipping = (dvKms, isp, propellantPrice = 1200) =>
  COMMODITIES
    .map((c) => ({ ...c, ...shippingMargin(c.id, dvKms, isp, propellantPrice) }))
    .filter((c) => c.margin > 0)
    .sort((a, b) => b.margin - a.margin);
