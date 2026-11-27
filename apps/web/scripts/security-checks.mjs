import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const appRoot = path.join(repositoryRoot, "apps", "web");
const migrationsRoot = path.join(repositoryRoot, "supabase", "migrations");
const migrationNames = (await readdir(migrationsRoot)).filter((name) => name.endsWith(".sql")).sort();
const migrations = await Promise.all(migrationNames.map((name) => readFile(path.join(migrationsRoot, name), "utf8")));
const migrationText = migrations.join("\n");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function sourceFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "tests" || entry.name === "scripts") continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await sourceFiles(absolutePath));
    else if (/\.(?:[cm]?js|jsx|ts|tsx)$/.test(entry.name)) found.push(absolutePath);
  }
  return found;
}

const serverClientPath = path.join(appRoot, "lib", "supabase", "server.ts");
const serverClient = await readFile(serverClientPath, "utf8");
check(/^import\s+["']server-only["'];/m.test(serverClient), "Supabase server client must be marked server-only.");

const secretNamePattern = /\b(?:SUPABASE_(?:PRIMARY_|SECONDARY_)?SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)\b/g;
const serverClientRelative = path.relative(appRoot, serverClientPath);
for (const filename of await sourceFiles(appRoot)) {
  const source = await readFile(filename, "utf8");
  const matches = [...source.matchAll(secretNamePattern)];
  if (matches.length && path.relative(appRoot, filename) !== serverClientRelative) {
    check(false, `Server-only Supabase secret name referenced outside lib/supabase/server.ts: ${path.relative(appRoot, filename)}`);
  }
}

const functionBlocks = [...migrationText.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\b[\s\S]*?\$\$;/gi)].map(([block]) => block);
const definerBlocks = functionBlocks.filter((block) => /\bsecurity\s+definer\b/i.test(block));
check(definerBlocks.length > 0, "Expected at least one SECURITY DEFINER function in migrations.");
for (const [index, block] of definerBlocks.entries()) {
  check(/\bset\s+search_path\s*=\s*''/i.test(block), `SECURITY DEFINER function #${index + 1} must pin search_path to an empty path.`);
}

const rlsTables = [
  "profiles", "content_items", "artworks", "artwork_likes", "artwork_comments", "artwork_views",
  "notifications", "artwork_images", "art_chat_messages", "moderation_reports", "content_item_images",
  "content_item_likes", "content_item_comments", "content_item_views",
];
for (const table of rlsTables) {
  const enablePattern = new RegExp(`\\balter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security\\b`, "i");
  check(enablePattern.test(migrationText), `RLS is not enabled for public.${table}.`);
}

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Security checks passed: ${definerBlocks.length} SECURITY DEFINER functions and ${rlsTables.length} RLS tables reviewed.`);
}
