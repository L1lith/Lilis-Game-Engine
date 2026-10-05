import { it } from "mocha";
import { expect } from "chai";
import { describeDemo } from "./helpers.js";

describeDemo("astro-solid-basic", {
  hasCanvas: false,
  hasDOM: true,
  tests: ({ getPage, getServer }) => {
    it("renders visible text content", async () => {
      const page = getPage();
      await page.goto(getServer().url + "/");
      await page.waitForTimeout(800);
      const visibleText = await page.evaluate(
        () => document.body.innerText.trim().length,
      );
      expect(visibleText).to.be.greaterThan(0);
    });
  },
});
