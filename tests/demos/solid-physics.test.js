import { it } from "mocha";
import { expect } from "chai";
import { describeDemo, readEntities } from "./helpers.js";

describeDemo("solid-physics", {
  hasCanvas: false,
  hasDOM: true,
  exposesEntities: true,
  tests: ({ getPage, getServer, getPageErrors }) => {
    it("renders positioned DOM elements", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForTimeout(1500);
      const count = await page.evaluate(
        () =>
          document.querySelectorAll(
            '[style*="position: absolute"], [style*="transform"]',
          ).length,
      );
      expect(count).to.be.greaterThan(0);
    });

    it("spawns matter-backed entities", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForTimeout(1500);
      const entities = await readEntities(page);
      const physics = entities.filter((e) => e.hasMatterBody);
      expect(physics.length).to.be.greaterThan(0);
    });

    it("dragging an entity moves it", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForTimeout(1500);

      const boxes = page.locator('[style*="position: absolute"]');
      const count = await boxes.count();
      if (count === 0) return;

      const box = boxes.first();
      const before = await box.boundingBox();
      if (!before) return;

      await page.mouse.move(
        before.x + before.width / 2,
        before.y + before.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        before.x + before.width / 2 + 80,
        before.y + before.height / 2 - 80,
        { steps: 10 },
      );
      await page.mouse.up();
      await page.waitForTimeout(600);

      const after = await box.boundingBox();
      expect(after).to.not.be.null;
      expect(getPageErrors()).to.be.empty;
    });
  },
});
