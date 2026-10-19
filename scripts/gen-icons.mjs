// Generates PWA PNG icons from the SVG mark using sharp (ships with Next.js).
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

const iconsDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const svg = readFileSync(join(iconsDir, "icon.svg"));
mkdirSync(iconsDir, { recursive: true });

const jobs = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png()
    .toFile(join(iconsDir, name));
  console.log("wrote", name);
}
