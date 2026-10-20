// Generates PWA PNG icons from the SVG mark.
// Uses resvg (bundled HarfBuzz) so Urdu Nastaliq text shapes correctly —
// the fonts live in scripts/fonts/ so rendering needs no network or system fonts.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

const root = fileURLToPath(new URL("..", import.meta.url));
const iconsDir = join(root, "public/icons");
const fontsDir = join(root, "scripts/fonts");
const svg = readFileSync(join(iconsDir, "icon.svg"), "utf8");
mkdirSync(iconsDir, { recursive: true });

const FONT_OPTS = {
  font: {
    fontFiles: [
      join(fontsDir, "noto-nastaliq-700.ttf"),
      join(fontsDir, "inter-800.ttf"),
    ],
    loadSystemFonts: true,
    defaultFontFamily: "Inter",
  },
};

function render(svgText, size) {
  const r = new Resvg(svgText, {
    fitTo: { mode: "width", value: size },
    ...FONT_OPTS,
  });
  return r.render().asPng();
}

// Variant: shrink all inner content for the maskable safe zone (~62%).
function maskableVariant(s) {
  return s
    .replace(/<g filter="url\(#softShadow\)">/, '<g transform="translate(256 256) scale(0.68) translate(-256 -256)"><g filter="url(#softShadow)">')
    .replace(/<\/g>\s*<\/svg>\s*$/, "</g></g></svg>");
}

const jobs = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", maskableVariant(svg), 512],
  ["apple-touch-icon.png", svg, 180],
];

for (const [name, src, size] of jobs) {
  const png = render(src, size);
  const out = join(iconsDir, name);
  const { writeFileSync } = await import("fs");
  writeFileSync(out, png);
  console.log("wrote", name, size + "px");
}
