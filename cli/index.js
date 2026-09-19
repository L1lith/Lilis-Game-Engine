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
import { styleText } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Color helpers (no deps — uses node:util styleText, auto-disabled on non-TTY)
// ---------------------------------------------------------------------------

const c = {
  error: (s) => styleText("red", s),
  errorBold: (s) => styleText(["red", "bold"], s),
  warn: (s) => styleText("yellow", s),
  success: (s) => styleText("green", s),
  info: (s) => styleText("cyan", s),
  url: (s) => styleText(["blue", "underline"], s),
  bold: (s) => styleText("bold", s),
  dim: (s) => styleText("dim", s),
  heading: (s) => styleText(["bold", "cyan"], s),
  name: (s) => styleText("cyan", s),
};

const SEP = "─".repeat(60);

// ---------------------------------------------------------------------------
// Remote examples cache (lazy-downloaded from GitHub)
// ---------------------------------------------------------------------------

const GITHUB_OWNER = "L1lith";
const GITHUB_REPO = "Lilis-Game-Engine";
const GITHUB_BRANCH = "master";

const CACHE_ROOT = join(tmpdir(), "lilis-engine-examples");
const CACHE_EXAMPLES_DIR = join(CACHE_ROOT, "examples");
const CACHE_LIST_PATH = join(CACHE_ROOT, "example-list.json");
const CACHE_CODE_META_PATH = join(CACHE_ROOT, "code-meta.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

const PACKAGE_JSON_PATH = join(PACKAGE_ROOT, "package.json");
let PACKAGE_VERSION = "0.0.0";
try {
  const pkgRaw = await readFile(PACKAGE_JSON_PATH, "utf8");
  PACKAGE_VERSION = JSON.parse(pkgRaw).version ?? "0.0.0";
} catch {
  // non-fatal
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

const GITHUB_TREE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_TREE_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${GITHUB_BRANCH}`;
const DEMOS_BASE = `https://l1lith.github.io/Lilis-Game-Engine/examples`;

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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

function isFresh(meta) {
  if (!meta) return false;
  if (meta.version !== PACKAGE_VERSION) return false;
  if (typeof meta.lastFetched !== "number") return false;
  return Date.now() - meta.lastFetched < CACHE_TTL_MS;
}

async function fetchRepoTree() {
  const res = await fetch(GITHUB_TREE_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const { tree } = await res.json();
  return tree;
}

async function downloadRawFile(remotePath, destPath) {
  const res = await fetch(`${GITHUB_RAW_BASE}/${remotePath}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${remotePath}: ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(destPath));
}

/**
 * Fetch a single raw file as text. Returns null on 404 so callers can
 * treat "missing file" as a non-error case (e.g. no README).
 */
async function tryFetchRawText(remotePath) {
  const res = await fetch(`${GITHUB_RAW_BASE}/${remotePath}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch ${remotePath}: ${res.status}`);
  }
  return await res.text();
}

// ---------------------------------------------------------------------------
// Example list (cheap — just names, no code)
// ---------------------------------------------------------------------------

async function ensureExampleList({ force = false } = {}) {
  const cached = await readJson(CACHE_LIST_PATH);

  if (!force && isFresh(cached) && Array.isArray(cached.examples)) {
    return cached.examples;
  }

  const haveCache = Array.isArray(cached?.examples);

  if (force) {
    console.log(c.info("Refreshing example list (--refresh)..."));
  } else if (!haveCache) {
    console.log(c.info("Fetching example list..."));
  } else {
    console.log(c.info("Checking for updated example list..."));
  }

  try {
    const tree = await fetchRepoTree();

    const names = new Set();
    for (const entry of tree) {
      if (entry.type !== "blob" && entry.type !== "tree") continue;
      if (!entry.path.startsWith("examples/")) continue;
      const rest = entry.path.slice("examples/".length);
      if (!rest) continue;
      const first = rest.split("/")[0];
      if (first && !SKIP_SEGMENTS.has(first)) names.add(first);
    }

    const examples = [...names].sort();
    if (examples.length === 0) {
      throw new Error("No examples found in repository.");
    }

    await mkdir(CACHE_ROOT, { recursive: true });
    await writeJson(CACHE_LIST_PATH, {
      lastFetched: Date.now(),
      version: PACKAGE_VERSION,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      examples,
    });

    return examples;
  } catch (err) {
    if (haveCache && !force) {
      console.warn(
        c.warn(
          `Warning: could not refresh example list (${err.message}). Using cached list.`,
        ),
      );
      return cached.examples;
    }
    console.error(c.errorBold(`Failed to fetch example list: ${err.message}`));
    console.error(
      `You can also browse the repository directly: ${c.url(`${GITHUB_TREE_BASE}/examples`)}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Example code (heavy — only downloaded for the requested example)
// ---------------------------------------------------------------------------

async function readCodeMeta() {
  return (await readJson(CACHE_CODE_META_PATH)) ?? {};
}

async function writeCodeMetaEntry(example, meta) {
  const all = await readCodeMeta();
  all[example] = meta;
  await mkdir(CACHE_ROOT, { recursive: true });
  await writeJson(CACHE_CODE_META_PATH, all);
}

async function exampleCodeExists(example) {
  try {
    const s = await stat(join(CACHE_EXAMPLES_DIR, example));
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function ensureExampleCode(example, { force = false } = {}) {
  const destDir = join(CACHE_EXAMPLES_DIR, example);

  if (!force) {
    const meta = (await readCodeMeta())[example];
    const exists = await exampleCodeExists(example);
    if (exists && isFresh(meta)) {
      return destDir;
    }
  }

  const haveCache = await exampleCodeExists(example);

  if (force) {
    console.log(c.info(`Refreshing example "${example}" (--refresh)...`));
  } else if (!haveCache) {
    console.log(c.info(`Downloading example "${example}"...`));
  } else {
    console.log(c.info(`Checking for updates to example "${example}"...`));
  }

  const prefix = `examples/${example}/`;

  try {
    const tree = await fetchRepoTree();

    const files = tree.filter(
      (entry) => entry.type === "blob" && entry.path.startsWith(prefix),
    );
    if (files.length === 0) {
      throw new Error(`Example "${example}" has no files in the repository.`);
    }

    const wanted = files.filter((entry) => {
      const rel = entry.path.slice(prefix.length);
      return !rel.split("/").some((seg) => SKIP_SEGMENTS.has(seg));
    });

    await mkdir(CACHE_EXAMPLES_DIR, { recursive: true });
    const staging = await mkdtemp(
      join(CACHE_EXAMPLES_DIR, `staging-${example}-`),
    );

    try {
      for (const file of wanted) {
        const rel = file.path.slice(prefix.length);
        const destPath = join(staging, rel);
        await mkdir(dirname(destPath), { recursive: true });
        await downloadRawFile(file.path, destPath);
      }

      await rm(destDir, { recursive: true, force: true });
      await rename(staging, destDir);

      await writeCodeMetaEntry(example, {
        lastFetched: Date.now(),
        version: PACKAGE_VERSION,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
      });

      return destDir;
    } catch (err) {
      await rm(staging, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  } catch (err) {
    if (haveCache && !force) {
      console.warn(
        c.warn(
          `Warning: could not refresh example "${example}" (${err.message}). Using cached copy.`,
        ),
      );
      return destDir;
    }
    console.error(
      c.errorBold(`Failed to download example "${example}": ${err.message}`),
    );
    console.error(
      `You can also clone the repository manually: ${c.url(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`)}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Minimal markdown formatting for terminal output
// ---------------------------------------------------------------------------

function formatInlineMarkdown(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, (_, t) => c.bold(t))
    .replace(
      /(^|[^*])\*([^*]+)\*/g,
      (_, pre, t) => `${pre}${styleText("italic", t)}`,
    )
    .replace(/`([^`]+)`/g, (_, t) => c.info(t))
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, text, url) => `${text} (${c.url(url)})`,
    );
}

function formatMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let inCode = false;

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCode = !inCode;
      out.push(c.dim(line));
      continue;
    }
    if (inCode) {
      out.push(c.dim(line));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push(c.heading(heading[2]));
      continue;
    }

    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      out.push(`${bullet[1]}${c.info("•")} ${formatInlineMarkdown(bullet[2])}`);
      continue;
    }

    const numbered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numbered) {
      out.push(
        `${numbered[1]}${c.info(numbered[2] + ".")} ${formatInlineMarkdown(numbered[3])}`,
      );
      continue;
    }

    out.push(formatInlineMarkdown(line));
  }

  return out.join("\n");
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
            "Force re-download of example list and code, ignoring the cache",
          type: "boolean",
          default: false,
        }),
    async (argv) => {
      const { example, projectName, refresh } = argv;

      // 0. No args? Enumerate available examples and exit.
      if (!example) {
        const available = await ensureExampleList({ force: refresh });
        console.log("");
        console.log(
          `  ${c.bold("Usage:")} lilis-engine create <example> <projectName>`,
        );
        console.log("");
        console.log(`  ${c.bold("Available examples:")}`);
        for (const name of available) console.log(`    ${c.name(name)}`);
        console.log("");
        console.log(`  ${c.bold("Example:")}`);
        console.log(
          `    ${c.success(`lilis-engine create ${available[0] ?? "basic"} my-app`)}`,
        );
        console.log("");
        console.log(`  ${c.bold("Learn more about an example:")}`);
        console.log(`    ${c.info("lilis-engine info <example>")}`);
        console.log("");
        console.log(
          `  See full source: ${c.url(`${GITHUB_TREE_BASE}/examples`)}`,
        );
        console.log(
          `  Play in browser: ${c.url("https://l1lith.github.io/Lilis-Game-Engine/demos/")}`,
        );
        console.log("");
        return;
      }

      if (!projectName) {
        console.error(c.errorBold("Error: Missing <projectName>."));
        console.error(`Usage: lilis-engine create <example> <projectName>`);
        process.exit(1);
      }

      // 1. Validate the example name against the (cheap) list
      const available = await ensureExampleList({ force: refresh });
      if (!available.includes(example)) {
        console.error(c.errorBold(`Error: Example "${example}" not found.`));
        console.error(
          `Available examples: ${available.map(c.name).join(", ")}`,
        );
        process.exit(1);
      }

      // 2. Now fetch just this example's code
      const source = await ensureExampleCode(example, { force: refresh });
      const destination = resolve(process.cwd(), projectName);

      // 3. Prevent accidental overwrite
      try {
        await access(destination);
        console.error(
          c.errorBold(`Error: Destination "${projectName}" already exists.`),
        );
        process.exit(1);
      } catch {
        // good — doesn't exist
      }

      // 4. Copy the template, skipping node_modules, .git, etc.
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
        console.error(c.errorBold(`Failed to copy template: ${err.message}`));
        process.exit(1);
      }

      // 5. Rewrite package.json: rename project, drop lilis-engine from all dep fields
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
        console.error(
          c.errorBold(`Failed to update package.json: ${err.message}`),
        );
        process.exit(1);
      }

      // 6. Swap the clone astro config into place as astro.config.mjs (if present)
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
        console.error(
          c.errorBold(`Failed to install astro config: ${err.message}`),
        );
        process.exit(1);
      }

      // 7. Install the template's remaining dependencies
      console.log("");
      console.log(c.info("Installing dependencies..."));
      console.log("");
      try {
        await run("npm", ["install"], destination);
      } catch (err) {
        console.error(
          c.errorBold(`\nFailed to install dependencies: ${err.message}`),
        );
        console.error(
          `You can retry manually with: ${c.info(`cd ${projectName} && npm install`)}`,
        );
        process.exit(1);
      }

      // 8. Pull lilis-engine fresh from the registry
      console.log("");
      console.log(c.info(`Installing ${ENGINE_PACKAGE}@latest...`));
      console.log("");
      try {
        await run("npm", ["install", `${ENGINE_PACKAGE}@latest`], destination);
      } catch (err) {
        console.error(
          c.errorBold(`\nFailed to install ${ENGINE_PACKAGE}: ${err.message}`),
        );
        console.error(
          `You can retry manually with: ${c.info(`cd ${projectName} && npm install ${ENGINE_PACKAGE}@latest`)}`,
        );
        process.exit(1);
      }

      console.log("");
      console.log(
        `${c.success("✔")} Created project ${c.bold(projectName)} from ${c.name(example)}`,
      );
      console.log("");
      console.log(c.bold("Next steps:"));
      console.log(`  ${c.info(`cd ${projectName}`)}`);
      console.log(`  ${c.info("npm run dev")}`);
      console.log("");
    },
  )
  .command(
    "info <example>",
    "Show details about an example template (description, source, README)",
    (y) =>
      y
        .positional("example", {
          describe: "Name of the example template",
          type: "string",
        })
        .option("refresh", {
          describe: "Force refresh of the cached example list",
          type: "boolean",
          default: false,
        }),
    async (argv) => {
      const { example, refresh } = argv;

      const available = await ensureExampleList({ force: refresh });
      if (!available.includes(example)) {
        console.error(c.errorBold(`Error: Example "${example}" not found.`));
        console.error("");
        console.error(c.bold("Available examples:"));
        for (const name of available) console.error(`  ${c.name(name)}`);
        process.exit(1);
      }

      const sourceUrl = `${GITHUB_TREE_BASE}/examples/${example}`;
      const playUrl = `${DEMOS_BASE}/${example}`;

      // Fetch just the two files we need — no need to pull the whole example.
      let description = null;
      let readme = null;
      try {
        const [pkgRaw, readmeRaw] = await Promise.all([
          tryFetchRawText(`examples/${example}/package.json`),
          tryFetchRawText(`examples/${example}/README.md`),
        ]);
        if (pkgRaw) {
          try {
            description = JSON.parse(pkgRaw).description ?? null;
          } catch {
            // ignore malformed package.json
          }
        }
        readme = readmeRaw;
      } catch (err) {
        console.error(
          c.errorBold(`Failed to fetch example info: ${err.message}`),
        );
        process.exit(1);
      }

      console.log("");
      console.log(`  ${c.heading(example)}`);
      console.log(`  ${c.dim(SEP)}`);

      if (description) {
        console.log("");
        console.log(`  ${description}`);
      }

      console.log("");
      console.log(`  ${c.bold("Source")}`);
      console.log(`    ${c.url(sourceUrl)}`);
      console.log("");
      console.log(`  ${c.bold("Play with demos in browser")}`);
      console.log(`    ${c.url(playUrl)}`);

      if (readme) {
        console.log("");
        console.log(`  ${c.bold("README")}`);
        console.log(`  ${c.dim(SEP)}`);
        console.log("");
        const formatted = formatMarkdown(readme.trimEnd());
        for (const line of formatted.split("\n")) {
          console.log(line ? `  ${line}` : "");
        }
      } else {
        console.log("");
        console.log(`  ${c.dim("(No README found for this example.)")}`);
      }

      console.log("");
      console.log(`  ${c.dim(SEP)}`);
      console.log(`  ${c.bold("Create a project from this example:")}`);
      console.log("");
      console.log(
        `    ${c.success(`lilis-engine create ${example} my-project`)}`,
      );
      console.log("");
    },
  )
  .demandCommand(1, "You need to specify a command.")
  .help()
  .version()
  .parse();
