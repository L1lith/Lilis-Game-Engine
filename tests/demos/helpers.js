import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, execSync } from "node:child_process";
import { expect } from "chai";

const ROOT = resolve(import.meta.dirname, "../..");
const DEMOS_DIR = join(ROOT, "demos");

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverDemos() {
  const demos = [];
  for (const entry of readdirSync(DEMOS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const dir = join(DEMOS_DIR, name);
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }

    demos.push({
      name,
      dir,
      pkgPath,
      pkg,
      hasDev: typeof pkg.scripts?.dev === "string",
    });
  }
  return demos;
}

export function getDemo(name) {
  const demo = discoverDemos().find((d) => d.name === name);
  if (!demo) {
    throw new Error(
      `Demo "${name}" not found. Available: ` +
        discoverDemos()
          .map((d) => d.name)
          .join(", "),
    );
  }
  return demo;
}

// ---------------------------------------------------------------------------
// npm resolution
// ---------------------------------------------------------------------------

function resolveNpmCommand() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath],
    };
  }
  if (process.platform === "win32") {
    return { command: "npm.cmd", args: [] };
  }
  return { command: "npm", args: [] };
}

// ---------------------------------------------------------------------------
// Process registry
// ---------------------------------------------------------------------------

const liveChildren = new Set();

function killChildSync(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      /* already dead or no permission */
    }
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* noop */
    }
    try {
      child.kill("SIGKILL");
    } catch {
      /* noop */
    }
  }
}

function killAllChildrenSync() {
  for (const child of liveChildren) killChildSync(child);
  liveChildren.clear();
}

process.on("exit", killAllChildrenSync);
process.on("SIGINT", () => {
  killAllChildrenSync();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killAllChildrenSync();
  process.exit(143);
});
process.on("uncaughtException", (err) => {
  killAllChildrenSync();
  console.error("Uncaught exception:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

function stripAnsi(s) {
  return s.replace(ANSI_RE, "");
}

function parseUrlString(raw) {
  try {
    const u = new URL(raw);
    let host = u.hostname;
    if (host === "0.0.0.0" || host === "::" || host === "[::]") {
      host = "127.0.0.1";
    }
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    return { host, port };
  } catch {
    return null;
  }
}

function extractUrlFromText(text) {
  const clean = stripAnsi(text);
  const re = new RegExp(URL_RE.source, "g");
  let m;
  while ((m = re.exec(clean)) !== null) {
    const parsed = parseUrlString(m[0]);
    if (parsed) return parsed;
  }
  return null;
}

async function urlResponds(url, timeoutMs = 500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.status > 0;
  } catch {
    return false;
  }
}

async function resolveReachableUrl(reportedHost, port, deadlineMs = 15_000) {
  const candidates = [];
  const seen = new Set();
  const add = (u) => {
    if (!seen.has(u)) {
      seen.add(u);
      candidates.push(u);
    }
  };

  let host = reportedHost;
  if (host === "0.0.0.0" || host === "::" || host === "[::]")
    host = "127.0.0.1";
  if (host && host !== "localhost") add(`http://${host}:${port}`);
  add(`http://127.0.0.1:${port}`);
  add(`http://localhost:${port}`);

  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const results = await Promise.all(
      candidates.map((url) => urlResponds(url)),
    );
    const hit = results.findIndex(Boolean);
    if (hit !== -1) return candidates[hit];
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const PORT_SCAN_RANGES = [
  [4321, 4350], // Astro
  [5173, 5200], // Vite
  [3000, 3010], // Next, CRA, plain node
  [8000, 8010], // Python-style
];

async function scanPortRange(host, start, end, timeoutMs = 200) {
  const ports = [];
  for (let p = start; p <= end; p++) ports.push(p);
  const results = await Promise.all(
    ports.map(async (port) => {
      const ok = await urlResponds(`http://${host}:${port}/`, timeoutMs);
      return ok ? port : null;
    }),
  );
  return results.find(Boolean) ?? null;
}

async function portScanForServer(reportedHost) {
  const hosts = ["127.0.0.1", "localhost"];
  const attemptHost =
    reportedHost && !hosts.includes(reportedHost)
      ? [reportedHost, ...hosts]
      : hosts;

  for (const host of attemptHost) {
    for (const [start, end] of PORT_SCAN_RANGES) {
      const port = await scanPortRange(host, start, end);
      if (port !== null) return { host, port: String(port) };
    }
  }
  return null;
}

export async function startDevServer(demo, { timeout = 60_000 } = {}) {
  if (!demo.hasDev) {
    throw Object.assign(
      new Error(`Demo "${demo.name}" has no "dev" script in package.json`),
      { phase: "no-dev-script" },
    );
  }

  const { command, args: prefixArgs } = resolveNpmCommand();
  const fullArgs = [...prefixArgs, "run", "dev"];
  const attempted = [command, ...fullArgs].join(" ");

  const isWindows = process.platform === "win32";

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, fullArgs, {
        cwd: demo.dir,
        env: {
          ...process.env,
          ASTRO_TELEMETRY_DISABLED: "1",
          FORCE_COLOR: "0",
          BROWSER: "none",
          CI: "1",
        },
        detached: !isWindows,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      return reject(
        Object.assign(err, {
          phase: "dev-server-spawn",
          attempted,
          cwd: demo.dir,
          stdout: "",
          stderr: "",
        }),
      );
    }

    liveChildren.add(child);

    let stdout = "";
    let stderr = "";
    let settled = false;
    let portScanStarted = false;
    let resolutionInFlight = false;

    const errorCtx = (extra = {}) => ({
      attempted,
      cwd: demo.dir,
      stdout,
      stderr,
      ...extra,
    });

    const cleanup = () => {
      liveChildren.delete(child);
      killChildSync(child);
    };

    const settle = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimeout);
      fn(arg);
    };

    const succeed = (url) => {
      settle(resolve, {
        url,
        stdout: () => stdout,
        stderr: () => stderr,
        close: () => stopDevServer(child),
      });
    };

    const fail = (err) => {
      cleanup();
      settle(reject, err);
    };

    const tryResolve = async (host, port) => {
      if (settled || resolutionInFlight) return;
      resolutionInFlight = true;
      try {
        const url = await resolveReachableUrl(host, port);
        if (settled) return;
        if (url) succeed(url);
      } finally {
        resolutionInFlight = false;
      }
    };

    const scanStdout = () => {
      if (settled) return;
      const parsed = extractUrlFromText(stdout);
      if (parsed) tryResolve(parsed.host, parsed.port);
    };

    const scanStderr = () => {
      if (settled) return;
      const parsed = extractUrlFromText(stderr);
      if (parsed) tryResolve(parsed.host, parsed.port);
    };

    const PORT_SCAN_AFTER_MS = 5_000;
    const portScanTimer = setTimeout(async () => {
      if (settled || portScanStarted) return;
      portScanStarted = true;
      const found = await portScanForServer(null);
      if (found && !settled) tryResolve(found.host, found.port);
    }, PORT_SCAN_AFTER_MS);

    const hardTimeout = setTimeout(() => {
      clearTimeout(portScanTimer);
      fail(
        Object.assign(
          new Error(
            `Dev server for "${demo.name}" did not print a URL within ${timeout}ms`,
          ),
          errorCtx({ phase: "dev-server-timeout" }),
        ),
      );
    }, timeout);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      scanStdout();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      scanStderr();
    });

    child.on("exit", (code, signal) => {
      clearTimeout(portScanTimer);
      if (settled) return;
      const parsed = extractUrlFromText(stdout) || extractUrlFromText(stderr);
      if (parsed) {
        fail(
          Object.assign(
            new Error(
              `Dev server for "${demo.name}" exited (code ${code ?? "null"}` +
                `${signal ? `, signal ${signal}` : ""}) after printing ` +
                `http://${parsed.host}:${parsed.port} but before it became reachable`,
            ),
            errorCtx({ phase: "dev-server-exit", exitCode: code, signal }),
          ),
        );
      } else {
        fail(
          Object.assign(
            new Error(
              `Dev server for "${demo.name}" exited ` +
                `(code ${code ?? "null"}${signal ? `, signal ${signal}` : ""}) ` +
                `before printing a URL`,
            ),
            errorCtx({ phase: "dev-server-exit", exitCode: code, signal }),
          ),
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(portScanTimer);
      fail(Object.assign(err, errorCtx({ phase: "dev-server-spawn" })));
    });
  });
}

function stopDevServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      liveChildren.delete(child);
      return resolve();
    }

    if (process.platform === "win32") {
      try {
        spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        /* noop */
      }
      const forceTimer = setTimeout(() => {
        liveChildren.delete(child);
        resolve();
      }, 3000);
      child.once("exit", () => {
        clearTimeout(forceTimer);
        liveChildren.delete(child);
        resolve();
      });
      return;
    }

    const kill = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          /* noop */
        }
      }
    };
    kill("SIGTERM");
    const forceTimer = setTimeout(() => {
      kill("SIGKILL");
      liveChildren.delete(child);
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(forceTimer);
      liveChildren.delete(child);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Error reporting
// ---------------------------------------------------------------------------

export function printStartupError(demo, err) {
  const line = "=".repeat(70);
  const out = (msg) => console.error(msg);
  out("");
  out(line);
  out(`DEV SERVER FAILED: ${demo.name}  (phase: ${err.phase ?? "unknown"})`);
  out(line);
  if (err.message) out(`message:    ${err.message}`);
  if (err.code) out(`error code: ${err.code}`);
  if (err.attempted) out(`attempted:  ${err.attempted}`);
  out(`cwd:        ${err.cwd ?? demo.dir}`);
  out(`platform:   ${process.platform}`);
  out(`node:       ${process.version}`);

  if (err.code === "ENOENT") {
    out("");
    out("The npm binary could not be found. Check that:");
    out("  1. npm is installed and available on PATH");
    out("  2. You ran the tests via `npm test` (so npm_execpath is set)");
    out("  3. On Windows, npm.cmd is resolvable (ships with Node)");
  }

  if (err.stdout && err.stdout.length > 0) {
    out("");
    out("--- dev server stdout ---");
    process.stderr.write(err.stdout);
    if (!err.stdout.endsWith("\n")) process.stderr.write("\n");
  }
  if (err.stderr && err.stderr.length > 0) {
    out("");
    out("--- dev server stderr ---");
    process.stderr.write(err.stderr);
    if (!err.stderr.endsWith("\n")) process.stderr.write("\n");
  }
  out(line);
  out("");
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

export async function launchBrowser() {
  const { chromium } = await import("@playwright/test");
  return chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
}

// ---------------------------------------------------------------------------
// Benign error filtering
//
// Some demos load third-party scripts (analytics beacons, error trackers,
// chat widgets) that fail in CI for reasons entirely unrelated to the demo:
// CORS, integrity hash mismatches, blocked by tracking protection, etc.
// These would otherwise show up as page errors or console errors and cause
// the "does not throw" tests to fail spuriously.
//
// The list below suppresses errors from known-benign sources. Add to it as
// you find more false positives. To disable filtering for a specific demo
// suite, pass `{ includeAllErrors: true }` to `describeDemo`.
// ---------------------------------------------------------------------------

const BENIGN_ERROR_PATTERNS = [
  // Third-party beacons and analytics
  /cloudflareinsights\.com/i,
  /cloudflare\.com\/cdn-cgi/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /googlesyndication\.com/i,
  /facebook\.net/i,
  /hotjar\.com/i,
  /segment\.(io|com)/i,
  /newrelic\.com/i,
  /sentry-cdn\.com/i,
  /mixpanel\.com/i,
  /amplitude\.com/i,
  /plausible\.io/i,
  /posthog\.com/i,
  // Generic browser messages that only concern third-party resources
  /Cross-Origin Request Blocked/i,
  /blocked by CORS policy/i,
  /None of the .sha(256|384|512). hashes/i,
  /integrity attribute/i,
  /Enhanced Tracking Protection/i,
];

function errorText(err) {
  if (!err) return "";
  const parts = [
    err.message,
    err.stack,
    typeof err === "string" ? err : "",
    err.name,
  ];
  return parts.filter(Boolean).join("\n");
}

function isBenignError(err) {
  const text = errorText(err);
  if (!text) return false;
  return BENIGN_ERROR_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Entity inspection helpers
// ---------------------------------------------------------------------------

export async function readEntities(page) {
  return page.evaluate(() => {
    const doFlatten = function flatten(list, depth) {
      if (depth > 10) return [];
      const out = [];
      for (const item of list) {
        if (!item) continue;
        const looksLikeEntity =
          typeof item === "object" &&
          (typeof item.x === "number" || typeof item.y === "number");
        if (looksLikeEntity) {
          out.push(item);
          if (item.children) {
            let kids;
            try {
              kids =
                typeof item.children.get === "function"
                  ? item.children.get()
                  : item.children;
            } catch {
              kids = null;
            }
            if (Array.isArray(kids)) out.push(...flatten(kids, depth + 1));
          }
        } else if (Array.isArray(item)) {
          out.push(...flatten(item, depth + 1));
        } else if (typeof item.get === "function") {
          try {
            const inner = item.get();
            if (Array.isArray(inner)) out.push(...flatten(inner, depth + 1));
          } catch {}
        }
      }
      return out;
    };

    const raw = window.entities;
    if (!raw) return [];
    let list;
    try {
      list = typeof raw.get === "function" ? raw.get() : raw;
    } catch {
      return [];
    }
    if (!Array.isArray(list)) return [];

    return doFlatten(list, 0).map((e) => ({
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      rotation: e.rotation,
      fill: e.fill,
      imageURL: e.imageURL,
      color: e.color,
      hasMatter: !!e.matter,
      isStatic: !!(e.matter && e.matter.static),
      hasMatterBody: !!e.matterBody,
      hasSolid: !!e.solid,
      noMatterRender: !!e.noMatterRender,
    }));
  });
}

export async function readPlayer(page) {
  return page.evaluate(() => {
    const raw = window.entities;
    if (!raw) return null;
    let list;
    try {
      list = typeof raw.get === "function" ? raw.get() : raw;
    } catch {
      return null;
    }
    if (!Array.isArray(list)) return null;

    const pick =
      window.player ||
      list.find((e) => e && e.matter && !e.matter.static && e.matterBody);
    if (!pick) return null;
    return {
      x: pick.x,
      y: pick.y,
      width: pick.width,
      height: pick.height,
      rotation: pick.rotation,
    };
  });
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

export async function holdKey(page, key, ms = 400) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

export async function waitFrames(page, frames = 5) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let remaining = n;
        const tick = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

// ---------------------------------------------------------------------------
// Suite generator
// ---------------------------------------------------------------------------

export function describeDemo(demoName, options = {}) {
  let demo;
  try {
    demo = getDemo(demoName);
  } catch (err) {
    describe(`${demoName} demo`, function () {
      it(`demo "${demoName}" not found`, function () {
        throw err;
      });
    });
    return;
  }

  describe(`${demo.name} demo`, function () {
    this.timeout(180_000);

    let server;
    let browser;
    let page;
    const pageErrors = [];
    const consoleErrors = [];
    const includeAllErrors = options.includeAllErrors === true;

    before(async function () {
      try {
        server = await startDevServer(demo);
      } catch (err) {
        printStartupError(demo, err);
        throw err;
      }

      browser = await launchBrowser();
      page = await browser.newPage();

      page.on("pageerror", (err) => {
        if (includeAllErrors || !isBenignError(err)) {
          pageErrors.push(err);
        }
      });
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (includeAllErrors) {
          consoleErrors.push(text);
          return;
        }
        if (!isBenignError({ message: text })) {
          consoleErrors.push(text);
        }
      });

      const originalGoto = page.goto.bind(page);
      page.goto = async (url, gotoOptions) => {
        try {
          const res = await originalGoto(url, gotoOptions);
          if (res && res.status() >= 400) {
            throw new Error(
              `Navigation to ${url} returned HTTP ${res.status()}\n\n` +
                `Dev server output (tail):\n` +
                `--- stdout ---\n${server.stdout().slice(-1500)}\n` +
                `--- stderr ---\n${server.stderr().slice(-1500)}`,
            );
          }
          return res;
        } catch (err) {
          if (!err.message || !err.message.includes("Dev server output")) {
            err.message =
              `Failed to navigate to ${url}: ${err.message}\n\n` +
              `Dev server output (tail):\n` +
              `--- stdout ---\n${server.stdout().slice(-1500)}\n` +
              `--- stderr ---\n${server.stderr().slice(-1500)}`;
          }
          throw err;
        }
      };
    });

    after(async () => {
      if (browser) await browser.close();
      if (server) await server.close();
    });

    it("serves the root page", async () => {
      const response = await page.goto(server.url + "/");
      expect(response).to.not.be.null;
      expect(response.status()).to.equal(200);
    });

    it("has a non-empty body", async () => {
      await page.goto(server.url + "/");
      const bodyHTML = await page.locator("body").innerHTML();
      expect(bodyHTML.trim().length).to.be.greaterThan(0);
    });

    if (options.hasCanvas !== false) {
      it("renders a canvas element", async () => {
        await page.goto(server.url + "/");
        await page.waitForSelector("canvas", { timeout: 15_000 });
        const info = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          if (!canvas) return null;
          return { width: canvas.width, height: canvas.height };
        });
        expect(info).to.not.be.null;
        expect(info.width).to.be.greaterThan(0);
        expect(info.height).to.be.greaterThan(0);
      });
    }

    if (options.hasDOM === true) {
      it("renders non-canvas DOM content", async () => {
        await page.goto(server.url + "/");
        await page.waitForTimeout(1000);
        const nonCanvasChildren = await page.evaluate(
          () =>
            [...document.body.children].filter(
              (el) => el.tagName.toLowerCase() !== "canvas",
            ).length,
        );
        expect(nonCanvasChildren).to.be.greaterThan(0);
      });
    }

    it("has no uncaught page errors", async () => {
      await page.goto(server.url + "/");
      await page.waitForTimeout(1500);
      expect(
        pageErrors,
        `Page errors:\n${pageErrors.map((e) => e.message ?? String(e)).join("\n")}`,
      ).to.be.empty;
    });

    if (options.exposesEntities) {
      it("exposes window.entities", async () => {
        await page.goto(server.url + "/");
        await page.waitForTimeout(1000);
        const has = await page.evaluate(
          () =>
            Array.isArray(window.entities?.get?.()) ||
            Array.isArray(window.entities),
        );
        expect(has, "demos must expose window.entities for testability").to.be
          .true;
      });
    }

    if (typeof options.tests === "function") {
      options.tests({
        getPage: () => page,
        getServer: () => server,
        getDemo: () => demo,
        getPageErrors: () => pageErrors,
        getConsoleErrors: () => consoleErrors,
      });
    }
  });
}

export { expect };
