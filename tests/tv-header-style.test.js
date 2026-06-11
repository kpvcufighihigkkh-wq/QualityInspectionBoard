const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function run() {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");
  const companyBlock = css.match(/\.tv-top-company\s*\{([\s\S]*?)\n\}/);
  const toplineBlock = css.match(/\.tv-topline\s*\{([\s\S]*?)\n\}/);
  const toplineTrackBlock = css.match(/\.topline-track\s*\{([\s\S]*?)\n\}/);
  const toplinePulseBlock = css.match(/\.topline-pulse\s*\{([\s\S]*?)\n\}/);
  const shellBeforeBlock = css.match(/\.tv-shell::before\s*\{([\s\S]*?)\n\}/);
  const shellBlock = css.match(/\.tv-shell\s*\{([\s\S]*?)\n\}/);
  const brandBlock = css.match(/\.tv-brand\s*\{([\s\S]*?)\n\}/);
  const brandLogoBlock = css.match(/\.tv-brand-logo\s*\{([\s\S]*?)\n\}/);

  assert.ok(companyBlock, "missing .tv-top-company block");
  assert.ok(toplineBlock, "missing .tv-topline block");
  assert.ok(toplineTrackBlock, "missing .topline-track block");
  assert.ok(toplinePulseBlock, "missing .topline-pulse block");
  assert.ok(shellBeforeBlock, "missing .tv-shell::before block");
  assert.ok(shellBlock, "missing .tv-shell block");
  assert.ok(brandBlock, "missing .tv-brand block");
  assert.ok(brandLogoBlock, "missing .tv-brand-logo block");

  assert.match(companyBlock[1], /display:\s*flex;/);
  assert.match(companyBlock[1], /align-items:\s*center;/);
  assert.match(companyBlock[1], /height:\s*48px;/);
  assert.match(companyBlock[1], /top:\s*50%;/);
  assert.match(companyBlock[1], /transform:\s*translateY\(-50%\);/);
  assert.match(companyBlock[1], /background:\s*transparent;/);
  assert.match(shellBeforeBlock[1], /display:\s*none;/);
  assert.match(shellBlock[1], /linear-gradient\(180deg,\s*rgba\(24,\s*168,\s*255,\s*0\.08\),\s*transparent 12%\)/);
  assert.match(brandBlock[1], /padding-right:\s*220px;/);
  assert.match(brandLogoBlock[1], /right:\s*24px;/);
  assert.match(brandLogoBlock[1], /width:\s*min\(180px,\s*18%\);/);
  assert.match(toplineBlock[1], /height:\s*48px;/);
  assert.match(toplineBlock[1], /margin-top:\s*8px;/);
  assert.match(toplineTrackBlock[1], /inset:\s*2px 60px 0 940px;/);
  assert.match(toplinePulseBlock[1], /top:\s*-4px;/);

  console.log("tv header style tests passed");
}

run();
