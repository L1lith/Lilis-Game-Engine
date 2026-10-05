import { it } from "mocha";
import { expect } from "chai";
import { describeDemo, readPlayer, holdKey } from "./helpers.js";

describeDemo("sidescroller", {
  hasCanvas: true,
  hasDOM: true,
  exposesEntities: true,
  tests: ({ getPage, getServer, getPageErrors }) => {
    const settle = async (page) => {
      await page.waitForSelector("canvas", { timeout: 15_000 });
      await page.waitForTimeout(500);
    };

    it("canvas has a 2D or WebGL context", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForSelector("canvas", { timeout: 15_000 });
      const contextType = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (canvas.getContext("2d")) return "2d";
        if (canvas.getContext("webgl2")) return "webgl2";
        if (canvas.getContext("webgl")) return "webgl";
        return null;
      });
      expect(contextType).to.not.be.null;
    });

    it("ArrowRight increases the player's x coordinate", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const before = await readPlayer(page);
      if (!before) return;

      await holdKey(page, "ArrowRight", 600);
      await page.waitForTimeout(150);

      const after = await readPlayer(page);
      expect(after.x).to.be.greaterThan(before.x);
    });

    it("ArrowLeft decreases the player's x coordinate", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const before = await readPlayer(page);
      if (!before) return;

      await holdKey(page, "ArrowLeft", 600);
      await page.waitForTimeout(150);

      const after = await readPlayer(page);
      expect(after.x).to.be.lessThan(before.x);
    });

    it("does not throw during keyboard interaction", async () => {
      expect(getPageErrors()).to.be.empty;
    });
  },
});
