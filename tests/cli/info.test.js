import { expect } from "chai";
import {
  runCli,
  startMockGitHub,
  makeTempDir,
  makeSampleRepo,
} from "./helpers.js";

describe("lilis-engine info", function () {
  this.timeout(60_000);

  let mock, cacheDir;

  before(async () => {
    mock = await startMockGitHub(makeSampleRepo());
  });

  after(async () => {
    await mock.close();
  });

  beforeEach(async () => {
    cacheDir = await makeTempDir();
  });

  afterEach(async () => {
    await cacheDir.cleanup();
  });

  function testEnv() {
    return {
      LILIS_GITHUB_TREE_URL: mock.treeUrl,
      LILIS_GITHUB_RAW_BASE: mock.rawBase,
      LILIS_CACHE_DIR: cacheDir.path,
      LILIS_SKIP_INSTALL: "1",
    };
  }

  it("errors when no demo is specified", async () => {
    const result = await runCli(["info"], { env: testEnv() });
    expect(result.code).to.not.equal(0);
    // yargs writes a "Not enough non-option arguments" style message.
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).to.include("demo");
  });

  it("errors when the demo does not exist", async () => {
    const result = await runCli(["info", "nope"], { env: testEnv() });
    expect(result.code).to.not.equal(0);
    expect(result.stderr).to.include("not found");
    expect(result.stderr).to.include("hello-world");
  });

  it("displays the demo name and description", async () => {
    const result = await runCli(["info", "hello-world"], { env: testEnv() });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("hello-world");
    expect(result.stdout).to.include("A minimal hello-world demo.");
  });

  it("shows the source URL for the demo", async () => {
    const result = await runCli(["info", "hello-world"], { env: testEnv() });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("github.com");
    expect(result.stdout).to.include("demos/hello-world");
  });

  it("renders the README content", async () => {
    const result = await runCli(["info", "hello-world"], { env: testEnv() });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("Hello World");
    expect(result.stdout).to.include("Usage");
  });

  it("handles a demo with no README gracefully", async () => {
    const result = await runCli(["info", "other-demo"], { env: testEnv() });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("other-demo");
    const combined = result.stdout + result.stderr;
    // Either the message is printed or the README section is simply absent.
    // Both are acceptable; we just want no crash.
    expect(result.code).to.equal(0);
  });

  it("suggests the create command with the demo name", async () => {
    const result = await runCli(["info", "hello-world"], { env: testEnv() });
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("lilis-engine create hello-world");
  });
});
