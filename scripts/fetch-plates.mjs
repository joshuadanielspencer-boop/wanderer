// ===========================================================================
// fetch-plates.mjs — download the body maps the game draws on.
//
//   node scripts/fetch-plates.mjs            # everything in the manifest
//   node scripts/fetch-plates.mjs mars luna  # just these
//
// WHY WIKIMEDIA COMMONS AND NOT USGS DIRECTLY
// The authoritative products live at USGS Astrogeology, and that is still where
// the provenance comes from — but Astropedia is a JavaScript application whose
// real download links are not in the served HTML, and the underlying files run
// from hundreds of megabytes to tens of gigabytes. Commons re-hosts the same
// USGS/NASA products, records their provenance and licence on the file page,
// and — the part that matters — offers server-side thumbnailing, so a 2048px
// plate costs a few hundred KB instead of 35 MB.
//
// This is the same pattern Shutterbug uses for its landmark photos.
//
// ⚠ EVERY ENTRY BELOW WAS LICENCE-CHECKED BY HAND against the Commons file page
// on the date in `checked`. Do not add a body by guessing a filename. The trap
// is real and it bit on the first pass: the best global Titan mosaic on Commons
// is licensed "Attribution", not public domain, because Cassini is a joint
// NASA/ESA mission and ESA's default is CC BY-SA 3.0 IGO. It is therefore NOT
// in this manifest.
//
// TWO CHECKS THIS SCRIPT MAKES, AND ONE IT CANNOT
//   ✓ 2:1 aspect — a global equirectangular plate is 360° over 180° by
//     definition, and the body view places every pin on that assumption.
//   ✓ the file is reachable and non-trivial in size.
//   ✗ that the image is actually equirectangular. "Callisto Hemispherical
//     Globes" is 2:1 and is two circular globes on a black field; it would sail
//     through the aspect check and put every pin somewhere it isn't. A human
//     has to LOOK at each plate once. That is what `checked` records.
// ===========================================================================
import { mkdir, stat } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";

const PLATES = {
  mars: {
    file: "Mars Viking MDIM21 ClrMosaic 1km.jpg",
    source: "USGS Astrogeology / NASA Viking — MDIM 2.1 colourised global mosaic",
    licence: "Public domain", checked: "2026-07-21",
    note: "21339×10670 at full size. The standard Mars basemap.",
  },
  mercury: {
    file: "Mercury MESSENGER MDIS Basemap BDR Mosaic Global 32ppd.jpg",
    source: "USGS Astrogeology / NASA MESSENGER MDIS — BDR global basemap, 32 px/deg",
    licence: "Public domain", checked: "2026-07-21",
  },
  europa: {
    file: "Europa Voyager GalileoSSI global mosaic.jpg",
    source: "USGS Astrogeology / NASA Voyager + Galileo SSI global mosaic",
    licence: "Public domain", checked: "2026-07-21",
    note: "Only 1024×512 on Commons — Europa has never been mapped better than this "
        + "from one campaign. Fine at the zoom the body view uses.",
  },
  enceladus: {
    file: "Enceladus Color Map.jpg",
    source: "NASA / JPL / Space Science Institute — Cassini colour map",
    licence: "Public domain", checked: "2026-07-21",
    note: "Cassini is joint NASA/ESA; THIS file is PD on Commons but that is not "
        + "automatic for Cassini products. Re-check if it is ever replaced.",
  },

  // ---- NOT YET IN THE MANIFEST, and why ----------------------------------
  // titan      — best global mosaic on Commons is "Attribution", not PD. Needs a
  //              PD USGS product or explicit attribution handling first.
  // callisto   — the 2:1 candidate is "Hemispherical Globes": two circles on
  //              black, not a cylindrical map. Would pass the aspect check and
  //              be wrong. Needs the real USGS cylindrical mosaic.
  // luna, venus, io, ganymede, pluto, charon, triton, miranda
  //            — no verified 2:1 global candidate found yet. Search Commons for
  //              "<body> global mosaic", confirm the projection by LOOKING at
  //              it, confirm the licence on the file page, then add it here.
};

const WIDTH = Number(process.env.PLATE_WIDTH || 2048);
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const wanted = only.length ? only : Object.keys(PLATES);

const outDir = path.join(process.cwd(), "public", "plates");
await mkdir(outDir, { recursive: true });

let ok = 0, failed = 0;
for (const id of wanted) {
  const p = PLATES[id];
  if (!p) { console.error(`✗ ${id}: not in the manifest. Add it deliberately — see the header.`); failed++; continue; }

  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file)}?width=${WIDTH}`;
  const dest = path.join(outDir, `${id}.jpg`);

  try {
    // Commons answers 429 to a script that hurries. Back off and retry rather
    // than dropping the plate — the first run lost two this way.
    let buf = null, wait = 2000;
    for (let attempt = 1; attempt <= 4 && !buf; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": "Wanderer/0.1 (educational game; plate fetch)" } });
      if (res.ok) { buf = Buffer.from(await res.arrayBuffer()); break; }
      if (res.status !== 429 || attempt === 4) throw new Error(`HTTP ${res.status}`);
      process.stdout.write(`  … ${id}: rate limited, waiting ${wait / 1000}s\n`);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
    if (buf.length < 20000) throw new Error(`suspiciously small (${buf.length} bytes)`);

    // Commons' thumbnailer returns a high-quality JPEG — 2.4 MB for Mars at
    // 2048px. Thirty bodies of that is a 70 MB app, which is not a thing you
    // install on an iPad. Re-encode: the plate only ever needs to look right at
    // the zoom the body view uses, and the aspect check happens here because
    // this is the last point where a wrong projection can still be caught.
    const meta = await sharp(buf).metadata();
    const ratio = meta.width / meta.height;
    if (Math.abs(ratio - 2) > 0.02) {
      throw new Error(`${meta.width}×${meta.height} is ${ratio.toFixed(2)}:1, not 2:1 — `
        + `not a global equirectangular plate, every pin would land wrong`);
    }
    await sharp(buf)
      .resize(WIDTH, WIDTH / 2, { fit: "fill", kernel: "lanczos3" })
      .jpeg({ quality: 80, progressive: true, mozjpeg: true })
      .toFile(dest);

    const { size } = await stat(dest);
    console.log(`✓ ${id.padEnd(10)} ${(size / 1024).toFixed(0).padStart(5)} KB   ${p.licence}   ${p.source}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${id.padEnd(10)} ${e.message}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 1500));
}

console.log(`\n${ok} plate${ok === 1 ? "" : "s"} written to public/plates/${failed ? `, ${failed} failed` : ""}.`);
console.log("Provenance and licences are recorded in this script's manifest — keep them together.");
