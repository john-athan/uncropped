/**
 * Validate the store package before anybody uploads it.
 *
 * The Chrome Web Store rejects on things that are cheap to check here and
 * expensive to discover there: a field over its character limit, a missing
 * icon size, a file the manifest names but the zip does not carry. A rejection
 * also costs a review cycle, which is days rather than minutes.
 *
 *   node scripts/check-package.mjs uncropped-1.0.0.zip
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const zip = resolve(process.argv[2] || `uncropped-${manifest.version}.zip`);

const listing = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((n) => !n.endsWith('/'));

const problems = [];
const notes = [];

// Store limits, as the dashboard enforces them.
if (manifest.name.length > 45) problems.push(`name is ${manifest.name.length} chars, limit 45`);
if (manifest.description.length > 132) {
  problems.push(`description is ${manifest.description.length} chars, limit 132`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
  problems.push(`version "${manifest.version}" is not a valid extension version`);
}

for (const size of ['16', '48', '128']) {
  const icon = manifest.icons && manifest.icons[size];
  if (!icon) problems.push(`no ${size}px icon declared`);
  else if (!listing.includes(icon)) problems.push(`${size}px icon declared but not packed: ${icon}`);
}

// Everything the manifest points at has to be inside the zip, or the extension
// installs and then fails in a way only the user ever sees.
function walk(value) {
  if (typeof value === 'string') {
    if (/\.(js|html|css|png|json)$/.test(value) && !listing.includes(value)) {
      problems.push(`referenced but not packed: ${value}`);
    }
  } else if (Array.isArray(value)) value.forEach(walk);
  else if (value && typeof value === 'object') Object.values(value).forEach(walk);
}
walk(manifest);

// Some files are named nowhere in the manifest: content.js and geometry.js are
// handed to chrome.scripting, and offscreen.html pulls its own scripts. The walk
// above cannot see any of that, and a file missed here ships an extension that
// installs cleanly and then does nothing. geometry.js was added and left out of
// this zip on the same afternoon, which is exactly how that goes.
//
// So rather than a list to keep in step by hand, the two places that name a file
// outside the manifest are read for what they actually name.
const injected = [
  ...readFileSync('background.js', 'utf8').matchAll(/files:\s*\[([^\]]*)\]/g),
].flatMap((m) => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((f) => f[1]));

const fromHtml = listing
  .filter((n) => n.endsWith('.html'))
  .flatMap((n) => [...readFileSync(n, 'utf8').matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((m) => m[1]));

for (const required of new Set([
  ...injected, ...fromHtml,
  'content.js', 'offscreen.html', 'offscreen.js', 'options.html', 'options.js',
])) {
  if (!listing.includes(required)) problems.push(`missing from the package: ${required}`);
}

// Nothing that is not the extension. A stray test or dotfile is not a
// rejection, but it is a bigger review surface and a wider licence question.
const allowed = /^(manifest\.json|LICENSE|icons\/icon(16|32|48|128)\.png|(background|content|geometry|offscreen|options)\.(js|html))$/;
for (const name of listing) {
  if (!allowed.test(name)) problems.push(`unexpected file in the package: ${name}`);
  if (/(^|\/)\./.test(name)) problems.push(`hidden file in the package: ${name}`);
}

// The listing claims no network calls, no remote code and no HTML injection.
// Check the claim against the files that are actually going to be uploaded.
//
// fetch() on a data: URL is the documented way to turn a data URL into a Blob
// and reaches no network, so it is allowed by exact shape and nothing wider.
const DATA_URL_FETCH = /await fetch\(dataUrl\)/g;
for (const name of listing.filter((n) => n.endsWith('.js'))) {
  const body = readFileSync(name, 'utf8').replace(DATA_URL_FETCH, 'DECODE_DATA_URL');
  for (const [pattern, why] of [
    [/\beval\s*\(/, 'eval()'],
    [/new\s+Function\s*\(/, 'new Function()'],
    [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.connection/, 'a network call'],
    [/\.innerHTML\s*=|insertAdjacentHTML|document\.write/, 'HTML injection'],
    [/https?:\/\/(?!(www\.)?(w3\.org|github\.com\/john-athan))/, 'a remote URL'],
  ]) {
    if (pattern.test(body)) {
      problems.push(`${name} contains ${why}, which the listing says it does not`);
    }
  }
}

// The page half carries its own version string for the console log. Drift
// between it and the manifest turns a bug report into a wrong answer.
const inPage = readFileSync('content.js', 'utf8').match(/VERSION\s*=\s*'([^']+)'/);
if (!inPage) problems.push('content.js no longer declares a VERSION');
else if (inPage[1] !== manifest.version) {
  problems.push(`content.js says version ${inPage[1]}, manifest says ${manifest.version}`);
}

if (manifest.permissions) notes.push(`permissions: ${manifest.permissions.join(', ')}`);
if (manifest.host_permissions) {
  problems.push(`host_permissions crept back in: ${manifest.host_permissions.join(', ')}`);
}
for (const cs of manifest.content_scripts || []) {
  problems.push(`a declared content script crept back in: ${cs.matches.join(', ')}`);
}
if (manifest.minimum_chrome_version) notes.push(`minimum Chrome: ${manifest.minimum_chrome_version}`);

console.log(`${listing.length} files packed, version ${manifest.version}`);
for (const note of notes) console.log(`  ${note}`);
if (problems.length) {
  console.error('\nProblems:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\nPackage looks acceptable to the store.');
