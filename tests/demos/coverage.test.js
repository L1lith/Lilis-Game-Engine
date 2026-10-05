import { describe, it } from "mocha";
import { expect } from "chai";
import { readdirSync } from "node:fs";
import { discoverDemos } from "./helpers.js";

describe("Demo test coverage", () => {
  const demos = discoverDemos();
  const testFiles = readdirSync(import.meta.dirname)
    .filter((f) => f.endsWith(".test.js"))
    .map((f) => f.replace(".test.js", ""));

  for (const demo of demos) {
    if (!demo.hasDev) {
      it(`"${demo.name}" has no dev script (skipped)`, function () {
        this.skip();
      });
      continue;
    }

    it(`has a test file for "${demo.name}"`, () => {
      expect(
        testFiles.includes(demo.name),
        `Missing test file: tests/demos/${demo.name}.test.js\n` +
          `Create one using the pattern from an existing demo test.`,
      ).to.be.true;
    });
  }
});
