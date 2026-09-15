#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, sep } from "node:path";
import { cp, access, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");
const EXAMPLES_DIR = join(PACKAGE_ROOT, "examples");

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

yargs(hideBin(process.argv))
  .scriptName("lilis-engine")
  .usage("$0 <command> [options]")
  .command(
    "create <example> <projectName>",
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
        }),
    async (argv) => {
      const { example, projectName } = argv;
      const source = join(EXAMPLES_DIR, example);
      const destination = resolve(process.cwd(), projectName);

      // 1. Validate the example exists
      let available;
      try {
        available = await readdir(EXAMPLES_DIR);
      } catch {
        console.error(`Error: examples directory is missing from the package.`);
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
            // No clone config in this example — keep the normal astro.config.mjs
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
