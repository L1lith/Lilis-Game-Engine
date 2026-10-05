import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dirname, "../../cli/index.js");
const REPO_ROOT = resolve(import.meta.dirname, "../..");

// ---------------------------------------------------------------------------
// runCli — spawn the CLI as a subprocess and collect output
// ---------------------------------------------------------------------------

export function runCli(args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: options.cwd ?? REPO_ROOT,
      env: {
        ...process.env,
        // Suppress ANSI codes so assertions on stdout/stderr are stable.
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        // Tests always skip npm install unless explicitly overridden.
        LILIS_SKIP_INSTALL: "1",
        ...options.env,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });

    child.on("exit", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
    child.on("error", (err) => {
      resolvePromise({ code: -1, stdout, stderr: stderr + "\n" + err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// startMockGitHub — local HTTP server mimicking the two endpoints the CLI hits
//
//   /tree            → returns a GitHub-API-shaped JSON tree
//   /raw/<path>      → returns file contents for the given path
//
// The returned object exposes the two env var values the CLI needs:
//   treeUrl  → for LILIS_GITHUB_TREE_URL
//   rawBase  → for LILIS_GITHUB_RAW_BASE
//
// It also tracks hit counts per endpoint so tests can verify caching.
// ---------------------------------------------------------------------------

export async function startMockGitHub(filesByPath = {}) {
  const files = filesByPath;
  const hits = { tree: 0, raw: 0, rawPaths: [] };

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const path = decodeURIComponent(url.pathname);

    if (path === "/tree") {
      hits.tree += 1;

      // Build a tree: blob entries for every file, tree entries for every
      // intermediate directory. This is what the real GitHub API returns.
      const tree = [];
      const dirs = new Set();
      for (const filePath of Object.keys(files)) {
        tree.push({
          path: filePath,
          type: "blob",
          sha: "x",
          size: files[filePath].length,
        });
        const parts = filePath.split("/");
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join("/"));
        }
      }
      for (const d of dirs) {
        tree.push({ path: d, type: "tree", sha: "x" });
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ tree, truncated: false }));
      return;
    }

    if (path.startsWith("/raw/")) {
      const filePath = path.slice("/raw/".length);
      hits.raw += 1;
      hits.rawPaths.push(filePath);
      if (Object.prototype.hasOwnProperty.call(files, filePath)) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(files[filePath]);
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not Found");
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    treeUrl: `${baseUrl}/tree`,
    rawBase: `${baseUrl}/raw`,
    hits,
    close: () => new Promise((r) => server.close(r)),
  };
}

// ---------------------------------------------------------------------------
// makeTempDir — per-test isolated directories for cache and project output
// ---------------------------------------------------------------------------

export async function makeTempDir(prefix = "lilis-cli-test-") {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true }),
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

export function makeSampleRepo() {
  return {
    "demos/hello-world/package.json": JSON.stringify({
      name: "hello-world",
      version: "1.0.0",
      description: "A minimal hello-world demo.",
      dependencies: { "lilis-engine": "latest" },
    }),
    "demos/hello-world/index.html":
      "<!doctype html><html><body>Hello</body></html>",
    "demos/hello-world/README.md":
      "# Hello World\n\nA minimal demo.\n\n## Usage\n\n- Install\n- Run",
    "demos/other-demo/package.json": JSON.stringify({
      name: "other-demo",
      version: "1.0.0",
      description: "Another demo for testing.",
    }),
    "demos/other-demo/index.html": "<html><body>Other</body></html>",
  };
}
