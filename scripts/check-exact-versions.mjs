import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "test-results"
]);
const dependencyBlocks = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

const badSpec = (spec) =>
  spec === "*" ||
  spec === "latest" ||
  spec.startsWith("^") ||
  spec.startsWith("~");

async function findPackageJsons(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...(await findPackageJsons(fullPath)));
      }
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      files.push(fullPath);
    }
  }

  return files;
}

const failures = [];
for (const file of await findPackageJsons(root)) {
  const json = JSON.parse(await readFile(file, "utf8"));
  for (const block of dependencyBlocks) {
    for (const [name, spec] of Object.entries(json[block] ?? {})) {
      if (badSpec(spec)) {
        failures.push(`${path.relative(root, file)} ${block}.${name}=${spec}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Floating dependency ranges are not allowed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("All package dependency versions are exact.");
