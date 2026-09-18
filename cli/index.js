#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import {
  cp,
  access,
  readdir,
  readFile,
  writeFile,
  rm,
  mkdir,
  mkdtemp,
  rename,
  stat,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Examples cache (lazy-downloaded from GitHub)
// ---------------------------------------------------------------------------

const GITHUB_OWNER = "L1lith";
const GITHUB_REPO = "Lilis-Game-Engine";
const GITHUB_BRANCH = "master";

const CACHE_ROOT = join(tmpdir(), "lilis-engine-examples");
const CACHE_EXAMPLES_DIR = join(CACHE_ROOT, "examples");
const CACHE_META_PATH = join(CACHE_ROOT, "cache-meta.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

// Read the current package version so cache can be invalidated on upgrades.
const PACKAGE_JSON_PATH = join(PACKAGE_ROOT, "package.json");
let PACKAGE_VERSION = "0.0.0";
try {
  const pkgRaw = await readFile(PACKAGE_JSON_PATH, "utf8");
  PACKAGE_VERSION = JSON.parse(pkgRaw).version ?? "0.0.0";
} catch {
  // non-fatal — cache will simply always be considered stale
}

const SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".astro",
  ".DS_Store",
  ".turbo",
]);

const CLONE_CONFIG_NAME = "clone-astro-config.config.mjs";
const ASTRO_CONFIG_NAME = "astro.config.mjs";
const ENGINE_PACKAGE = "lilis-engine";

function slugify(name) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function run(cmd, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else
        rejectPromise(
          new Error(`${cmd} ${args.join(" ")} exited with code ${code}`),
        );
    });
  });
}

async function readCacheMeta() {
  try {
    const raw = await readFile(CACHE_META_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCacheMeta(meta) {
  await writeFile(CACHE_META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

async function cacheIsFresh() {
  const meta = await readCacheMeta();
  if (!meta) return false;
  if (meta.version !== PACKAGE_VERSION) return false;
  if (typeof meta.lastFetched !== "number") return false;
  return Date.now() - meta.lastFetched < CACHE_TTL_MS;
}

async function cacheExists() {
  try {
    const s = await stat(CACHE_EXAMPLES_DIR);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function downloadExamplesToStaging(stagingDir) {
  const treeRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!treeRes.ok) {
    throw new Error(
      `GitHub API error: ${treeRes.status} ${treeRes.statusText}`,
    );
  }
  const { tree } = await treeRes.json();

  const files = tree.filter(
    (entry) => entry.type === "blob" && entry.path.startsWith("examples/"),
  );
  if (files.length === 0) {
    throw new Error("No files found under examples/ in the repository.");
  }

  // Skip excluded segments early so we don't download junk.
  const wanted = files.filter((entry) => {
    const rel = entry.path.slice("examples/".length);
    const segments = rel.split("/");
    return !segments.some((seg) => SKIP_SEGMENTS.has(seg));
  });

  for (const file of wanted) {
    const rel = file.path.slice("examples/".length);
    const destPath = join(stagingDir, rel);
    await mkdir(dirname(destPath), { recursive: true });

    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${file.path}`,
    );
    if (!rawRes.ok) {
      throw new Error(`Failed to fetch ${file.path}: ${rawRes.status}`);
    }
    await pipeline(rawRes.body, createWriteStream(destPath));
  }

  return wanted.length;
}

async function ensureExamples({ force = false } = {}) {
  if (!force) {
    const fresh = await cacheIsFresh();
    if (fresh) return CACHE_EXAMPLES_DIR;
  }

  const haveCache = await cacheExists();

  if (force) {
    console.log("Refreshing example templates (--refresh)...");
  } else if (!haveCache) {
    console.log("Downloading example templates...");
  } else {
    console.log("Checking for updated example templates...");
  }

  try {
    await refreshExamplesCache();
    return CACHE_EXAMPLES_DIR;
  } catch (err) {
    if (haveCache && !force) {
      console.warn(
        `Warning: could not refresh examples (${err.message}). Using cached copy.`,
      );
      return CACHE_EXAMPLES_DIR;
    }
    console.error(`Failed to download examples: ${err.message}`);
    console.error(
      `You can also clone the repository manually: git clone https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`,
    );
    process.exit(1);
  }
}

/**
 * Ensure the examples directory is available locally.
 * Refreshes from GitHub if the cache is missing, stale (>60min),
 * or was built from a different package version.
 * Falls back to a stale cache if the network is unreachable.
 */
async function ensureExamples() {
  const fresh = await cacheIsFresh();
  if (fresh) return CACHE_EXAMPLES_DIR;

  const haveCache = await cacheExists();

  if (!haveCache) {
    console.log("Downloading example templates...");
  } else {
    console.log("Checking for updated example templates...");
  }

  try {
    await refreshExamplesCache();
    return CACHE_EXAMPLES_DIR;
  } catch (err) {
    if (haveCache) {
      console.warn(
        `Warning: could not refresh examples (${err.message}). Using cached copy.`,
      );
      return CACHE_EXAMPLES_DIR;
    }
    console.error(`Failed to download examples: ${err.message}`);
    console.error(
      `You can also clone the repository manually: git clone https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`,
    );
    process.exit(1);
  }
}

async function listExamples(examplesDir) {
  try {
    const entries = await readdir(examplesDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !SKIP_SEGMENTS.has(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

yargs(hideBin(process.argv))
  .scriptName("lilis-engine")
  .usage("$0 <command> [options]")
  .command(
    "create [example] [projectName]",
    "Create a new project from an example template",
    (y) =>
      y
        .positional("example", {
          describe: "Name of the example template to use",
          type: "string",
        })
        .positional("projectName", {
          describe: "Name of the destination project folder",
          type: "string",
        })
        .option("refresh", {
          describe:
            "Force re-download of example templates, ignoring the cache",
          type: "boolean",
          default: false,
        }),
    async (argv) => {
      const { example, projectName, refresh } = argv;

      // 0. No args? Enumerate available examples and exit.
      if (!example) {
        const examplesDir = await ensureExamples({ force: refresh });
        const available = (await listExamples(examplesDir)) ?? [];
        console.log(`Usage: lilis-engine create <example> <projectName>\n`);
        console.log(`Available examples:`);
        for (const name of available) console.log(`  ${name}`);
        console.log(`\nExample:`);
        console.log(`  lilis-engine create ${available[0] ?? "basic"} my-app`);
        return;
      }

      if (!projectName) {
        console.error(`Error: Missing <projectName>.`);
        console.error(`Usage: lilis-engine create <example> <projectName>`);
        process.exit(1);
      }

      const examplesDir = await ensureExamples({ force: refresh });
      const source = join(examplesDir, example);
      const destination = resolve(process.cwd(), projectName);

      // ... rest unchanged

      // 1. Validate the example exists
      const available = await listExamples(examplesDir);
      if (available === null) {
        console.error(`Error: examples directory is missing or unreadable.`);
        process.exit(1);
      }

      if (!available.includes(example)) {
        console.error(`Error: Example "${example}" not found.`);
        console.error(`Available examples: ${available.join(", ")}`);
        process.exit(1);
      }

      // 2. Prevent accidental overwrite
      try {
        await access(destination);
        console.error(`Error: Destination "${projectName}" already exists.`);
        process.exit(1);
      } catch {
        // good — doesn't exist
      }

      // 3. Copy the template, skipping node_modules, .git, etc.
      try {
        await cp(source, destination, {
          recursive: true,
          filter: (src) => {
            const rel = relative(source, src);
            if (!rel) return true;
            const segments = rel.split(sep);
            if (segments.some((seg) => SKIP_SEGMENTS.has(seg))) return false;
            if (segments[segments.length - 1] === CLONE_CONFIG_NAME)
              return false;
            return true;
          },
        });
      } catch (err) {
        console.error(`Failed to copy template: ${err.message}`);
        process.exit(1);
      }

      // 4. Rewrite package.json: rename project, drop lilis-engine from all dep fields
      try {
        const pkgPath = join(destination, "package.json");
        const raw = await readFile(pkgPath, "utf8");
        const pkg = JSON.parse(raw);

        pkg.name = slugify(projectName);

        for (const field of [
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
        ]) {
          if (pkg[field] && pkg[field][ENGINE_PACKAGE]) {
            delete pkg[field][ENGINE_PACKAGE];
            if (Object.keys(pkg[field]).length === 0) delete pkg[field];
          }
        }

        await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      } catch (err) {
        console.error(`Failed to update package.json: ${err.message}`);
        process.exit(1);
      }

      // 5. Swap the clone astro config into place as astro.config.mjs (if present)
      try {
        const cloneConfigInSource = join(source, CLONE_CONFIG_NAME);
        const astroConfigInDest = join(destination, ASTRO_CONFIG_NAME);

        let cloneConfigContents;
        try {
          cloneConfigContents = await readFile(cloneConfigInSource, "utf8");
        } catch (err) {
          if (err.code === "ENOENT") {
            cloneConfigContents = null;
          } else {
            throw err;
          }
        }

        if (cloneConfigContents !== null) {
          await rm(astroConfigInDest, { force: true });
          await writeFile(astroConfigInDest, cloneConfigContents, "utf8");
        }
      } catch (err) {
        console.error(`Failed to install astro config: ${err.message}`);
        process.exit(1);
      }

      // 6. Install the template's remaining dependencies
      console.log(`\nInstalling dependencies...\n`);
      try {
        await run("npm", ["install"], destination);
      } catch (err) {
        console.error(`\nFailed to install dependencies: ${err.message}`);
        console.error(
          `You can retry manually with: cd ${projectName} && npm install`,
        );
        process.exit(1);
      }

      // 7. Pull lilis-engine fresh from the registry
      console.log(`\nInstalling ${ENGINE_PACKAGE}@latest...\n`);
      try {
        await run("npm", ["install", `${ENGINE_PACKAGE}@latest`], destination);
      } catch (err) {
        console.error(`\nFailed to install ${ENGINE_PACKAGE}: ${err.message}`);
        console.error(
          `You can retry manually with: cd ${projectName} && npm install ${ENGINE_PACKAGE}@latest`,
        );
        process.exit(1);
      }

      console.log(`\n✔ Created project "${projectName}" from "${example}"`);
      console.log(`\nNext steps:`);
      console.log(`  cd ${projectName}`);
      console.log(`  npm run dev`);
    },
  )
  .demandCommand(1, "You need to specify a command.")
  .help()
  .version()
  .parse();
