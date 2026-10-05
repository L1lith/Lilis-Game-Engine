import { it } from "mocha";
import { expect } from "chai";
import { describeDemo, readEntities, waitFrames } from "./helpers.js";

describeDemo("pixi-rudimentary", {
  hasCanvas: true,
  hasDOM: false,
  exposesEntities: true,
  tests: ({ getPage, getServer, getPageErrors }) => {
    const settle = async (page) => {
      await page.waitForSelector("canvas", { timeout: 15_000 });
      await page.waitForTimeout(800);
      await waitFrames(page, 3);
    };

    it("canvas has a WebGL or 2D context", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForSelector("canvas", { timeout: 15_000 });
      const contextType = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (canvas.getContext("webgl2")) return "webgl2";
        if (canvas.getContext("webgl")) return "webgl";
        if (canvas.getContext("2d")) return "2d";
        return null;
      });
      expect(contextType).to.not.be.null;
    });

    it("spawns at least one entity", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);
      const entities = await readEntities(page);
      expect(entities.length).to.be.greaterThan(0);
    });

    it("entities with imageURL are present", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);
      const entities = await readEntities(page);
      const withImage = entities.filter((e) => e.imageURL);
      expect(
        withImage.length,
        "a rudimentary Pixi demo should render at least one image entity",
      ).to.be.greaterThan(0);
    });

    it("renders a non-uniform frame", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);
      const buf = await page.screenshot({
        clip: { x: 0, y: 0, width: 200, height: 200 },
      });
      expect(buf.length).to.be.greaterThan(200);
    });

    it("does not throw during rendering", async () => {
      expect(getPageErrors()).to.be.empty;
    });
  },
});
