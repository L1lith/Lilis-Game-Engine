import { expect } from "chai";
import { runCli } from "./helpers.js";

describe("CLI basics", function () {
  this.timeout(30_000);

  it("shows help when --help is passed", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("lilis-engine");
    expect(result.stdout).to.include("create");
    expect(result.stdout).to.include("info");
  });

  it("shows the version when --version is passed", async () => {
    const result = await runCli(["--version"]);
    expect(result.code).to.equal(0);
    // Any semver-looking output is acceptable; we don't want the test to
    // break on every version bump.
    expect(result.stdout.trim()).to.match(/^\d+\.\d+\.\d+/);
  });

  it("errors when no command is given", async () => {
    const result = await runCli([]);
    expect(result.code).to.not.equal(0);
    // yargs writes "You need to specify a command." to stderr.
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).to.include("command");
  });

  it("errors on an unknown command", async () => {
    const result = await runCli(["not-a-real-command"]);
    expect(result.code).to.not.equal(0);
  });

  it("shows help for the create subcommand", async () => {
    const result = await runCli(["create", "--help"]);
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("demo");
    expect(result.stdout).to.include("projectName");
    expect(result.stdout).to.include("refresh");
  });

  it("shows help for the info subcommand", async () => {
    const result = await runCli(["info", "--help"]);
    expect(result.code).to.equal(0);
    expect(result.stdout).to.include("demo");
  });
});
