import { expect } from "chai";
import { join } from "node:path";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import {
  runCli,
  startMockGitHub,
  makeTempDir,
  makeSampleRepo,
} from "./helpers.js";

describe("lilis-engine create", function () {
  this.timeout(60_000);

  let mock, cacheDir, workDir;

  before(async () => {
    mock = await startMockGitHub(makeSampleRepo());
  });

  after(async () => {
    await mock.close();
  });

  beforeEach(async () => {
    cacheDir = await makeTempDir();
    workDir = await makeTempDir();
  });

  afterEach(async () => {
    await cacheDir.cleanup();
    await workDir.cleanup();
  });

  function testEnv(extra = {}) {
    return {
      LILIS_GITHUB_TREE_URL: mock.treeUrl,
      LILIS_GITHUB_RAW_BASE: mock.rawBase,
      LILIS_CACHE_DIR: cacheDir.path,
      LILIS_SKIP_INSTALL: "1",
      ...extra,
    };
  }

  // -------------------------------------------------------------------------
  // Argument validation
  // -------------------------------------------------------------------------

  it("lists available demos when called with no arguments", async () => {
    const result = await runCli(["create"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("hello-world");
    expect(result.stdout).to.include("other-demo");
    expect(result.stdout).to.include("Usage:");
  });

  it("errors when <projectName> is missing", async () => {
    const result = await runCli(["create", "hello-world"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(result.code).to.not.equal(0);
    expect(result.stderr).to.include("Missing <projectName>");
  });

  it("errors when the demo does not exist", async () => {
    const result = await runCli(["create", "does-not-exist", "my-app"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(result.code).to.not.equal(0);
    expect(result.stderr).to.include("not found");
    expect(result.stderr).to.include("hello-world");
    expect(result.stderr).to.include("other-demo");
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("copies the demo files into the destination", async () => {
    const result = await runCli(["create", "hello-world", "my-app"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(result.code).to.equal(0);

    const dest = join(workDir.path, "my-app");
    const files = await readdir(dest);
    expect(files).to.include("package.json");
    expect(files).to.include("index.html");
  });

  it("rewrites the project name in package.json", async () => {
    await runCli(["create", "hello-world", "my-app"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    const pkg = JSON.parse(
      await readFile(join(workDir.path, "my-app", "package.json"), "utf8"),
    );
    expect(pkg.name).to.equal("my-app");
  });

  it("removes the lilis-engine dependency from package.json", async () => {
    await runCli(["create", "hello-world", "my-app"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    const pkg = JSON.parse(
      await readFile(join(workDir.path, "my-app", "package.json"), "utf8"),
    );
    expect(pkg.dependencies?.["lilis-engine"]).to.be.undefined;
  });

  it("slugifies the project name in package.json", async () => {
    await runCli(["create", "hello-world", "My Cool App!"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    const pkg = JSON.parse(
      await readFile(
        join(workDir.path, "My Cool App!", "package.json"),
        "utf8",
      ),
    );
    expect(pkg.name).to.equal("my-cool-app");
  });

  it("refuses to overwrite an existing destination", async () => {
    const first = await runCli(["create", "hello-world", "existing"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(first.code).to.equal(0);

    const second = await runCli(["create", "hello-world", "existing"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    expect(second.code).to.not.equal(0);
    expect(second.stderr).to.include("already exists");
  });

  it("does not overwrite the original file when destination exists", async () => {
    const dest = join(workDir.path, "existing");
    await runCli(["create", "hello-world", "existing"], {
      env: testEnv(),
      cwd: workDir.path,
    });
    const pkgBefore = await readFile(join(dest, "package.json"), "utf8");

    await runCli(["create", "hello-world", "existing"], {
      env: testEnv(),
      cwd: workDir.path,
    });

    const pkgAfter = await readFile(join(dest, "package.json"), "utf8");
    expect(pkgAfter).to.equal(pkgBefore);
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  it("caches the demo list across runs", async () => {
    const env = testEnv();
    const treeBefore = mock.hits.tree;

    await runCli(["create"], { env, cwd: workDir.path });
    const treeAfterFirst = mock.hits.tree;

    await runCli(["create"], { env, cwd: workDir.path });
    const treeAfterSecond = mock.hits.tree;

    expect(treeAfterFirst).to.be.greaterThan(treeBefore);
    expect(treeAfterSecond).to.equal(treeAfterFirst);
  });

  it("caches demo code across runs", async () => {
    const env = testEnv();
    await runCli(["create", "hello-world", "first"], {
      env,
      cwd: workDir.path,
    });
    const rawAfterFirst = mock.hits.raw;

    await runCli(["create", "hello-world", "second"], {
      env,
      cwd: workDir.path,
    });
    const rawAfterSecond = mock.hits.raw;

    expect(rawAfterSecond).to.equal(rawAfterFirst);
  });

  it("re-fetches when --refresh is passed", async () => {
    const env = testEnv();
    await runCli(["create", "hello-world", "first"], {
      env,
      cwd: workDir.path,
    });
    const rawAfterFirst = mock.hits.raw;

    await runCli(["create", "hello-world", "second", "--refresh"], {
      env,
      cwd: workDir.path,
    });
    const rawAfterRefresh = mock.hits.raw;

    expect(rawAfterRefresh).to.be.greaterThan(rawAfterFirst);
  });

  // -------------------------------------------------------------------------
  // Network failures
  // -------------------------------------------------------------------------

  it("exits with an error when the network is unavailable and no cache exists", async () => {
    const result = await runCli(["create"], {
      env: {
        ...testEnv(),
        LILIS_GITHUB_TREE_URL: "http://127.0.0.1:1/tree",
      },
      cwd: workDir.path,
    });
    expect(result.code).to.not.equal(0);
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).to.match(/failed|error/);
  });

  it("falls back to the cached list when the network is unavailable", async () => {
    const env = testEnv();

    // Prime the cache with a working network.
    await runCli(["create"], { env, cwd: workDir.path });

    // Age the cache so the CLI treats it as stale and tries the network.
    // Without this, ensureDemoList() returns the fresh cache immediately
    // and never exercises the fallback path.
    const cachePath = join(cacheDir.path, "demo-list.json");
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    cached.lastFetched = 0;
    await writeFile(cachePath, JSON.stringify(cached, null, 2));

    // Now point at a dead URL. The refresh attempt will fail, and the
    // CLI should warn and fall back to the cached list.
    const result = await runCli(["create"], {
      env: {
        ...env,
        LILIS_GITHUB_TREE_URL: "http://127.0.0.1:1/tree",
      },
      cwd: workDir.path,
    });

    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("hello-world");

    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).to.match(/cached|warning|refresh/);
  });
});
