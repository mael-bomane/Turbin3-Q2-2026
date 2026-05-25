#!/usr/bin/env node
/**
 * Generate Open Graph PNG images for all pages and articles.
 * Uses SVG + rsvg-convert (must be installed: `sudo pacman -S librsvg`).
 *
 * Usage:
 *   node scripts/gen-og.mjs
 *   node scripts/gen-og.mjs --force   # overwrite existing images
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FORCE = process.argv.includes("--force");

// ── OG dimensions ─────────────────────────────────────────────────────────────
const W = 1200;
const H = 630;

// ── Brand image (appName only, solana-green) ───────────────────────────────────
const APP_NAME = "trib3";
const SOLANA_GREEN = "#14F195";

// ── Gradient palette (from title.tsx) ─────────────────────────────────────────
// linear-gradient(60deg, #BBFF99, #99FFDD, #99BAFF, #DD99FF, #FF99BA, #FFDD99)
const PALETTE = ["#BBFF99", "#99FFDD", "#99BAFF", "#DD99FF", "#FF99BA", "#FFDD99"];

/** Pick a random rotation of the palette so each image gets a varied gradient. */
function randomPalette() {
  const offset = Math.floor(Math.random() * PALETTE.length);
  return [...PALETTE.slice(offset), ...PALETTE.slice(0, offset)];
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wrap text into lines with a rough character-width heuristic.
 * Uppercase and wide chars count more than narrow ones.
 */
function wrapTitle(title, maxWidth = 22) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build an SVG string for the given title.
 */
function buildSVG(title) {
  const colors = randomPalette();

  // Gradient stops (equal spacing)
  const stops = colors
    .map(
      (c, i) =>
        `    <stop offset="${((i / (colors.length - 1)) * 100).toFixed(1)}%" stop-color="${c}"/>`
    )
    .join("\n");

  // SVG linearGradient approximating CSS linear-gradient(60deg, …)
  // Computed via: start = center − len·(sin60, −cos60), end = center + len·(sin60, −cos60)
  // where len = |W/2·sin60 + H/2·cos60|
  const sin60 = Math.sin((60 * Math.PI) / 180);
  const cos60 = Math.cos((60 * Math.PI) / 180);
  const cx = W / 2, cy = H / 2;
  const len = Math.abs(cx * sin60 + cy * cos60);
  const x1 = (cx - len * sin60).toFixed(1);
  const y1 = (cy + len * cos60).toFixed(1);
  const x2 = (cx + len * sin60).toFixed(1);
  const y2 = (cy - len * cos60).toFixed(1);

  // Auto-size font and wrap based on title length
  const lines = wrapTitle(title, title.length > 18 ? 18 : 22);
  const fontSize = lines.length === 1
    ? (title.length <= 12 ? 130 : title.length <= 18 ? 110 : 90)
    : 90;
  const lineHeight = fontSize * 1.15;
  const totalH = lines.length * lineHeight;
  const startY = (H - totalH) / 2 + fontSize;

  const textEls = lines
    .map(
      (line, i) =>
        `  <text x="${cx}" y="${(startY + i * lineHeight).toFixed(1)}" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
${stops}
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#000"/>
  <g font-family="Inter" font-weight="800" font-size="${fontSize}" fill="url(#g)" letter-spacing="-2">
${textEls}
  </g>
</svg>`;
}

/**
 * Build a brand SVG: black bg, centered solana-green appName.
 */
function buildBrandSVG(width, height) {
  const fontSize = Math.round(height * 0.4);
  const cx = width / 2;
  const cy = height / 2 + fontSize * 0.34;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#000"/>
  <text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${fontSize}" letter-spacing="-${(fontSize * 0.03).toFixed(1)}" fill="${SOLANA_GREEN}">${APP_NAME}</text>
</svg>`;
}

/**
 * Write the SVG to a tmp file, convert to PNG with rsvg-convert, then clean up.
 */
function generateImage(svg, outputPath, width, height) {
  if (!FORCE && fs.existsSync(outputPath)) {
    console.log(`  skip  ${path.relative(ROOT, outputPath)}  (already exists)`);
    return;
  }

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = outputPath.replace(/\.png$/, ".__tmp__.svg");
  fs.writeFileSync(tmp, svg, "utf8");

  try {
    execSync(`rsvg-convert -w ${width} -h ${height} "${tmp}" -o "${outputPath}"`, {
      stdio: "pipe",
    });
    console.log(`  gen   ${path.relative(ROOT, outputPath)}`);
  } finally {
    fs.unlinkSync(tmp);
  }
}

// ── Page list ──────────────────────────────────────────────────────────────────
// `kind: "brand"` uses logo + appName (Header style); `kind: "title"` uses title text.
const PAGES = [
  { kind: "brand", out: "app/opengraph-image.png", w: 1200, h: 660 },
  { kind: "brand", out: "app/twitter-image.png", w: 1200, h: 660 },
  { kind: "title", title: "escrow", out: "public/images/home.png", w: W, h: H },
];

// ── Articles from MDX frontmatter ─────────────────────────────────────────────
const contentDir = path.join(ROOT, "content");
if (fs.existsSync(contentDir)) {
  const mdxFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));
  for (const file of mdxFiles) {
    const slug = file.replace(/\.mdx$/, "");
    const src = fs.readFileSync(path.join(contentDir, file), "utf8");
    const m = src.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const title = m ? m[1] : slug;
    PAGES.push({ kind: "title", title, out: `public/images/article/${slug}.png`, w: W, h: H });
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
console.log(`\nGenerating ${PAGES.length} OG images (${FORCE ? "force" : "skip existing"})...\n`);

let generated = 0;
for (const page of PAGES) {
  const absOut = path.join(ROOT, page.out);
  const existed = fs.existsSync(absOut);
  const svg = page.kind === "brand" ? buildBrandSVG(page.w, page.h) : buildSVG(page.title);
  generateImage(svg, absOut, page.w, page.h);
  if (!existed) generated++;
}

console.log(`\nDone. ${generated} new image(s) written.\n`);
