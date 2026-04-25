#!/usr/bin/env node
/**
 * seedFoods.js — one-shot seeder for the Firestore `food_library` collection.
 *
 * Reads every JSON file under scripts/data/, validates each record, injects
 * a prefix-token search index, and writes to Firestore with stable doc IDs
 * so re-running is idempotent (each run is an upsert, not a duplicate).
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/seedFoods.js
 *
 *   # Or target one file:
 *   node scripts/seedFoods.js scripts/data/foods_expanded.json
 *
 *   # Dry run — validates tokens + schema but writes nothing:
 *   DRY_RUN=1 node scripts/seedFoods.js
 *
 * Schema (per entry in the JSON files):
 *   {
 *     "id": "lahmacun",                          // REQUIRED, slug, no spaces
 *     "name": "Lahmacun",                        // REQUIRED, English or base name
 *     "name_tr": "Lahmacun",                     // REQUIRED, Turkish name
 *     "calories": 250, "protein": 12,            // REQUIRED per-100g
 *     "carbs": 30, "fat": 9,                     // REQUIRED per-100g
 *     "fiber": 2, "sugar": 1,                    // optional
 *     "serving_size": 100, "serving_unit": "g",  // optional (defaults 100 g)
 *     "category": "street_food",                 // optional
 *     "cuisine": "turkish",                      // optional
 *     "source": "usda",                          // REQUIRED: usda | turkomp | curated
 *     "source_ref": "FDC 1234567"                // optional — for audit trail
 *   }
 *
 * The script auto-computes `search_tokens` and `verified=true` and sets
 * `updated_at` to the run time.
 *
 * IMPORTANT: calorie accuracy is the single critical contract of this
 * collection. Do not add entries without a verifiable source (USDA FDC
 * ID, TürKomp reference, or an audited curated value).
 */

const fs = require('fs');
const path = require('path');

// firebase-admin is loaded lazily — only required when actually writing to
// Firestore. This lets DRY_RUN mode work without the dep installed, which
// is handy in CI or fresh clones that only want to validate data shape.
let admin = null;
function loadAdmin() {
  if (admin) return admin;
  try {
    admin = require('firebase-admin');
    return admin;
  } catch (e) {
    console.error('\n[seedFoods] Missing dep `firebase-admin`.');
    console.error('Install it with:\n  npm install --no-save firebase-admin\n');
    process.exit(1);
  }
}

const PROJECT_ID = 'fittrack-a958c';
const COLLECTION = 'food_library';
const DATA_DIR = path.join(__dirname, 'data');
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

/**
 * Strip Turkish diacritics. Must stay in lockstep with the
 * `normalizeToken` function in src/services/firebase/foodFirestore.ts —
 * otherwise the client's array-contains query will miss entries.
 */
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Emit prefix tokens for every word in the name. For "pizza margherita"
 * we get ["pi","piz","pizz","pizza","ma","mar","marg","marghe","margheri",...].
 * This lets the client find the record by typing any prefix of any word.
 *
 * Capped at 24 chars per token to keep array size bounded — longer words
 * are rare and a 24-prefix matches anything reasonable.
 */
function buildSearchTokens(name, nameTr, cuisine, category) {
  const seen = new Set();
  const sources = [name, nameTr, cuisine, category].filter(Boolean);
  for (const src of sources) {
    // Strip parentheticals first — things like "Pizza (Thin Crust)" would
    // otherwise produce noise tokens like "nc" from "İnce" that match
    // unrelated queries. The important keywords are nearly always
    // outside the parens (primary name), so we lose nothing by dropping
    // them for indexing purposes.
    const stripped = String(src).replace(/\(.*?\)/g, ' ');
    const words = normalize(stripped).split(' ').filter(Boolean);
    for (const w of words) {
      // Skip words shorter than 3 chars — they produce noisy 2-char
      // prefixes that match nearly everything. 3+ char words still
      // generate 2-char prefixes (good for partial typing), but we
      // skip seeding short filler like "ve", "de", "le".
      if (w.length < 3) continue;
      for (let i = 2; i <= Math.min(w.length, 24); i++) {
        seen.add(w.slice(0, i));
      }
      // Full word (for direct equality searches).
      seen.add(w);
    }
  }
  return Array.from(seen).sort();
}

function validateEntry(e, fileName, idx) {
  const errs = [];
  const need = ['id', 'name', 'name_tr', 'calories', 'protein', 'carbs', 'fat', 'source'];
  for (const k of need) {
    if (e[k] === undefined || e[k] === null || e[k] === '') {
      errs.push(`missing ${k}`);
    }
  }
  if (typeof e.id === 'string' && !/^[a-z0-9_]+$/.test(e.id)) {
    errs.push(`id must be [a-z0-9_]+ slug (got "${e.id}")`);
  }
  const numeric = ['calories', 'protein', 'carbs', 'fat'];
  for (const k of numeric) {
    if (typeof e[k] !== 'number' || !isFinite(e[k]) || e[k] < 0) {
      errs.push(`${k} must be a non-negative number`);
    }
  }
  if (typeof e.calories === 'number' && e.calories > 900) {
    // 900 kcal/100g is the theoretical ceiling (100g of pure fat = 900).
    // Anything higher is almost certainly a data-entry error.
    errs.push(`calories (${e.calories}) exceeds physical limit of 900 kcal/100g — check source`);
  }
  if (errs.length) {
    console.error(`\n✗ ${fileName} entry #${idx + 1} ("${e.id || '??'}"):`);
    for (const err of errs) console.error(`    - ${err}`);
    return false;
  }
  return true;
}

function loadAllData(explicitFile) {
  const files = [];
  if (explicitFile) {
    files.push(path.resolve(explicitFile));
  } else {
    if (!fs.existsSync(DATA_DIR)) {
      throw new Error(`Data dir ${DATA_DIR} does not exist`);
    }
    for (const f of fs.readdirSync(DATA_DIR)) {
      if (f.endsWith('.json')) files.push(path.join(DATA_DIR, f));
    }
  }
  if (files.length === 0) {
    throw new Error(`No JSON files found in ${DATA_DIR}`);
  }

  const all = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${f} must contain a JSON array`);
    }
    console.log(`  • ${path.basename(f)}: ${parsed.length} entries`);
    for (let i = 0; i < parsed.length; i++) {
      if (!validateEntry(parsed[i], f, i)) continue;
      all.push(parsed[i]);
    }
  }
  return all;
}

function dedupeById(entries) {
  const byId = new Map();
  const duplicates = [];
  for (const e of entries) {
    if (byId.has(e.id)) {
      duplicates.push(e.id);
    }
    // Later wins — intentional, so a later JSON file can override an
    // earlier one during staging (e.g. foods_expanded.json overriding
    // foods_usda_bulk.json for a hand-corrected value).
    byId.set(e.id, e);
  }
  if (duplicates.length) {
    console.warn(`\n⚠ ${duplicates.length} duplicate id(s) — last wins:`);
    for (const d of duplicates.slice(0, 10)) console.warn(`    - ${d}`);
    if (duplicates.length > 10) console.warn(`    ... and ${duplicates.length - 10} more`);
  }
  return Array.from(byId.values());
}

async function run() {
  const explicit = process.argv[2];
  console.log(`seedFoods.js — target collection: ${COLLECTION}`);
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  if (explicit) console.log(`Explicit input: ${explicit}`);

  console.log('\n[1/4] Loading + validating input files...');
  const rawEntries = loadAllData(explicit);
  const entries = dedupeById(rawEntries);
  console.log(`  → ${entries.length} unique valid entries`);

  if (entries.length === 0) {
    console.error('\nNothing to upload. Exiting.');
    process.exit(1);
  }

  console.log('\n[2/4] Building search tokens...');
  const now = Date.now();
  let maxTokens = 0;
  const docs = entries.map((e) => {
    const tokens = buildSearchTokens(e.name, e.name_tr, e.cuisine, e.category);
    if (tokens.length > maxTokens) maxTokens = tokens.length;
    return {
      id: e.id,
      data: {
        id: e.id,
        name: e.name,
        name_tr: e.name_tr,
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        fiber: e.fiber ?? null,
        sugar: e.sugar ?? null,
        serving_size: e.serving_size || 100,
        serving_unit: e.serving_unit || 'g',
        category: e.category || null,
        cuisine: e.cuisine || null,
        source: e.source,
        source_ref: e.source_ref || null,
        search_tokens: tokens,
        verified: true,
        updated_at: now,
      },
    };
  });
  console.log(`  → max search_tokens per doc: ${maxTokens}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping Firestore write.');
    console.log('Sample doc:');
    console.log(JSON.stringify(docs[0], null, 2));
    return;
  }

  console.log('\n[3/4] Connecting to Firestore...');
  // Uses GOOGLE_APPLICATION_CREDENTIALS env var or gcloud application-
  // default credentials. No service-account JSON is ever committed.
  const a = loadAdmin();
  a.initializeApp({
    projectId: PROJECT_ID,
    credential: a.credential.applicationDefault(),
  });
  const db = a.firestore();

  console.log('\n[4/4] Uploading in batches of 400...');
  // Firestore limits a batch to 500 writes; 400 leaves headroom for
  // the server-added write metadata and avoids QUOTA_EXCEEDED in bursts.
  const BATCH_SIZE = 400;
  let uploaded = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { id, data } of slice) {
      batch.set(db.collection(COLLECTION).doc(id), data, { merge: false });
    }
    await batch.commit();
    uploaded += slice.length;
    console.log(`  • uploaded ${uploaded}/${docs.length}`);
  }

  console.log(`\n✓ Done. ${uploaded} docs written to ${COLLECTION}.`);
}

run().catch((err) => {
  console.error('\n✗ Seed failed:', err);
  process.exit(1);
});
