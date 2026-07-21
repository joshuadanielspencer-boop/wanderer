// ===========================================================================
// make-body-plate.mjs — turn a published planetary mosaic into a game plate.
//
// The counterpart of Shutterbug's scripts/make-relief.mjs, and deliberately the
// same shape: YOU download the source mosaic once, by hand, from its product
// page; this script does the resizing and encoding. It does not fetch anything.
//
// That split is on purpose. The authoritative mosaics are hundreds of megabytes
// to tens of gigabytes, the download URLs move, and each product page carries
// the citation and the usage note that project rule 2 wants recorded. A script
// that guessed URLs would rot within a year and would quietly skip the step
// where a human reads the licence.
//
// USAGE
//   node scripts/make-body-plate.mjs <source-image> --body mars [--width 2048]
//
//   → public/plates/mars.jpg   (equirectangular, 2:1, progressive JPEG)
//
// WHERE THE SOURCES COME FROM — USGS Astrogeology's Astropedia catalogue,
// https://astrogeology.usgs.gov/search — which is NASA/USGS work and therefore
// public domain in nearly every case. Search the body name and pick a GLOBAL,
// EQUIRECTANGULAR ("simple cylindrical") mosaic. Known-good products:
//
//   mars       Mars Viking MDIM 2.1 Colorized Global Mosaic 232m
//   luna       Moon LRO LROC WAC Global Morphology Mosaic 100m
//   mercury    Mercury MESSENGER MDIS Basemap MD3 Colour Global Mosaic 665m
//   venus      Venus Magellan Global C3-MDIR Colorized Mosaic 4641m
//   io         Io Galileo/Voyager Global Mosaic 1km
//   europa     Europa Galileo/Voyager Global Mosaic 500m
//   ganymede   Ganymede Galileo/Voyager Global Mosaic 1.4km
//   callisto   Callisto Galileo/Voyager Global Mosaic 1km
//   titan      Titan Cassini ISS Global Mosaic 4km
//   enceladus  Enceladus Cassini ISS Global Mosaic 100m
//   pluto      Pluto New Horizons Global Mosaic 300m
//   charon     Charon New Horizons Global Mosaic 300m
//
// ⚠ CHECK THE LICENCE ON THE PRODUCT PAGE, EVERY TIME. Most of these are USGS
// or NASA and free to use. Some outer-planet products are joint NASA/ESA
// (anything Cassini–Huygens), and ESA's default is CC BY-SA 3.0 IGO, not public
// domain — different obligations. Record what you find in docs/plate-sources.md
// as you go; that file is the audit trail.
//
// WHY 2048×1024 BY DEFAULT: thirty bodies at ~250 KB each is a 7–8 MB app. The
// full-resolution Moon mosaic alone is over 100 GB. The plate only ever needs to
// look right at the zoom the body view actually uses.
// ===========================================================================
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--"));
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const body = flag("body");
const width = Number(flag("width", 2048));

if (!src || !body) {
  console.error("usage: node scripts/make-body-plate.mjs <source-image> --body <id> [--width 2048]");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "public", "plates");
const out = path.join(outDir, `${body}.jpg`);
await mkdir(outDir, { recursive: true });

const meta = await sharp(src, { limitInputPixels: false }).metadata();
const ratio = meta.width / meta.height;

// A global equirectangular plate is 2:1 by definition — 360° of longitude over
// 180° of latitude. Anything else is a regional product, a polar projection, or
// a hemisphere, and the feature pins in the body view (which map lon/lat
// linearly onto the image) would land in the wrong places on it. Better to fail
// loudly here than to ship a map that is subtly, invisibly misaligned.
if (Math.abs(ratio - 2) > 0.02) {
  console.error(
    `\n✗ ${path.basename(src)} is ${meta.width}×${meta.height} (${ratio.toFixed(2)}:1), not 2:1.\n` +
    `  The body view assumes a GLOBAL EQUIRECTANGULAR plate: longitude 0→360 across,\n` +
    `  latitude +90→−90 down. Feature pins are placed by that assumption, so a plate\n` +
    `  in any other projection puts every pin somewhere it isn't.\n` +
    `  Go back to the product page and pick the global simple-cylindrical version.\n`
  );
  process.exit(1);
}

await sharp(src, { limitInputPixels: false })
  .resize(width, width / 2, { fit: "fill", kernel: "lanczos3" })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(out);

const { size } = await sharp(out).metadata().then(() => import("node:fs/promises").then((fs) => fs.stat(out)));
console.log(`✓ ${out}  ${width}×${width / 2}  ${(size / 1024).toFixed(0)} KB`);
console.log(`  Record the source product and its licence in docs/plate-sources.md.`);
