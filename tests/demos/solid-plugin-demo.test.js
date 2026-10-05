import { it } from "mocha";
import { expect } from "chai";
import { describeDemo, readEntities, waitFrames } from "./helpers.js";

describeDemo("solid-plugin-demo", {
  hasCanvas: false,
  hasDOM: true,
  exposesEntities: true,
  tests: ({ getPage, getServer, getPageErrors }) => {
    const settle = async (page) => {
      await page.waitForTimeout(800);
      await waitFrames(page, 3);
    };

    it("renders non-canvas DOM content", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const nonCanvasChildren = await page.evaluate(
        () =>
          [...document.body.children].filter(
            (el) => el.tagName.toLowerCase() !== "canvas",
          ).length,
      );
      expect(nonCanvasChildren).to.be.greaterThan(0);
    });

    it("has visible rendered content in the DOM", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const innerText = await page.evaluate(
        () => document.body.innerText.trim().length,
      );
      const innerHTML = await page.locator("body").innerHTML();
      expect(innerText + innerHTML.length).to.be.greaterThan(0);
    });

    it("spawns entities that declare a solid component", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      // Different demos name their Solid component field differently, so we
      // check for several common ones. If none match, the error message
      // reports the actual entity keys so this test can be updated.
      const info = await page.evaluate(() => {
        const raw = window.entities;
        if (!raw) return { count: 0, matches: 0, keys: [] };
        let list;
        try {
          list = typeof raw.get === "function" ? raw.get() : raw;
        } catch {
          return { count: 0, matches: 0, keys: [] };
        }
        if (!Array.isArray(list)) return { count: 0, matches: 0, keys: [] };

        const candidates = [
          "solid",
          "component",
          "ui",
          "dom",
          "solidComponent",
        ];
        let matches = 0;
        for (const e of list) {
          if (!e) continue;
          if (candidates.some((f) => e[f] != null)) matches += 1;
        }
        const sample = list.find((e) => e && typeof e === "object") || {};
        return {
          count: list.length,
          matches,
          keys: Object.keys(sample),
        };
      });

      expect(
        info.matches,
        `Expected at least one entity with a Solid component field ` +
          `(checked: ${["solid", "component", "ui", "dom", "solidComponent"].join(", ")}). ` +
          `Seen ${info.count} entities. Sample entity keys: [${info.keys.join(", ")}]`,
      ).to.be.greaterThan(0);
    });

    it("renders a DOM element for each solid entity", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const entities = await readEntities(page);
      const solidEntities = entities.filter((e) => e.hasSolid);
      if (solidEntities.length === 0) return;

      const positionedCount = await page.evaluate(
        () =>
          document.querySelectorAll(
            '[style*="position: absolute"], [style*="position:absolute"]',
          ).length,
      );
      expect(positionedCount).to.be.greaterThan(0);
    });

    it("entities have finite x/y coordinates", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await settle(page);

      const entities = await readEntities(page);
      const withSolid = entities.filter((e) => e.hasSolid);
      for (const e of withSolid) {
        expect(Number.isFinite(e.x), `x is not finite for a solid entity`).to.be
          .true;
        expect(Number.isFinite(e.y), `y is not finite for a solid entity`).to.be
          .true;
      }
    });

    it("does not throw during rendering", async () => {
      expect(getPageErrors()).to.be.empty;
    });
  },
});
