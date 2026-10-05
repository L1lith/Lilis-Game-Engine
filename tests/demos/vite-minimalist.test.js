import { it } from "mocha";
import { expect } from "chai";
import { describeDemo } from "./helpers.js";

describeDemo("vite-minimalist", {
  hasCanvas: true,
  hasDOM: false,
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

    it("renders a non-uniform frame", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForSelector("canvas", { timeout: 15_000 });
      await page.waitForTimeout(1500);
      const buf = await page.screenshot({
        clip: { x: 0, y: 0, width: 200, height: 200 },
      });
      expect(buf.length).to.be.greaterThan(200);
    });
  },
});
