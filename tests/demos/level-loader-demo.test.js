import { it } from "mocha";
import { expect } from "chai";
import { describeDemo, readEntities } from "./helpers.js";

describeDemo("level-loader-demo", {
  hasCanvas: true,
  hasDOM: false,
  exposesEntities: true,
  tests: ({ getPage, getServer }) => {
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

    it("loads at least one level's worth of entities", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForTimeout(1500);
      const entities = await readEntities(page);
      expect(entities.length).to.be.greaterThan(0);
    });
  },
});
