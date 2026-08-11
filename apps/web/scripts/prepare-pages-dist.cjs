// ─── Prepare pages-dist for Cloudflare Pages Deploy ─────────────
// OpenNext outputs worker.js + assets/ in .open-next/.
// Cloudflare Pages Advanced Mode expects:
//   _worker.js  (with underscore) — the Worker entrypoint
//   _next/static/* at root          — static assets served by Pages CDN
//   _routes.json                    — excludes static assets from Worker
//   BUILD_ID at root                — Next.js build fingerprint
//
// This script:
// 1. Copies .open-next/ → pages-dist/
// 2. Renames worker.js → _worker.js
// 3. Copies assets/_next/ to root _next/ (so Pages CDN finds them)
// 4. Copies assets/BUILD_ID to root
// 5. Creates _routes.json excluding static assets + favicon
// =================================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, ".open-next");
const DEST = path.join(ROOT, "pages-dist");

// ── Copy .open-next → pages-dist ────────────────────────────
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
copyDirRecursive(SRC, DEST);
console.log("✓ Copied .open-next/ → pages-dist/");

// ── Rename worker.js → _worker.js ───────────────────────────
const workerSrc = path.join(DEST, "worker.js");
const workerDest = path.join(DEST, "_worker.js");
if (fs.existsSync(workerSrc)) {
  fs.renameSync(workerSrc, workerDest);
  console.log("✓ Renamed worker.js → _worker.js");
} else {
  console.error("✗ worker.js not found in pages-dist/");
  process.exit(1);
}

// ── Extract assets to root (Pages CDN serves from root) ──────
const assetsDir = path.join(DEST, "assets");
if (fs.existsSync(assetsDir)) {
  // Copy _next/static from assets/ to root
  const srcNext = path.join(assetsDir, "_next");
  const dstNext = path.join(DEST, "_next");
  if (fs.existsSync(srcNext)) {
    copyDirRecursive(srcNext, dstNext);
    console.log("✓ Extracted assets/_next/ → _next/");
  }

  // Copy BUILD_ID
  const srcBuildId = path.join(assetsDir, "BUILD_ID");
  const dstBuildId = path.join(DEST, "BUILD_ID");
  if (fs.existsSync(srcBuildId)) {
    fs.copyFileSync(srcBuildId, dstBuildId);
    console.log("✓ Copied BUILD_ID to root");
  }
}

// ── Create _routes.json ──────────────────────────────────────
const routes = {
  version: 1,
  include: ["/*"],
  exclude: ["/_next/static/*", "/favicon.ico", "/BUILD_ID"],
};
fs.writeFileSync(path.join(DEST, "_routes.json"), JSON.stringify(routes) + "\n");
console.log("✓ Created _routes.json");

console.log("\n✓ pages-dist/ is ready for deploy. Run: npx wrangler pages deploy pages-dist --project-name aerdigital --branch master");

// ── Helpers ──────────────────────────────────────────────────
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
